import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ok = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    const body = await req.json();
    console.log("[channex-message-webhook] Received event:", body.event);

    const payload = body.payload;
    if (!payload || body.event !== "message") {
      return ok({ success: true, message: "Ignored non-message event" });
    }

    const channexMessageId = payload.id;
    const messageText = payload.message || null;
    const sender = payload.sender || "guest";
    const channexPropertyId = payload.property_id || body.property_id;
    const channexBookingId = payload.booking_id || null;
    const channexThreadId = payload.message_thread_id;
    const attachments = payload.attachments || [];
    const eventTimestamp = body.timestamp || new Date().toISOString();

    if (!channexThreadId || !channexMessageId) {
      console.error("[channex-message-webhook] Missing thread or message ID");
      return ok({ success: false, message: "Missing required IDs" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve local property_id
    let localPropertyId: string | null = null;
    if (channexPropertyId) {
      const { data: mapping } = await supabase
        .from("channex_mappings")
        .select("local_id")
        .eq("channex_id", channexPropertyId)
        .eq("entity_type", "property")
        .maybeSingle();
      if (mapping) localPropertyId = mapping.local_id;
    }

    // Idempotency check
    const { data: existingMsg } = await supabase
      .from("messages")
      .select("id, thread_id")
      .eq("channex_message_id", channexMessageId)
      .maybeSingle();

    if (existingMsg) {
      console.log("[channex-message-webhook] Message already exists, skipping");
      return ok({
        success: true,
        message: "Already processed",
        message_id: existingMsg.id,
        thread_id: existingMsg.thread_id,
      });
    }

    // Look up existing thread
    const { data: existingThread } = await supabase
      .from("message_threads")
      .select("id, message_count")
      .eq("channex_thread_id", channexThreadId)
      .maybeSingle();

    let threadId: string;

    if (existingThread) {
      // Thread exists — insert message and update thread
      threadId = existingThread.id;

      const { error: insertErr } = await supabase.from("messages").insert({
        thread_id: threadId,
        channex_message_id: channexMessageId,
        message: messageText,
        sender,
        attachments: attachments.length > 0 ? attachments : [],
        channex_sent_at: eventTimestamp,
      });

      if (insertErr) throw insertErr;

      const { error: updateErr } = await supabase
        .from("message_threads")
        .update({
          last_message_text: messageText,
          last_message_sender: sender,
          last_message_at: eventTimestamp,
          message_count: (existingThread.message_count || 0) + 1,
          is_read: false,
        })
        .eq("id", threadId);

      if (updateErr) throw updateErr;
    } else {
      // Thread does not exist — fetch from Channex API, create thread + message
      let threadTitle: string | null = null;
      let provider = "Unknown";
      let isClosed = false;

      try {
        const channexThread = await channexRequest<any>(
          "GET",
          `/api/v1/message_threads/${channexThreadId}`
        );
        const threadData = channexThread?.data?.attributes || channexThread?.data || {};
        threadTitle = threadData.title || threadData.subject || null;
        provider = threadData.provider || threadData.ota_name || "Unknown";
        isClosed = threadData.is_closed === true;
      } catch (fetchErr) {
        console.error("[channex-message-webhook] Failed to fetch thread from Channex:", fetchErr);
        // Continue with defaults
      }

      // Try to resolve reservation_id via channex_bookings
      let reservationId: string | null = null;
      if (channexBookingId) {
        const { data: booking } = await supabase
          .from("channex_bookings")
          .select("channex_booking_id")
          .eq("channex_booking_id", channexBookingId)
          .maybeSingle();

        if (booking) {
          const { data: reservation } = await supabase
            .from("reservations")
            .select("id")
            .eq("channex_booking_id", channexBookingId)
            .maybeSingle();
          if (reservation) reservationId = reservation.id;
        }
      }

      const { data: newThread, error: threadInsertErr } = await supabase
        .from("message_threads")
        .insert({
          channex_thread_id: channexThreadId,
          channex_booking_id: channexBookingId,
          property_id: localPropertyId,
          reservation_id: reservationId,
          title: threadTitle,
          provider,
          is_closed: isClosed,
          is_read: false,
          message_count: 1,
          last_message_text: messageText,
          last_message_sender: sender,
          last_message_at: eventTimestamp,
        })
        .select("id")
        .single();

      if (threadInsertErr) throw threadInsertErr;
      threadId = newThread.id;

      const { error: msgInsertErr } = await supabase.from("messages").insert({
        thread_id: threadId,
        channex_message_id: channexMessageId,
        message: messageText,
        sender,
        attachments: attachments.length > 0 ? attachments : [],
        channex_sent_at: eventTimestamp,
      });

      if (msgInsertErr) throw msgInsertErr;
    }

    await logSync(
      "channex-message-webhook",
      "/webhook/message",
      { channex_message_id: channexMessageId, channex_thread_id: channexThreadId },
      { thread_id: threadId },
      200,
      true,
      null,
      localPropertyId
    );

    console.log(`[channex-message-webhook] Processed message ${channexMessageId} in thread ${threadId}`);
    return ok({ success: true, message_id: channexMessageId, thread_id: threadId });
  } catch (err: any) {
    console.error("[channex-message-webhook] Error:", err);

    try {
      await logSync(
        "channex-message-webhook",
        "/webhook/message",
        null,
        null,
        500,
        false,
        err.message,
        null
      );
    } catch (logErr) {
      console.error("[channex-message-webhook] Failed to log error:", logErr);
    }

    // Always return 200 to Channex
    return ok({ success: false, error: err.message });
  }
});

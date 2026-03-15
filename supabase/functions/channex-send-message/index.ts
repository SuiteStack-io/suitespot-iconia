import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, ChannexApiError, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    if (req.method !== "POST") {
      return ok({ success: false, error: "Method not allowed" }, 405);
    }

    const { booking_id, message: messageText } = await req.json();

    if (!booking_id || !messageText) {
      return ok({ success: false, error: "booking_id and message are required" }, 400);
    }

    // Send message to Channex
    let channexResponse: any;
    try {
      channexResponse = await channexRequest<any>(
        "POST",
        `/api/v1/bookings/${booking_id}/messages`,
        { message: { message: messageText } }
      );
    } catch (err) {
      if (err instanceof ChannexApiError) {
        if (err.statusCode === 422) {
          return ok({ success: false, error: "This OTA does not support messaging" });
        }
        if (err.statusCode === 403) {
          return ok({ success: false, error: "Messages app not installed for this property" });
        }
      }
      throw err;
    }

    // Extract response data
    const channexMessageId = channexResponse?.data?.id;
    const insertedAt = channexResponse?.data?.attributes?.inserted_at || new Date().toISOString();
    const channexThreadId = channexResponse?.data?.relationships?.message_thread?.data?.id;

    if (!channexMessageId || !channexThreadId) {
      console.error("[channex-send-message] Unexpected Channex response shape:", JSON.stringify(channexResponse));
      return ok({ success: false, error: "Unexpected response from messaging API" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up existing thread
    const { data: existingThread } = await supabase
      .from("message_threads")
      .select("id, message_count")
      .eq("channex_thread_id", channexThreadId)
      .maybeSingle();

    let threadId: string;

    if (existingThread) {
      threadId = existingThread.id;

      // Insert message
      const { error: msgErr } = await supabase.from("messages").insert({
        thread_id: threadId,
        channex_message_id: channexMessageId,
        message: messageText,
        sender: "property",
        channex_sent_at: insertedAt,
      });
      if (msgErr) throw msgErr;

      // Update thread
      const { error: updateErr } = await supabase
        .from("message_threads")
        .update({
          last_message_text: messageText,
          last_message_sender: "property",
          last_message_at: insertedAt,
          message_count: (existingThread.message_count || 0) + 1,
          is_read: true,
        })
        .eq("id", threadId);
      if (updateErr) throw updateErr;
    } else {
      // Thread not found locally — fetch from Channex and create
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
        console.error("[channex-send-message] Failed to fetch thread from Channex:", fetchErr);
      }

      // Resolve local property_id from booking
      let localPropertyId: string | null = null;
      let reservationId: string | null = null;

      const { data: booking } = await supabase
        .from("channex_bookings")
        .select("property_id")
        .eq("channex_booking_id", booking_id)
        .maybeSingle();

      if (booking?.property_id) {
        localPropertyId = booking.property_id;
      }

      const { data: reservation } = await supabase
        .from("reservations")
        .select("id")
        .eq("channex_booking_id", booking_id)
        .maybeSingle();

      if (reservation) {
        reservationId = reservation.id;
      }

      const { data: newThread, error: threadInsertErr } = await supabase
        .from("message_threads")
        .insert({
          channex_thread_id: channexThreadId,
          channex_booking_id: booking_id,
          property_id: localPropertyId,
          reservation_id: reservationId,
          title: threadTitle,
          provider,
          is_closed: isClosed,
          is_read: true,
          message_count: 1,
          last_message_text: messageText,
          last_message_sender: "property",
          last_message_at: insertedAt,
        })
        .select("id")
        .single();

      if (threadInsertErr) throw threadInsertErr;
      threadId = newThread.id;

      const { error: msgInsertErr } = await supabase.from("messages").insert({
        thread_id: threadId,
        channex_message_id: channexMessageId,
        message: messageText,
        sender: "property",
        channex_sent_at: insertedAt,
      });
      if (msgInsertErr) throw msgInsertErr;
    }

    await logSync(
      "channex-send-message",
      `/api/v1/bookings/${booking_id}/messages`,
      { booking_id, message: messageText },
      { channex_message_id: channexMessageId, thread_id: threadId },
      200,
      true,
      null,
      null
    );

    console.log(`[channex-send-message] Sent message ${channexMessageId} in thread ${threadId}`);
    return ok({ success: true, message_id: channexMessageId, thread_id: threadId });
  } catch (err: any) {
    console.error("[channex-send-message] Error:", err);

    try {
      await logSync(
        "channex-send-message",
        "/api/v1/bookings/messages",
        null,
        null,
        500,
        false,
        err.message,
        null
      );
    } catch (logErr) {
      console.error("[channex-send-message] Failed to log error:", logErr);
    }

    return ok({ success: false, error: err.message });
  }
});

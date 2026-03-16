import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const filterPropertyId: string | null = body.property_id || null;

    // 1. Get property mappings
    let mappingsQuery = supabase
      .from("channex_mappings")
      .select("local_id, channex_id")
      .eq("entity_type", "property")
      .eq("sync_status", "synced");

    if (filterPropertyId) {
      mappingsQuery = mappingsQuery.eq("local_id", filterPropertyId);
    }

    const { data: mappings, error: mappingsErr } = await mappingsQuery;
    if (mappingsErr) throw mappingsErr;

    if (!mappings || mappings.length === 0) {
      return ok({ success: true, message: "No synced properties found", threads_synced: 0, messages_synced: 0 });
    }

    // 2. Get existing thread IDs to skip duplicates
    const { data: existingThreads } = await supabase
      .from("message_threads")
      .select("channex_thread_id");
    const existingThreadIds = new Set((existingThreads || []).map((t: any) => t.channex_thread_id));

    let threadsSynced = 0;
    let messagesSynced = 0;
    const errors: string[] = [];

    // 3. For each property, fetch threads from Channex
    for (const mapping of mappings) {
      const channexPropertyId = mapping.channex_id;
      const localPropertyId = mapping.local_id;

      try {
        const threadsResponse: any = await channexRequest(
          "GET",
          `/api/v1/message_threads?filter[property_id]=${channexPropertyId}&pagination[limit]=100`
        );
        await sleep(200);

        const threads = threadsResponse?.data || [];

        for (const thread of threads) {
          const threadId = thread.id;
          if (existingThreadIds.has(threadId)) continue;

          const attrs = thread.attributes || {};
          const bookingId = attrs.booking_id || null;
          const provider = attrs.provider || "unknown";
          const title = attrs.title || null;
          const isClosed = attrs.is_closed === true;
          const messageCount = attrs.message_count || 0;
          const lastMessageAt = attrs.last_message_at || null;
          const lastMessageText = attrs.last_message_text || null;
          const lastMessageSender = attrs.last_message_sender || null;

          // Resolve reservation_id from channex_booking_id
          let reservationId: string | null = null;
          if (bookingId) {
            const { data: resMatch } = await supabase
              .from("reservations")
              .select("id")
              .eq("channex_booking_id", bookingId)
              .maybeSingle();
            if (resMatch) reservationId = resMatch.id;
          }

          // Insert thread
          const { error: threadInsertErr } = await supabase
            .from("message_threads")
            .insert({
              channex_thread_id: threadId,
              channex_booking_id: bookingId,
              property_id: localPropertyId,
              reservation_id: reservationId,
              provider,
              title,
              is_closed: isClosed,
              message_count: messageCount,
              last_message_at: lastMessageAt,
              last_message_text: lastMessageText,
              last_message_sender: lastMessageSender,
              is_read: true,
            });

          if (threadInsertErr) {
            errors.push(`Thread ${threadId}: ${threadInsertErr.message}`);
            continue;
          }

          // Get the inserted thread's local ID
          const { data: insertedThread } = await supabase
            .from("message_threads")
            .select("id")
            .eq("channex_thread_id", threadId)
            .maybeSingle();

          if (!insertedThread) {
            errors.push(`Thread ${threadId}: could not retrieve after insert`);
            continue;
          }

          threadsSynced++;
          existingThreadIds.add(threadId);

          // Fetch messages for this thread
          try {
            const msgsResponse: any = await channexRequest(
              "GET",
              `/api/v1/message_threads/${threadId}/messages?pagination[limit]=100`
            );
            await sleep(200);

            const msgs = msgsResponse?.data || [];

            if (msgs.length > 0) {
              // Get existing message IDs for dedup
              const { data: existingMsgs } = await supabase
                .from("messages")
                .select("channex_message_id")
                .eq("thread_id", insertedThread.id);
              const existingMsgIds = new Set((existingMsgs || []).map((m: any) => m.channex_message_id));

              const newMessages = msgs
                .filter((m: any) => !existingMsgIds.has(m.id))
                .map((m: any) => ({
                  thread_id: insertedThread.id,
                  channex_message_id: m.id,
                  message: m.attributes?.message || m.attributes?.text || null,
                  sender: m.attributes?.sender || "guest",
                  channex_sent_at: m.attributes?.sent_at || m.attributes?.inserted_at || null,
                  attachments: m.attributes?.attachments || null,
                }));

              if (newMessages.length > 0) {
                const { error: msgsInsertErr } = await supabase
                  .from("messages")
                  .insert(newMessages);

                if (msgsInsertErr) {
                  errors.push(`Messages for thread ${threadId}: ${msgsInsertErr.message}`);
                } else {
                  messagesSynced += newMessages.length;
                }
              }
            }
          } catch (msgErr: any) {
            errors.push(`Fetching messages for thread ${threadId}: ${msgErr.message}`);
          }
        }
      } catch (propErr: any) {
        errors.push(`Property ${localPropertyId}: ${propErr.message}`);
      }
    }

    await logSync(
      "channex-sync-messages",
      "/api/v1/message_threads",
      { property_id: filterPropertyId },
      { threads_synced: threadsSynced, messages_synced: messagesSynced, errors },
      200,
      true,
      null,
      filterPropertyId
    );

    return ok({
      success: true,
      threads_synced: threadsSynced,
      messages_synced: messagesSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[channex-sync-messages] Error:", err);

    await logSync(
      "channex-sync-messages",
      "/api/v1/message_threads",
      null,
      null,
      500,
      false,
      err.message,
      null
    ).catch(() => {});

    return ok({ success: false, error: err.message }, 500);
  }
});

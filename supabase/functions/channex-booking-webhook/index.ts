import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync, createAlert } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ok = (body: object) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    if (req.method !== "POST") {
      return ok({ success: false, error: "Method not allowed" });
    }

    const body = await req.json();
    console.log("[channex-booking-webhook] Full payload:", JSON.stringify(body, null, 2));

    const event = body.event;

    // --- Create supabase client early so we can log immediately ---
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Log EVERY incoming request immediately ---
    const { error: immediateLogError } = await supabase
      .from("channex_sync_logs")
      .insert({
        function_name: "channex-booking-webhook",
        endpoint: "webhook",
        request_payload: body,
        response_payload: { event: event || "unknown" },
        status_code: 200,
        success: true,
        error_message: null,
        property_id: (body.property_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.property_id)) ? body.property_id : null,
      });
    if (immediateLogError) {
      console.error("[channex-booking-webhook] Failed to write immediate log:", immediateLogError);
    }

    if (event !== "booking") {
      console.log(`[channex-booking-webhook] Non-booking event: ${event}, logged and returning`);
      return ok({ success: true, message: `Logged and ignored event: ${event}` });
    }

    // --- Parse initial booking data from multiple possible structures ---
    const rawPayload = body.payload || {};
    const bookingData =
      rawPayload.booking ||
      body.booking ||
      body.data?.booking ||
      body.data ||
      rawPayload;

    const channexPropertyId = rawPayload.property_id || body.property_id;
    const booking_id = bookingData.booking_id || bookingData.id || rawPayload.booking_id;
    const revisionId = bookingData.revision_id || rawPayload.revision_id || bookingData.id;

    console.log("[channex-booking-webhook] Raw payload keys:", Object.keys(rawPayload));
    console.log("[channex-booking-webhook] BookingData keys:", Object.keys(bookingData));
    console.log("[channex-booking-webhook] booking_id:", booking_id, "revisionId:", revisionId);

    // --- Detect test payloads ---
    const isTestProperty = !channexPropertyId || channexPropertyId.startsWith('test-') || channexPropertyId === 'test-property-id';
    const isTestBooking = !booking_id || String(booking_id).startsWith('test-');

    // --- Enrich thin payloads by fetching full booking from Channex API ---
    let enrichedData = bookingData;
    if (!bookingData.arrival_date && !bookingData.check_in && booking_id && !isTestBooking) {
      console.log("[channex-booking-webhook] Thin payload detected, fetching full booking from API...");
      try {
        const fullBooking: any = await channexRequest("GET", `/api/v1/bookings/${booking_id}`);
        const fetchedData = fullBooking?.data?.attributes || fullBooking?.data || fullBooking;
        enrichedData = { ...bookingData, ...fetchedData };
        console.log("[channex-booking-webhook] Enriched from API, keys:", Object.keys(enrichedData));
      } catch (fetchErr: any) {
        console.warn("[channex-booking-webhook] Could not fetch full booking:", fetchErr.message);
      }
    }

    // --- Flexible field extraction ---
    const status = enrichedData.status || bookingData.status;
    const ota_name = enrichedData.ota_name || enrichedData.source || bookingData.ota_name;
    const ota_reservation_code = enrichedData.ota_reservation_code || bookingData.ota_reservation_code;

    const arrival_date =
      enrichedData.arrival_date ||
      enrichedData.arrivalDate ||
      enrichedData.check_in ||
      enrichedData.checkin ||
      enrichedData.checkin_date ||
      rawPayload.arrival_date ||
      null;

    const departure_date =
      enrichedData.departure_date ||
      enrichedData.departureDate ||
      enrichedData.check_out ||
      enrichedData.checkout ||
      enrichedData.checkout_date ||
      rawPayload.departure_date ||
      null;

    const customer = enrichedData.customer || bookingData.customer;
    const rooms = enrichedData.rooms || bookingData.rooms;
    const amount = enrichedData.amount || enrichedData.total_amount || bookingData.amount || bookingData.total_amount;
    const currency = enrichedData.currency || bookingData.currency;

    console.log("[channex-booking-webhook] Extracted dates:", { arrival_date, departure_date });

    // --- Resolve local property ID ---
    let localPropertyId: string | null = null;

    if (!isTestProperty) {
      const { data: propMapping } = await supabase
        .from("channex_mappings")
        .select("local_id")
        .eq("channex_id", channexPropertyId)
        .eq("entity_type", "property")
        .maybeSingle();

      if (propMapping) {
        localPropertyId = propMapping.local_id;
      } else {
        console.warn(`[channex-booking-webhook] No local property for Channex ID ${channexPropertyId}`);
        await logSync("channex-booking-webhook", "webhook", body, null, null, true, `Warning: unknown property ${channexPropertyId}`, null);
      }
    }

    // --- Resolve room type & rate plan ---
    let roomTypeId: string | null = null;
    let ratePlanId: string | null = null;

    if (rooms?.length > 0) {
      const firstRoom = rooms[0];
      if (firstRoom.room_type_id) {
        const { data: rtMap } = await supabase
          .from("channex_mappings")
          .select("local_id")
          .eq("channex_id", firstRoom.room_type_id)
          .eq("entity_type", "room_type")
          .maybeSingle();
        if (rtMap) roomTypeId = rtMap.local_id;
      }
      if (firstRoom.rate_plan_id) {
        const { data: rpMap } = await supabase
          .from("channex_mappings")
          .select("local_id")
          .eq("channex_id", firstRoom.rate_plan_id)
          .eq("entity_type", "rate_plan")
          .maybeSingle();
        if (rpMap) ratePlanId = rpMap.local_id;
      }
    }

    // --- Guest info ---
    const guestName = [customer?.name, customer?.surname].filter(Boolean).join(" ") || "Unknown Guest";
    const guestEmail = customer?.email || customer?.mail || "unknown@unknown.com";
    const guestPhone = customer?.phone || null;

    // --- Execute DB operation ---
    let dbError: string | null = null;

    if (status === "cancelled") {
      const { error } = await supabase
        .from("channex_bookings")
        .update({ status: "cancelled", channex_revision_id: revisionId, booking_data: body })
        .eq("channex_booking_id", booking_id);
      if (error) dbError = error.message;
    } else {
      const record = {
        channex_booking_id: booking_id,
        channex_revision_id: revisionId,
        ota_name: ota_name || "Unknown",
        ota_reservation_code: ota_reservation_code || null,
        property_id: localPropertyId,
        room_type_id: roomTypeId,
        rate_plan_id: ratePlanId,
        status: status || "new",
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone,
        arrival_date,
        departure_date,
        total_amount: parseFloat(amount) || 0,
        currency: currency || "USD",
        booking_data: body,
        acknowledged: false,
      };

      const { error } = await supabase
        .from("channex_bookings")
        .upsert(record, { onConflict: "channex_booking_id" });
      if (error) dbError = error.message;
    }

    if (dbError) {
      console.error("[channex-booking-webhook] DB error:", dbError);
      await logSync("channex-booking-webhook", "webhook", body, null, null, false, dbError, localPropertyId);
      await createAlert('webhook_error', `Failed to save booking ${booking_id}: ${dbError}`, localPropertyId);
      return ok({ success: false, error: dbError });
    }

    // --- ACK the revision ---
    let ackSuccess = false;
    const isTestRevision = !revisionId || String(revisionId).startsWith('test-');
    if (isTestRevision) {
      ackSuccess = true;
    } else {
      try {
        await channexRequest("POST", `/api/v1/booking_revisions/${revisionId}/ack`, {});
        ackSuccess = true;
        await supabase
          .from("channex_bookings")
          .update({ acknowledged: true })
          .eq("channex_booking_id", booking_id);
      } catch (ackErr: any) {
        console.error("[channex-booking-webhook] ACK failed:", ackErr.message);
      }
    }

    await logSync("channex-booking-webhook", "webhook", body, { status, booking_id, ack: ackSuccess }, 200, true, null, localPropertyId);

    return ok({ success: true, booking_id, status, acknowledged: ackSuccess });
  } catch (err: any) {
    console.error("[channex-booking-webhook] Error:", err);
    try {
      await logSync("channex-booking-webhook", "webhook", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return ok({ success: false, error: err.message });
  }
});

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

  // Always return 200 to Channex
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
    const { event, property_id: channexPropertyId, payload } = body;

    if (event !== "booking") {
      return ok({ success: true, message: `Ignored event: ${event}` });
    }

    const {
      id: revisionId,
      booking_id,
      status,
      ota_name,
      ota_reservation_code,
      arrival_date,
      departure_date,
      customer,
      rooms,
      amount,
      currency,
    } = payload;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Resolve local property ID ---
    const { data: propMapping } = await supabase
      .from("channex_mappings")
      .select("local_id")
      .eq("channex_id", channexPropertyId)
      .eq("entity_type", "property")
      .maybeSingle();

    if (!propMapping) {
      console.error(`[channex-booking-webhook] No local property for Channex ID ${channexPropertyId}`);
      await logSync("channex-booking-webhook", "webhook", body, null, null, false, `Unknown property: ${channexPropertyId}`, null);
      return ok({ success: false, error: "Unknown property" });
    }

    const localPropertyId = propMapping.local_id;

    // --- Resolve room type & rate plan (best effort) ---
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
    const guestEmail = customer?.mail || "unknown@unknown.com";
    const guestPhone = customer?.phone || null;

    // --- Execute DB operation ---
    let dbError: string | null = null;

    if (status === "cancelled") {
      const { error } = await supabase
        .from("channex_bookings")
        .update({ status: "cancelled", channex_revision_id: revisionId, booking_data: payload })
        .eq("channex_booking_id", booking_id);
      if (error) dbError = error.message;
    } else {
      // Upsert for both "new" and "modified"
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
        booking_data: payload,
        acknowledged: false,
      };

      // If this webhook also creates a local reservation, set skip_channex_sync
      // to prevent the trigger from pushing it back to Channex
      // (The channex_bookings table itself doesn't have this flag —
      //  it's for the reservations table when a local reservation is created from this booking)

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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync, createAlert } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // For non-booking events, log immediately and return
    if (event !== "booking") {
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

    console.log("[channex-booking-webhook] booking_id:", booking_id, "revisionId:", revisionId);

    // --- Idempotency: skip if this revision was already fully processed ---
    if (revisionId && !String(revisionId).startsWith('test-')) {
      const { data: alreadyProcessed } = await supabase
        .from("channex_bookings")
        .select("id")
        .eq("channex_revision_id", revisionId)
        .eq("acknowledged", true)
        .maybeSingle();

      if (alreadyProcessed) {
        console.log("[channex-booking-webhook] Revision already processed:", revisionId);
        return ok({ success: true, booking_id, status: "already_processed", revision_id: revisionId });
      }
    }

    // --- Log incoming booking event (after dedup check) ---
    const { error: immediateLogError } = await supabase
      .from("channex_sync_logs")
      .insert({
        function_name: "channex-booking-webhook",
        endpoint: "webhook",
        request_payload: body,
        response_payload: { event: "booking" },
        status_code: 200,
        success: true,
        error_message: null,
        property_id: (body.property_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.property_id)) ? body.property_id : null,
      });
    if (immediateLogError) {
      console.error("[channex-booking-webhook] Failed to write immediate log:", immediateLogError);
    }

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
      enrichedData.arrival_date || enrichedData.arrivalDate ||
      enrichedData.check_in || enrichedData.checkin ||
      enrichedData.checkin_date || rawPayload.arrival_date || null;

    const departure_date =
      enrichedData.departure_date || enrichedData.departureDate ||
      enrichedData.check_out || enrichedData.checkout ||
      enrichedData.checkout_date || rawPayload.departure_date || null;

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
    const guestCountry = customer?.country || enrichedData.guest_country || null;

    // --- Guest counts ---
    const adults = enrichedData.adults || enrichedData.occupancy?.adults || bookingData.adults || 1;
    const children = enrichedData.children || enrichedData.occupancy?.children || bookingData.children || 0;
    const numberOfGuests = (parseInt(adults) || 1) + (parseInt(children) || 0);

    // --- Execute DB operation on channex_bookings ---
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
        guest_country: guestCountry,
        arrival_date,
        departure_date,
        total_amount: parseFloat(amount) || 0,
        currency: currency || "USD",
        booking_data: body,
        acknowledged: false,
        adults: parseInt(adults) || 1,
        children: parseInt(children) || 0,
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

    // ================================================================
    // CREATE/UPDATE RESERVATION IN reservations TABLE
    // ================================================================
    let reservationResult: string | null = null;

    if (arrival_date && departure_date && booking_id) {
      try {
        if (status === "cancelled") {
          // Cancel existing reservation
          const { data: updated, error: cancelErr } = await supabase
            .from("reservations")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              skip_channex_sync: true,
            })
            .eq("channex_booking_id", booking_id)
            .select("id")
            .maybeSingle();

          if (cancelErr) {
            console.error("[channex-booking-webhook] Cancel reservation error:", cancelErr.message);
          } else if (updated) {
            reservationResult = `cancelled:${updated.id}`;
            console.log("[channex-booking-webhook] Reservation cancelled:", updated.id);
          } else {
            console.log("[channex-booking-webhook] No reservation found to cancel for:", booking_id);
          }
        } else {
          // Check if reservation already exists (idempotency)
          const { data: existing } = await supabase
            .from("reservations")
            .select("id")
            .eq("channex_booking_id", booking_id)
            .maybeSingle();

          if (existing) {
            // Update existing reservation
            const { error: updateErr } = await supabase
              .from("reservations")
              .update({
                check_in_date: arrival_date,
                check_out_date: departure_date,
                guest_names: [guestName],
                contact_email: guestEmail !== "unknown@unknown.com" ? guestEmail : null,
                contact_phone: guestPhone,
                guest_nationality: guestCountry,
                total_price: parseFloat(amount) || null,
                currency: currency || "USD",
                number_of_guests: numberOfGuests,
                adults: parseInt(adults) || 1,
                children: parseInt(children) || 0,
                skip_channex_sync: true,
              })
              .eq("id", existing.id);

            if (updateErr) {
              console.error("[channex-booking-webhook] Update reservation error:", updateErr.message);
            } else {
              reservationResult = `updated:${existing.id}`;
              console.log("[channex-booking-webhook] Reservation updated:", existing.id);
            }
          } else {
            // Allocate a unit
            let allocatedUnitId: string | null = null;

            if (roomTypeId) {
              // roomTypeId from channex_mappings points to a unit; get its booking_com_name
              const { data: mappedUnit } = await supabase
                .from("units")
                .select("booking_com_name, property_id")
                .eq("id", roomTypeId)
                .maybeSingle();

              if (mappedUnit?.booking_com_name) {
                // Find all units of this room type in this property
                let unitsQuery = supabase
                  .from("units")
                  .select("id")
                  .eq("booking_com_name", mappedUnit.booking_com_name)
                  .neq("status", "maintenance");

                if (localPropertyId) {
                  unitsQuery = unitsQuery.eq("property_id", localPropertyId);
                }

                const { data: candidateUnits } = await unitsQuery;

                if (candidateUnits && candidateUnits.length > 0) {
                  // Try each unit for availability using RPC
                  for (const candidate of candidateUnits) {
                    const { data: availResult } = await supabase.rpc(
                      "check_and_lock_unit_availability",
                      {
                        p_unit_id: candidate.id,
                        p_check_in_date: arrival_date,
                        p_check_out_date: departure_date,
                      }
                    );

                    if (availResult && availResult.length > 0 && availResult[0].is_available) {
                      allocatedUnitId = candidate.id;
                      break;
                    }
                  }
                }
              }
            }

            const bookingRef = ota_reservation_code || booking_id;

            const reservationRecord = {
              channex_booking_id: booking_id,
              booking_reference: bookingRef,
              check_in_date: arrival_date,
              check_out_date: departure_date,
              guest_names: [guestName],
              contact_email: guestEmail !== "unknown@unknown.com" ? guestEmail : null,
              contact_phone: guestPhone,
              guest_nationality: guestCountry,
              status: allocatedUnitId ? "confirmed" : "confirmed",
              channel: "Channex",
              source: ota_name || "Channex",
              property_id: localPropertyId,
              unit_id: allocatedUnitId,
              total_price: parseFloat(amount) || null,
              currency: currency || "USD",
              number_of_guests: numberOfGuests,
              adults: parseInt(adults) || 1,
              children: parseInt(children) || 0,
              skip_channex_sync: true,
            };

            const { data: newRes, error: insertErr } = await supabase
              .from("reservations")
              .insert(reservationRecord)
              .select("id")
              .maybeSingle();

            if (insertErr) {
              console.error("[channex-booking-webhook] Insert reservation error:", insertErr.message);
              await createAlert(
                "webhook_error",
                `Failed to create reservation for Channex booking ${booking_id}: ${insertErr.message}`,
                localPropertyId
              );
            } else if (newRes) {
              reservationResult = `created:${newRes.id}`;
              console.log("[channex-booking-webhook] Reservation created:", newRes.id, "unit:", allocatedUnitId || "none");

              if (!allocatedUnitId) {
                await createAlert(
                  "booking_unassigned",
                  `Channex booking ${bookingRef} (${guestName}) has no unit assigned. Please assign manually.`,
                  localPropertyId
                );
              }
            }
          }
        }
      } catch (resErr: any) {
        console.error("[channex-booking-webhook] Reservation creation error:", resErr.message);
        await createAlert(
          "webhook_error",
          `Exception creating reservation for ${booking_id}: ${resErr.message}`,
          localPropertyId
        );
      }
    } else {
      console.warn("[channex-booking-webhook] Missing dates or booking_id, skipping reservation creation");
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

    await logSync("channex-booking-webhook", "webhook", body, { status, booking_id, ack: ackSuccess, reservation: reservationResult }, 200, true, null, localPropertyId);

    return ok({ success: true, booking_id, status, acknowledged: ackSuccess, reservation: reservationResult });
  } catch (err: any) {
    console.error("[channex-booking-webhook] Error:", err);
    try {
      await logSync("channex-booking-webhook", "webhook", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return ok({ success: false, error: err.message });
  }
});


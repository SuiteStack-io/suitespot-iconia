import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync, createAlert } from "../_shared/channex-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Reference-only matching: Try 1 only (booking_reference). Used for NEW bookings.
async function findReservationByReference(
  supabase: any,
  otaReservationCode: string | null,
  incomingChannexId: string | null
): Promise<{ id: string; channex_booking_id: string | null; check_in_date: string; check_out_date: string; unit_id: string | null; guest_names: string[] } | null> {
  if (!otaReservationCode) return null;

  const { data } = await supabase
    .from("reservations")
    .select("id, channex_booking_id, check_in_date, check_out_date, unit_id, guest_names")
    .eq("booking_reference", otaReservationCode)
    .neq("status", "cancelled")
    .maybeSingle();

  if (data) {
    // Safeguard: if reservation already has a DIFFERENT channex_booking_id, skip it
    if (data.channex_booking_id && incomingChannexId && data.channex_booking_id !== incomingChannexId) {
      console.log("[channex-booking-webhook] Reference match skipped — reservation already linked to different channex_booking_id:", data.channex_booking_id, "vs incoming:", incomingChannexId);
      return null;
    }
    console.log("[channex-booking-webhook] Reference match by booking_reference:", otaReservationCode, "→", data.id);
    return data;
  }
  return null;
}

// Full fallback matching: Try 1 + strict Try 2. Used for CANCELLATIONS and MODIFICATIONS only.
async function findReservationByFallback(
  supabase: any,
  otaReservationCode: string | null,
  guestName: string | null,
  checkIn: string | null,
  checkOut: string | null,
  propertyId: string | null,
  incomingChannexId: string | null
): Promise<{ id: string; channex_booking_id: string | null; check_in_date: string; check_out_date: string; unit_id: string | null; guest_names: string[] } | null> {
  // Try 1: Match by booking_reference = ota_reservation_code
  const refMatch = await findReservationByReference(supabase, otaReservationCode, incomingChannexId);
  if (refMatch) return refMatch;

  // Try 2: Strict fuzzy match — guest name + EXACT check_in + EXACT check_out + source
  if (guestName && checkIn && checkOut && propertyId) {
    const { data } = await supabase
      .from("reservations")
      .select("id, channex_booking_id, check_in_date, check_out_date, unit_id, guest_names")
      .eq("check_in_date", checkIn)
      .eq("check_out_date", checkOut)
      .eq("property_id", propertyId)
      .neq("status", "cancelled")
      .ilike("source", "%booking%");

    if (data?.length) {
      const firstName = guestName.split(" ")[0].toLowerCase();
      const nameMatches = data.filter((r: any) =>
        r.guest_names?.some((n: string) => n.toLowerCase().includes(firstName))
      );

      // Only use if exactly ONE match — multiple matches = ambiguous, skip
      if (nameMatches.length === 1) {
        const match = nameMatches[0];
        // Safeguard: skip if reservation already linked to a different channex_booking_id
        if (match.channex_booking_id && incomingChannexId && match.channex_booking_id !== incomingChannexId) {
          console.log("[channex-booking-webhook] Fuzzy match skipped — reservation already linked to different channex_booking_id:", match.channex_booking_id, "vs incoming:", incomingChannexId);
          return null;
        }
        console.log("[channex-booking-webhook] Strict fuzzy match (1 of 1):", match.id);
        return match;
      } else if (nameMatches.length > 1) {
        console.log("[channex-booking-webhook] Fuzzy match skipped — multiple matches found:", nameMatches.length);
      }
      // No single-result fallback — if no name match or multiple, return null
    }
  }

  return null;
}

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

    // --- Idempotency: skip if this revision was already processed ---
    if (revisionId && !String(revisionId).startsWith('test-')) {
      const { data: alreadyProcessed } = await supabase
        .from("channex_sync_logs")
        .select("id")
        .eq("function_name", "channex-booking-webhook")
        .filter("request_payload->payload->>revision_id", "eq", revisionId)
        .limit(1)
        .maybeSingle();

      if (alreadyProcessed) {
        console.log("[channex-booking-webhook] Revision already processed:", revisionId);
        return ok({ success: true, booking_id, status: "already_processed", revision_id: revisionId });
      }
    }


    // --- Detect test payloads ---
    const isTestProperty = !channexPropertyId || channexPropertyId.startsWith('test-') || channexPropertyId === 'test-property-id';
    const isTestBooking = !booking_id || String(booking_id).startsWith('test-');

    // --- Enrich thin payloads by fetching revision from Channex API ---
    let enrichedData = bookingData;
    const isTestRevision = !revisionId || String(revisionId).startsWith('test-');
    if (!bookingData.arrival_date && !bookingData.check_in && revisionId && !isTestRevision) {
      console.log("[channex-booking-webhook] Thin payload detected, fetching revision from API...");
      try {
        const revisionResponse: any = await channexRequest("GET", `/api/v1/booking_revisions/${revisionId}`);
        const revisionData = revisionResponse?.data?.attributes || revisionResponse?.data || revisionResponse;
        const bookingFromRevision = revisionData?.booking || revisionData;
        enrichedData = { ...bookingData, ...bookingFromRevision };
        console.log("[channex-booking-webhook] Enriched from revision API, keys:", Object.keys(enrichedData));
      } catch (fetchErr: any) {
        console.warn("[channex-booking-webhook] Could not fetch booking revision:", fetchErr.message);
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

    // --- Resolve effective stay dates (prefer room-level, fallback to top-level) ---
    const roomsList = enrichedData.rooms || bookingData.rooms;
    const firstRoomDates = roomsList?.[0] || {};
    const effectiveCheckIn: string | null =
      firstRoomDates.checkin_date || firstRoomDates.check_in_date || firstRoomDates.arrival_date ||
      arrival_date || null;
    const effectiveCheckOut: string | null =
      firstRoomDates.checkout_date || firstRoomDates.check_out_date || firstRoomDates.departure_date ||
      departure_date || null;

    console.log("[channex-booking-webhook] Resolved effective dates:", { effectiveCheckIn, effectiveCheckOut, roomLevel: !!firstRoomDates.checkin_date, topLevel: { arrival_date, departure_date } });

    const customer = enrichedData.customer || bookingData.customer;
    const rooms = roomsList;
    const amount = enrichedData.amount || enrichedData.total_amount || bookingData.amount || bookingData.total_amount;
    const currency = enrichedData.currency || bookingData.currency;

    // Extract OTA commission if available
    const otaCommissionRaw = enrichedData.ota_commission || enrichedData.commission || bookingData.ota_commission || null;
    const otaCommission = otaCommissionRaw ? parseFloat(String(otaCommissionRaw)) || null : null;

    const arrival_hour =
      enrichedData.arrival_hour || enrichedData.arrivalHour ||
      enrichedData.check_in_time || bookingData.arrival_hour || null;

    console.log("[channex-booking-webhook] Extracted dates:", { arrival_date, departure_date, effectiveCheckIn, effectiveCheckOut, arrival_hour });

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
    let oldArrivalDate: string | null = null;
    let oldDepartureDate: string | null = null;

    if (arrival_date && departure_date && booking_id) {
      try {
        if (status === "cancelled") {
          // Capture old dates before cancelling — try by channex_booking_id first
          const { data: cancelExisting } = await supabase
            .from("reservations")
            .select("id, check_in_date, check_out_date, unit_id, guest_names")
            .eq("channex_booking_id", booking_id)
            .maybeSingle();

          // Fallback matching if no direct match
          const cancelTarget = cancelExisting || await findReservationByFallback(
            supabase, ota_reservation_code, guestName, effectiveCheckIn, effectiveCheckOut, localPropertyId
          );

          if (cancelTarget) {
            oldArrivalDate = cancelTarget.check_in_date;
            oldDepartureDate = cancelTarget.check_out_date;

            // Cancel the reservation and stamp channex_booking_id for future matching
            const { data: updated, error: cancelErr } = await supabase
              .from("reservations")
              .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
                skip_channex_sync: true,
                channex_booking_id: booking_id,
              })
              .eq("id", cancelTarget.id)
              .select("id")
              .maybeSingle();

            if (cancelErr) {
              console.error("[channex-booking-webhook] Cancel reservation error:", cancelErr.message);
            } else if (updated) {
              reservationResult = `cancelled:${updated.id}`;
              console.log("[channex-booking-webhook] Reservation cancelled:", updated.id, cancelExisting ? "(direct match)" : "(fallback match)");
            }
          } else {
            // No match at all — send unmatched cancellation alert
            console.log("[channex-booking-webhook] No reservation found to cancel for:", booking_id, "— sending unmatched alert");
            await createAlert(
              "unmatched_cancellation",
              `Channex cancellation could not be matched to a PMS reservation. Guest: ${guestName}, Dates: ${effectiveCheckIn} to ${effectiveCheckOut}, Ref: ${ota_reservation_code || booking_id}`,
              localPropertyId
            );

            // Send alert email via cancellation notification with unmatched flag
            const supabaseUrlForAlert = Deno.env.get("SUPABASE_URL")!;
            const serviceKeyForAlert = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            try {
              const alertNightCount = effectiveCheckIn && effectiveCheckOut
                ? Math.ceil((new Date(effectiveCheckOut).getTime() - new Date(effectiveCheckIn).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              await fetch(`${supabaseUrlForAlert}/functions/v1/send-cancellation-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceKeyForAlert}`,
                },
                body: JSON.stringify({
                  reservation_id: null,
                  booking_reference: ota_reservation_code || booking_id || "Unknown",
                  guest_names: [guestName],
                  check_in_date: effectiveCheckIn,
                  check_out_date: effectiveCheckOut,
                  nights: alertNightCount,
                  total_price: parseFloat(String(amount)) || 0,
                  currency: currency || "USD",
                  channel: "Channex",
                  source: ota_name || "Channex",
                  property_id: localPropertyId,
                }),
              });
              console.log("[channex-booking-webhook] Unmatched cancellation alert email sent");
            } catch (alertErr: any) {
              console.error("[channex-booking-webhook] Unmatched cancellation alert email failed:", alertErr.message);
            }
          }
        } else {
          // Check if reservation already exists (idempotency) — direct match first, then fallback
          const { data: existingDirect } = await supabase
            .from("reservations")
            .select("id, check_in_date, check_out_date")
            .eq("channex_booking_id", booking_id)
            .maybeSingle();

          const existing = existingDirect || await findReservationByFallback(
            supabase, ota_reservation_code, guestName, effectiveCheckIn, effectiveCheckOut, localPropertyId
          );

          if (existing) {
            // Stamp channex_booking_id for future direct matching if found via fallback
            const stampChannexId = !existingDirect ? booking_id : undefined;
            // Capture old dates before updating (for availability restoration)
            oldArrivalDate = existing.check_in_date;
            oldDepartureDate = existing.check_out_date;
            // Update existing reservation
            // Calculate pricing fields for update
            const updTotalAmount = parseFloat(amount) || null;
            const updNightCount = (() => {
              if (!arrival_date || !departure_date) return 0;
              const d1 = new Date(arrival_date);
              const d2 = new Date(departure_date);
              return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
            })();
            const updPricePerNight = updTotalAmount && updNightCount > 0 ? Number((updTotalAmount / updNightCount).toFixed(2)) : null;
            const updCommissionAmount = otaCommission && otaCommission > 0 ? otaCommission : null;
            const updCommissionRate = updCommissionAmount && updTotalAmount && updTotalAmount > 0
              ? Number(((updCommissionAmount / updTotalAmount) * 100).toFixed(2)) : null;
            const updNetRevenue = updTotalAmount && updCommissionAmount
              ? Number((updTotalAmount - updCommissionAmount).toFixed(2)) : null;

            const updatePayload: Record<string, any> = {
                check_in_date: arrival_date,
                check_out_date: departure_date,
                guest_names: [guestName],
                contact_email: guestEmail !== "unknown@unknown.com" ? guestEmail : null,
                contact_phone: guestPhone,
                guest_nationality: guestCountry,
                total_price: updTotalAmount,
                price_per_night: updPricePerNight,
                commission_amount: updCommissionAmount,
                commission_rate: updCommissionRate,
                net_revenue: updNetRevenue,
                currency: currency || "USD",
                number_of_guests: numberOfGuests,
                adults: parseInt(adults) || 1,
                children: parseInt(children) || 0,
                arrival_time: arrival_hour,
                skip_channex_sync: true,
              };
            // Stamp channex_booking_id if matched via fallback
            if (stampChannexId) {
              updatePayload.channex_booking_id = stampChannexId;
            }

            const { error: updateErr } = await supabase
              .from("reservations")
              .update(updatePayload)
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

            // Calculate pricing fields for OTA reservations
            const totalAmount = parseFloat(amount) || null;
            const nightCount = (() => {
              if (!arrival_date || !departure_date) return 0;
              const d1 = new Date(arrival_date);
              const d2 = new Date(departure_date);
              return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
            })();
            const calcPricePerNight = totalAmount && nightCount > 0 ? Number((totalAmount / nightCount).toFixed(2)) : null;
            const calcCommissionAmount = otaCommission && otaCommission > 0 ? otaCommission : null;
            const calcCommissionRate = calcCommissionAmount && totalAmount && totalAmount > 0
              ? Number(((calcCommissionAmount / totalAmount) * 100).toFixed(2)) : null;
            const calcNetRevenue = totalAmount && calcCommissionAmount
              ? Number((totalAmount - calcCommissionAmount).toFixed(2)) : null;

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
              total_price: totalAmount,
              price_per_night: calcPricePerNight,
              commission_amount: calcCommissionAmount,
              commission_rate: calcCommissionRate,
              net_revenue: calcNetRevenue,
              currency: currency || "USD",
              number_of_guests: numberOfGuests,
              adults: parseInt(adults) || 1,
              children: parseInt(children) || 0,
              arrival_time: arrival_hour,
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
                // Invoke auto-assign-rooms to find the best room
                try {
                  const assignResponse = await fetch(
                    `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-assign-rooms`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      },
                      body: JSON.stringify({ reservation_ids: [newRes.id] }),
                    }
                  );
                  const assignResult = await assignResponse.json();
                  console.log("[channex-booking-webhook] auto-assign-rooms result:", JSON.stringify(assignResult));

                  if (assignResult.assigned?.length > 0) {
                    console.log(`[channex-booking-webhook] Auto-assigned room: ${assignResult.assigned[0].room_number}`);
                  } else if (assignResult.conflicts?.length > 0) {
                    // Conflict email already sent by auto-assign-rooms; also create alert
                    await createAlert(
                      "booking_unassigned",
                      `Channex booking ${bookingRef} (${guestName}) could not be auto-assigned: ${assignResult.conflicts[0].reason}`,
                      localPropertyId
                    );
                  }
                } catch (autoAssignErr: any) {
                  console.error("[channex-booking-webhook] auto-assign-rooms invoke failed:", autoAssignErr.message);
                  await createAlert(
                    "booking_unassigned",
                    `Channex booking ${bookingRef} (${guestName}) has no unit assigned. Auto-assign failed. Please assign manually.`,
                    localPropertyId
                  );
                }
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

      // ================================================================
      // SEND EMAIL NOTIFICATIONS (same templates as manual reservations)
      // ================================================================
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      if (reservationResult) {
        const resId = reservationResult.split(":")[1];

        // Fetch full reservation + unit for notification payload
        const { data: fullRes } = await supabase
          .from("reservations")
          .select("*, units:unit_id(name, room_number, room_type)")
          .eq("id", resId)
          .maybeSingle();

        if (fullRes) {
          const unitData = fullRes.units as any;

          if (reservationResult.startsWith("created:")) {
            // --- New booking notification ---
            try {
              console.log("[channex-booking-webhook] Sending new reservation notification for:", resId);
              const notifResponse = await fetch(`${supabaseUrl}/functions/v1/send-reservation-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  reservationId: fullRes.id,
                  guestNames: fullRes.guest_names,
                  checkIn: fullRes.check_in_date,
                  checkOut: fullRes.check_out_date,
                  unitName: unitData?.name || null,
                  unitId: fullRes.unit_id,
                  unitType: unitData?.room_type || null,
                  totalPrice: fullRes.total_price,
                  numberOfGuests: fullRes.number_of_guests,
                  adults: fullRes.adults,
                  children: fullRes.children,
                  source: fullRes.source,
                  notes: fullRes.notes,
                  guestNationality: fullRes.guest_nationality,
                  customerEmail: fullRes.contact_email,
                  customerPhone: fullRes.contact_phone,
                  property_id: fullRes.property_id,
                }),
              });
              const notifText = await notifResponse.text();
              console.log("[channex-booking-webhook] New reservation notification response:", notifResponse.status, notifText);
            } catch (notifErr: any) {
              console.error("[channex-booking-webhook] New reservation notification failed (non-fatal):", notifErr.message);
            }
          } else if (reservationResult.startsWith("updated:")) {
            // --- Modified booking notification ---
            try {
              console.log("[channex-booking-webhook] Sending modification notification for:", resId);
              const modifResponse = await fetch(`${supabaseUrl}/functions/v1/send-modification-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  booking_reference: fullRes.booking_reference,
                  guest_names: fullRes.guest_names,
                  room_name: unitData?.name || null,
                  room_number: unitData?.room_number || null,
                  old_check_in: oldArrivalDate || fullRes.check_in_date,
                  old_check_out: oldDepartureDate || fullRes.check_out_date,
                  new_check_in: fullRes.check_in_date,
                  new_check_out: fullRes.check_out_date,
                  old_total_price: fullRes.total_price,
                  new_total_price: fullRes.total_price,
                  currency: fullRes.currency || "USD",
                  channel: fullRes.channel,
                  source: fullRes.source,
                  property_id: fullRes.property_id,
                }),
              });
              const modifText = await modifResponse.text();
              console.log("[channex-booking-webhook] Modification notification response:", modifResponse.status, modifText);
            } catch (notifErr: any) {
              console.error("[channex-booking-webhook] Modification notification failed (non-fatal):", notifErr.message);
            }
          } else if (reservationResult.startsWith("cancelled:")) {
            // --- Cancelled booking notification ---
            try {
              const nightCount = effectiveCheckIn && effectiveCheckOut
                ? Math.ceil((new Date(effectiveCheckOut).getTime() - new Date(effectiveCheckIn).getTime()) / (1000 * 60 * 60 * 24))
                : fullRes.nights || 0;

              console.log("[channex-booking-webhook] Sending cancellation notification for:", resId);
              const cancelResponse = await fetch(`${supabaseUrl}/functions/v1/send-cancellation-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({
                  reservation_id: fullRes.id,
                  booking_reference: fullRes.booking_reference,
                  guest_names: fullRes.guest_names,
                  check_in_date: oldArrivalDate || fullRes.check_in_date,
                  check_out_date: oldDepartureDate || fullRes.check_out_date,
                  nights: nightCount,
                  total_price: fullRes.total_price,
                  currency: fullRes.currency || "USD",
                  channel: fullRes.channel,
                  source: fullRes.source,
                  unit_name: unitData?.name || null,
                  unit_number: unitData?.room_number || null,
                  property_id: fullRes.property_id,
                }),
              });
              const cancelText = await cancelResponse.text();
              console.log("[channex-booking-webhook] Cancellation notification response:", cancelResponse.status, cancelText);
            } catch (notifErr: any) {
              console.error("[channex-booking-webhook] Cancellation notification failed (non-fatal):", notifErr.message);
            }
          }
        }
      }
    } else {
      console.warn("[channex-booking-webhook] Missing dates or booking_id, skipping reservation creation");
    }

    // --- ACK the revision ---
    let ackSuccess = false;
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

    // ================================================================
    // PUSH UPDATED AVAILABILITY TO CHANNEX
    // ================================================================
    let availabilityPushResult: string | null = null;
    try {
      if (!isTestProperty && channexPropertyId && effectiveCheckIn && effectiveCheckOut) {
        // Guard: effectiveCheckOut must be after effectiveCheckIn
        if (effectiveCheckOut <= effectiveCheckIn) {
          console.error("[channex-booking-webhook] Invalid date range for availability push:", { effectiveCheckIn, effectiveCheckOut });
        } else {
        // Resolve Channex room_type_id
        let channexRoomTypeId: string | null = rooms?.[0]?.room_type_id || null;
        if (!channexRoomTypeId && roomTypeId) {
          const { data: rtMapping } = await supabase
            .from("channex_mappings")
            .select("channex_id")
            .eq("local_id", roomTypeId)
            .eq("entity_type", "room_type")
            .maybeSingle();
          if (rtMapping) channexRoomTypeId = rtMapping.channex_id;
        }

        if (channexRoomTypeId) {
          // Resolve booking_com_name and count total units
          let bookingComName: string | null = null;
          if (roomTypeId) {
            const { data: unitData } = await supabase
              .from("units")
              .select("booking_com_name")
              .eq("id", roomTypeId)
              .maybeSingle();
            if (unitData) bookingComName = unitData.booking_com_name;
          }

          if (bookingComName && localPropertyId) {
            const { data: allUnits } = await supabase
              .from("units")
              .select("id")
              .eq("booking_com_name", bookingComName)
              .eq("property_id", localPropertyId)
              .neq("status", "maintenance");

            const totalUnits = allUnits?.length || 0;

            const unitIds = allUnits?.map((u: any) => u.id) || [];

            // Helper to calculate and push per-day availability for a date range
            // dateFrom = inclusive check-in day, dateTo = exclusive checkout day
            const pushScopedAvailForRange = async (dateFrom: string, dateTo: string, label: string) => {
              // Compute the last occupied night (dateTo - 1 day)
              const lastOccupied = new Date(dateTo + "T00:00:00Z");
              lastOccupied.setUTCDate(lastOccupied.getUTCDate() - 1);
              const lastOccupiedStr = lastOccupied.toISOString().split("T")[0];

              console.log(`[channex-booking-webhook] pushScopedAvailForRange(${label}): dateFrom=${dateFrom}, dateTo=${dateTo}, lastOccupiedNight=${lastOccupiedStr}`);

              // Fetch all overlapping reservations for the range
              const { data: overlappingRes } = await supabase
                .from("reservations")
                .select("check_in_date, check_out_date, unit_id")
                .in("unit_id", unitIds)
                .in("status", ["confirmed", "checked-in"])
                .lt("check_in_date", dateTo)
                .gt("check_out_date", dateFrom);

              // Fetch blocked dates in the range
              const { data: blockedDates } = await supabase
                .from("blocked_dates")
                .select("blocked_date, unit_id")
                .in("unit_id", unitIds)
                .gte("blocked_date", dateFrom)
                .lte("blocked_date", lastOccupiedStr);

              const reservations = overlappingRes || [];
              const blocks = blockedDates || [];

              // Build day-by-day availability from dateFrom to lastOccupied (inclusive)
              const dayAvailabilities: { date: string; availability: number }[] = [];
              const cursor = new Date(dateFrom + "T00:00:00Z");
              const endInclusive = new Date(lastOccupiedStr + "T00:00:00Z");

              while (cursor <= endInclusive) {
                const ds = cursor.toISOString().split("T")[0];

                // Count occupied units: check_in_date <= ds AND check_out_date > ds
                const occupiedUnitIds = new Set<string>();
                for (const r of reservations) {
                  if (r.check_in_date <= ds && r.check_out_date > ds && r.unit_id) {
                    occupiedUnitIds.add(r.unit_id);
                  }
                }
                for (const b of blocks) {
                  if (b.blocked_date === ds && b.unit_id) {
                    occupiedUnitIds.add(b.unit_id);
                  }
                }

                const avail = Math.max(0, totalUnits - occupiedUnitIds.size);
                dayAvailabilities.push({ date: ds, availability: avail });

                cursor.setUTCDate(cursor.getUTCDate() + 1);
              }

              console.log(`[channex-booking-webhook] Day-by-day (${label}): ${dayAvailabilities.length} days, first=${dayAvailabilities[0]?.date}, last=${dayAvailabilities[dayAvailabilities.length - 1]?.date}`);

              if (dayAvailabilities.length === 0) return totalUnits;

              // Collapse consecutive days with the same availability into ranges
              const values: { property_id: string; room_type_id: string; date_from: string; date_to: string; availability: number }[] = [];
              let rangeStart = dayAvailabilities[0].date;
              let rangeEnd = dayAvailabilities[0].date;
              let rangeAvail = dayAvailabilities[0].availability;

              for (let i = 1; i < dayAvailabilities.length; i++) {
                if (dayAvailabilities[i].availability === rangeAvail) {
                  rangeEnd = dayAvailabilities[i].date;
                } else {
                  values.push({
                    property_id: channexPropertyId,
                    room_type_id: channexRoomTypeId!,
                    date_from: rangeStart,
                    date_to: rangeEnd,
                    availability: rangeAvail,
                  });
                  rangeStart = dayAvailabilities[i].date;
                  rangeEnd = dayAvailabilities[i].date;
                  rangeAvail = dayAvailabilities[i].availability;
                }
              }
              // Push final range
              values.push({
                property_id: channexPropertyId,
                room_type_id: channexRoomTypeId!,
                date_from: rangeStart,
                date_to: rangeEnd,
                availability: rangeAvail,
              });

              const availPayload = { values };
              console.log(`[channex-booking-webhook] Pushing availability (${label}):`, JSON.stringify(availPayload));
              const availResponse = await channexRequest("POST", "/api/v1/availability", availPayload);
              console.log(`[channex-booking-webhook] Availability push response (${label}):`, JSON.stringify(availResponse));

              await supabase.from("channex_sync_logs").insert({
                function_name: "channex-booking-webhook",
                endpoint: "/api/v1/availability",
                request_payload: availPayload,
                response_payload: availResponse as any,
                status_code: 200,
                success: true,
                error_message: null,
                property_id: localPropertyId,
              });

              return dayAvailabilities[0].availability;
            };

            if (status === "cancelled" && oldArrivalDate && oldDepartureDate) {
              // Restore availability for cancelled date range
              const avail = await pushScopedAvailForRange(oldArrivalDate, oldDepartureDate, "cancellation-restore");
              availabilityPushResult = `cancelled-restore:${avail}`;
            } else if (oldArrivalDate && oldDepartureDate && (oldArrivalDate !== effectiveCheckIn || oldDepartureDate !== effectiveCheckOut)) {
              // Modification: push for both old and new ranges
              const oldAvail = await pushScopedAvailForRange(oldArrivalDate, oldDepartureDate, "modification-old-range");
              const newAvail = await pushScopedAvailForRange(effectiveCheckIn, effectiveCheckOut, "modification-new-range");
              availabilityPushResult = `modified:old=${oldAvail},new=${newAvail}`;
            } else {
              // New booking or same-date update
              const avail = await pushScopedAvailForRange(effectiveCheckIn, effectiveCheckOut, "new-booking");
              availabilityPushResult = `new:${avail}`;
            }

            console.log("[channex-booking-webhook] Availability push result:", availabilityPushResult);
          } else {
            console.warn("[channex-booking-webhook] Could not resolve booking_com_name or localPropertyId for availability push");
          }
        } else {
          console.warn("[channex-booking-webhook] No Channex room_type_id available for availability push");
        }
        } // end date guard
      }
    } catch (availErr: any) {
      console.error("[channex-booking-webhook] Availability push error (non-fatal):", availErr.message);
      availabilityPushResult = `error:${availErr.message}`;
      try {
        await supabase.from("channex_sync_logs").insert({
          function_name: "channex-booking-webhook",
          endpoint: "/api/v1/availability",
          request_payload: { booking_id, arrival_date, departure_date },
          response_payload: null,
          status_code: null,
          success: false,
          error_message: availErr.message,
          property_id: localPropertyId,
        });
      } catch (_e) { /* ignore logging failure */ }
    }

    await logSync("channex-booking-webhook", "webhook", body, { status, booking_id, ack: ackSuccess, reservation: reservationResult, availability: availabilityPushResult }, 200, true, null, localPropertyId);

    return ok({ success: true, booking_id, status, acknowledged: ackSuccess, reservation: reservationResult });
  } catch (err: any) {
    console.error("[channex-booking-webhook] Error:", err);
    try {
      await logSync("channex-booking-webhook", "webhook", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return ok({ success: false, error: err.message });
  }
});


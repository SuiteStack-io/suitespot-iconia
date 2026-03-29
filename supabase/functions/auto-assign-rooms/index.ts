import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { getPropertyName } from "../_shared/property-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AssignResult {
  reservation_id: string;
  room_id: string;
  room_number: string;
}

interface ConflictResult {
  reservation_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  reason: string;
}

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
    const { reservation_ids } = await req.json();

    if (!reservation_ids || !Array.isArray(reservation_ids) || reservation_ids.length === 0) {
      return ok({ success: false, error: "reservation_ids array is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the unassigned reservations
    const { data: reservations, error: fetchErr } = await supabase
      .from("reservations")
      .select("id, check_in_date, check_out_date, guest_names, property_id, unit_id, booking_reference")
      .in("id", reservation_ids)
      .is("unit_id", null)
      .in("status", ["confirmed", "pending_assignment"]);

    if (fetchErr) throw fetchErr;

    if (!reservations || reservations.length === 0) {
      return ok({ success: true, assigned: [], conflicts: [], message: "No unassigned reservations found" });
    }

    console.log(`[auto-assign-rooms] Processing ${reservations.length} unassigned reservations`);

    // We need to determine the room type for each reservation.
    // Since unit_id is null, we look at the channex_bookings table to find room_type_id,
    // or we use the booking_com_name from the property's units.
    // Strategy: look up channex_bookings by channex_booking_id on the reservation,
    // or if manual, we need the caller to specify room type.
    // For flexibility, also accept room_type_unit_id from channex_bookings.room_type_id

    // Group reservations by room type (booking_com_name)
    interface ReservationWithType {
      id: string;
      check_in_date: string;
      check_out_date: string;
      guest_names: string[];
      property_id: string | null;
      booking_reference: string;
      room_type_name: string | null;
      room_type_unit_id: string | null;
    }

    const enriched: ReservationWithType[] = [];

    for (const res of reservations) {
      // Try to find room type via channex_bookings
      const { data: channexBooking } = await supabase
        .from("channex_bookings")
        .select("room_type_id")
        .eq("channex_booking_id", res.booking_reference)
        .maybeSingle();

      let roomTypeName: string | null = null;
      let roomTypeUnitId: string | null = channexBooking?.room_type_id || null;

      if (roomTypeUnitId) {
        const { data: unitData } = await supabase
          .from("units")
          .select("booking_com_name")
          .eq("id", roomTypeUnitId)
          .maybeSingle();
        roomTypeName = unitData?.booking_com_name || null;
      }

      // If still no room type, try channex_booking_id field on reservation
      if (!roomTypeName) {
        const { data: channexByField } = await supabase
          .from("channex_bookings")
          .select("room_type_id")
          .eq("channex_booking_id", (res as any).channex_booking_id || "")
          .maybeSingle();

        if (channexByField?.room_type_id) {
          roomTypeUnitId = channexByField.room_type_id;
          const { data: unitData2 } = await supabase
            .from("units")
            .select("booking_com_name")
            .eq("id", roomTypeUnitId!)
            .maybeSingle();
          roomTypeName = unitData2?.booking_com_name || null;
        }
      }

      enriched.push({
        ...res,
        room_type_name: roomTypeName,
        room_type_unit_id: roomTypeUnitId,
      });
    }

    // Group by room type
    const byRoomType = new Map<string, ReservationWithType[]>();
    const noRoomType: ReservationWithType[] = [];

    for (const res of enriched) {
      if (res.room_type_name) {
        const group = byRoomType.get(res.room_type_name) || [];
        group.push(res);
        byRoomType.set(res.room_type_name, group);
      } else {
        noRoomType.push(res);
      }
    }

    const assigned: AssignResult[] = [];
    const conflicts: ConflictResult[] = [];

    // Process reservations with no room type as conflicts
    for (const res of noRoomType) {
      conflicts.push({
        reservation_id: res.id,
        guest_name: res.guest_names?.[0] || "Unknown",
        check_in: res.check_in_date,
        check_out: res.check_out_date,
        reason: "No room type could be determined for this reservation.",
      });
    }

    // Process each room type group
    for (const [roomTypeName, groupReservations] of byRoomType) {
      const propertyId = groupReservations[0].property_id;

      // Step 1: Gather candidate rooms of this type
      let unitsQuery = supabase
        .from("units")
        .select("id, unit_number, name")
        .eq("booking_com_name", roomTypeName)
        .neq("status", "maintenance");

      if (propertyId) {
        unitsQuery = unitsQuery.eq("property_id", propertyId);
      }

      const { data: candidateUnits } = await unitsQuery;

      if (!candidateUnits || candidateUnits.length === 0) {
        for (const res of groupReservations) {
          conflicts.push({
            reservation_id: res.id,
            guest_name: res.guest_names?.[0] || "Unknown",
            check_in: res.check_in_date,
            check_out: res.check_out_date,
            reason: `No rooms of type "${roomTypeName}" are available in this property.`,
          });
        }
        continue;
      }

      // Determine date window with 1-day buffer
      const allCheckIns = groupReservations.map(r => r.check_in_date).sort();
      const allCheckOuts = groupReservations.map(r => r.check_out_date).sort();
      const windowStart = shiftDate(allCheckIns[0], -1);
      const windowEnd = shiftDate(allCheckOuts[allCheckOuts.length - 1], 1);

      const unitIds = candidateUnits.map(u => u.id);

      // Fetch existing reservations on these units within the window
      const { data: existingRes } = await supabase
        .from("reservations")
        .select("id, unit_id, check_in_date, check_out_date")
        .in("unit_id", unitIds)
        .in("status", ["confirmed", "checked-in"])
        .lt("check_in_date", windowEnd)
        .gt("check_out_date", windowStart);

      // Also fetch blocked dates
      const { data: blockedDates } = await supabase
        .from("blocked_dates")
        .select("unit_id, blocked_date")
        .in("unit_id", unitIds)
        .gte("blocked_date", windowStart)
        .lte("blocked_date", windowEnd);

      // Build occupancy map: unitId → list of occupied ranges
      const occupancyMap = new Map<string, { check_in: string; check_out: string }[]>();
      for (const unitId of unitIds) {
        occupancyMap.set(unitId, []);
      }
      for (const res of existingRes || []) {
        occupancyMap.get(res.unit_id)?.push({
          check_in: res.check_in_date,
          check_out: res.check_out_date,
        });
      }

      // Build blocked dates set per unit
      const blockedMap = new Map<string, Set<string>>();
      for (const unitId of unitIds) {
        blockedMap.set(unitId, new Set());
      }
      for (const bd of blockedDates || []) {
        blockedMap.get(bd.unit_id)?.add(bd.blocked_date);
      }

      // Step 3: Sort unassigned by check-in ascending
      const sorted = [...groupReservations].sort((a, b) =>
        a.check_in_date.localeCompare(b.check_in_date)
      );

      // Step 4: Greedy assignment
      for (const res of sorted) {
        let bestUnit: { id: string; unit_number: string; name: string } | null = null;
        let bestAvailableFrom: string | null = null;

        // Sort candidate units by unit_number for deterministic tiebreaker
        const sortedUnits = [...candidateUnits].sort((a, b) =>
          (a.unit_number || "").localeCompare(b.unit_number || "", undefined, { numeric: true })
        );

        for (const unit of sortedUnits) {
          const ranges = occupancyMap.get(unit.id) || [];
          const blocked = blockedMap.get(unit.id) || new Set();

          // Check for overlap with existing reservations
          const hasOverlap = ranges.some(
            r => r.check_in < res.check_out_date && r.check_out > res.check_in_date
          );
          if (hasOverlap) continue;

          // Check for blocked dates within the stay
          let hasBlocked = false;
          const stayStart = new Date(res.check_in_date);
          const stayEnd = new Date(res.check_out_date);
          for (let d = new Date(stayStart); d < stayEnd; d.setDate(d.getDate() + 1)) {
            if (blocked.has(d.toISOString().split("T")[0])) {
              hasBlocked = true;
              break;
            }
          }
          if (hasBlocked) continue;

          // Step 2: Calculate available-from date (last checkout on or before check-in)
          let availableFrom = "1970-01-01";
          for (const r of ranges) {
            if (r.check_out <= res.check_in_date && r.check_out > availableFrom) {
              availableFrom = r.check_out;
            }
          }

          // Pick tightest fit (closest available-from to check-in)
          if (!bestUnit || availableFrom > bestAvailableFrom!) {
            bestUnit = unit;
            bestAvailableFrom = availableFrom;
          }
        }

        if (bestUnit) {
          // Assign this reservation to bestUnit
          assigned.push({
            reservation_id: res.id,
            room_id: bestUnit.id,
            room_number: bestUnit.unit_number || bestUnit.name,
          });

          // Mark this unit as occupied for this range (for subsequent iterations)
          occupancyMap.get(bestUnit.id)?.push({
            check_in: res.check_in_date,
            check_out: res.check_out_date,
          });
        } else {
          // Try auto-shuffle before giving up
          console.log(`[auto-assign-rooms] No direct room available for ${res.id}, attempting auto-shuffle...`);
          try {
            const shuffleResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-shuffle-rooms`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  roomType: roomTypeName,
                  checkInDate: res.check_in_date,
                  checkOutDate: res.check_out_date,
                  bookingReference: res.booking_reference,
                  guestNames: res.guest_names || [],
                  triggerSource: "allocate-unit",
                  propertyId: propertyId,
                }),
              }
            );
            const shuffleResult = await shuffleResponse.json();

            if (shuffleResult.success && shuffleResult.freedUnitId) {
              // Shuffle freed a room — assign it
              const freedUnit = candidateUnits.find(u => u.id === shuffleResult.freedUnitId);
              assigned.push({
                reservation_id: res.id,
                room_id: shuffleResult.freedUnitId,
                room_number: freedUnit?.unit_number || freedUnit?.name || "shuffled",
              });
              occupancyMap.get(shuffleResult.freedUnitId)?.push({
                check_in: res.check_in_date,
                check_out: res.check_out_date,
              });
              console.log(`[auto-assign-rooms] Shuffle resolved: ${res.id} → ${shuffleResult.freedUnitId}`);
            } else {
              // Shuffle also failed
              conflicts.push({
                reservation_id: res.id,
                guest_name: res.guest_names?.[0] || "Unknown",
                check_in: res.check_in_date,
                check_out: res.check_out_date,
                reason: `No available room of type "${roomTypeName}" for the requested dates. Auto-shuffle also failed to resolve.`,
              });
            }
          } catch (shuffleErr: any) {
            console.error(`[auto-assign-rooms] Shuffle call failed:`, shuffleErr.message);
            conflicts.push({
              reservation_id: res.id,
              guest_name: res.guest_names?.[0] || "Unknown",
              check_in: res.check_in_date,
              check_out: res.check_out_date,
              reason: `No available room of type "${roomTypeName}". Auto-shuffle error: ${shuffleErr.message}`,
            });
          }
        }
      }
    }

    // Step 6: Save assignments
    for (const assignment of assigned) {
      const { error: updateErr } = await supabase
        .from("reservations")
        .update({
          unit_id: assignment.room_id,
          shuffled_from_unit_id: assignment.room_id, // bypass overlap trigger
        })
        .eq("id", assignment.reservation_id);

      if (updateErr) {
        console.error(`[auto-assign-rooms] Failed to assign ${assignment.reservation_id}:`, updateErr.message);
      } else {
        console.log(`[auto-assign-rooms] Assigned ${assignment.reservation_id} → ${assignment.room_number}`);
      }
    }

    // Log assignments to room_shuffle_log
    if (assigned.length > 0) {
      const firstRes = enriched.find(r => r.id === assigned[0].reservation_id);
      const propertyId = firstRes?.property_id;

      const logMoves = assigned.map(a => {
        const res = enriched.find(r => r.id === a.reservation_id);
        return {
          guest_name: res?.guest_names?.[0] || "Unknown",
          from_room_number: "unassigned",
          to_room_number: a.room_number,
          reservation_id: a.reservation_id,
          check_in: res?.check_in_date,
          check_out: res?.check_out_date,
        };
      });

      await supabase.from("room_shuffle_log").insert({
        shuffle_date: new Date().toISOString(),
        triggered_by_reference: assigned[0].reservation_id,
        room_type: enriched.find(r => r.id === assigned[0].reservation_id)?.room_type_name || "unknown",
        moves: logMoves,
        move_count: assigned.length,
        reason: "Auto-assign: rooms assigned to unassigned reservations",
        property_id: propertyId,
      });
    }

    // Step 5: Send conflict emails
    if (conflicts.length > 0) {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);

        // Get property name for email
        const firstConflictRes = enriched.find(r => r.id === conflicts[0].reservation_id);
        const propertyId = firstConflictRes?.property_id || null;
        const propertyName = await getPropertyName(supabase, propertyId);

        // Get admin emails
        const { data: profiles } = await supabase.from("profiles").select("id, full_name");
        const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
        const { data: authUsers } = await supabase.auth.admin.listUsers();

        const adminEmails = (profiles || [])
          .map((p: any) => {
            const auth = authUsers?.users?.find((u: any) => u.id === p.id);
            const role = userRoles?.find((r: any) => r.user_id === p.id);
            return { email: auth?.email, role: role?.role };
          })
          .filter((u: any) => u.email && ["admin", "front_desk"].includes(u.role))
          .map((u: any) => u.email);

        for (const conflict of conflicts) {
          const roomTypeName = enriched.find(r => r.id === conflict.reservation_id)?.room_type_name || "Unknown";

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ef4444;">Room Conflict Cannot Be Resolved</h2>
              <p style="color: #374151; font-size: 16px;">
                A new reservation could not be automatically assigned to a room.
              </p>
              <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
                <table style="width: 100%; font-size: 14px; color: #374151;">
                  <tr><td style="padding: 4px 0; font-weight: bold; width: 120px;">Property:</td><td>${propertyName}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: bold;">Guest:</td><td>${conflict.guest_name}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: bold;">Check-in:</td><td>${conflict.check_in}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: bold;">Checkout:</td><td>${conflict.check_out}</td></tr>
                  <tr><td style="padding: 4px 0; font-weight: bold;">Room Type:</td><td>${roomTypeName}</td></tr>
                </table>
              </div>
              <p style="color: #374151; font-size: 14px;">
                <strong>Reason:</strong> ${conflict.reason}
              </p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Please log in to SuiteSpot PMS and manually resolve this conflict.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
                <em>This is an automated notification from the SuiteSpot system.</em>
              </p>
            </div>
          `;

          for (const email of adminEmails) {
            try {
              await resend.emails.send({
                from: "SuiteSpot Notifications <notifications@bookings.suitespoteg.com>",
                to: [email],
                subject: `🚨 Room Conflict Cannot Be Resolved - ${conflict.guest_name} at ${propertyName}`,
                html: emailHtml,
              });
            } catch (emailErr: any) {
              console.error(`[auto-assign-rooms] Email to ${email} failed:`, emailErr.message);
            }
          }
        }
      }
    }

    console.log(`[auto-assign-rooms] Done: ${assigned.length} assigned, ${conflicts.length} conflicts`);

    return ok({
      success: true,
      assigned,
      conflicts,
    });
  } catch (err: any) {
    console.error("[auto-assign-rooms] Error:", err);
    return ok({ success: false, error: err.message }, 500);
  }
});

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

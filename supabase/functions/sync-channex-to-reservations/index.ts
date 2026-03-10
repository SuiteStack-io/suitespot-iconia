import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find all channex_bookings that have no matching reservation
    const { data: allBookings, error: fetchErr } = await supabase
      .from("channex_bookings")
      .select("*")
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!allBookings || allBookings.length === 0) {
      return ok({ success: true, message: "No Channex bookings found", created: 0, skipped: 0, failed: 0 });
    }

    // Get all channex_booking_ids that already have reservations
    const bookingIds = allBookings.map((b: any) => b.channex_booking_id);
    const { data: existingRes } = await supabase
      .from("reservations")
      .select("channex_booking_id")
      .in("channex_booking_id", bookingIds);

    const existingSet = new Set((existingRes || []).map((r: any) => r.channex_booking_id));

    const unsynced = allBookings.filter((b: any) => !existingSet.has(b.channex_booking_id));

    if (unsynced.length === 0) {
      return ok({ success: true, message: "All bookings already synced", created: 0, skipped: allBookings.length, failed: 0 });
    }

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const booking of unsynced) {
      try {
        const {
          channex_booking_id,
          arrival_date,
          departure_date,
          guest_name,
          guest_email,
          guest_phone,
          guest_country,
          ota_name,
          ota_reservation_code,
          total_amount,
          currency,
          adults,
          children,
          room_type_id,
          property_id: localPropertyId,
        } = booking;

        if (!arrival_date || !departure_date) {
          errors.push(`${channex_booking_id}: missing dates`);
          failed++;
          continue;
        }

        // Allocate a unit
        let allocatedUnitId: string | null = null;

        if (room_type_id) {
          const { data: mappedUnit } = await supabase
            .from("units")
            .select("booking_com_name, property_id")
            .eq("id", room_type_id)
            .maybeSingle();

          if (mappedUnit?.booking_com_name) {
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

        const numberOfGuests = (parseInt(adults) || 1) + (parseInt(children) || 0);

        const { error: insertErr } = await supabase
          .from("reservations")
          .insert({
            channex_booking_id,
            booking_reference: ota_reservation_code || channex_booking_id,
            check_in_date: arrival_date,
            check_out_date: departure_date,
            guest_names: [guest_name || "Unknown Guest"],
            contact_email: guest_email !== "unknown@unknown.com" ? guest_email : null,
            contact_phone: guest_phone,
            guest_nationality: guest_country,
            status: "confirmed",
            channel: "Channex",
            source: ota_name || "Channex",
            property_id: localPropertyId,
            unit_id: allocatedUnitId,
            total_price: total_amount || null,
            currency: currency || "USD",
            number_of_guests: numberOfGuests,
            adults: parseInt(adults) || 1,
            children: parseInt(children) || 0,
            skip_channex_sync: true,
          });

        if (insertErr) {
          errors.push(`${channex_booking_id}: ${insertErr.message}`);
          failed++;
        } else {
          created++;
        }
      } catch (err: any) {
        errors.push(`${booking.channex_booking_id}: ${err.message}`);
        failed++;
      }
    }

    const skipped = allBookings.length - unsynced.length;

    return ok({
      success: true,
      message: `Backfill complete: ${created} created, ${skipped} already synced, ${failed} failed`,
      created,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[sync-channex-to-reservations] Error:", err);
    return ok({ success: false, error: err.message }, 500);
  }
});


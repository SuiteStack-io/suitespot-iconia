/**
 * Client-side availability calculator.
 *
 * This is an INTENTIONAL DUPLICATE of the algorithm in
 * `supabase/functions/channex-process-sync-queue/index.ts` (lines 456-552).
 * Keep them as separate copies for isolation — do NOT extract a shared helper.
 *
 * Used by BlockedDatesManager and useLateCheckout to compute per-date
 * room-type availability and collapse it into Channex-style date ranges so
 * a single batched call to `channex-push-availability` can replace the old
 * per-row trigger fan-out.
 */

import { supabase } from "@/integrations/supabase/client";

export interface AvailabilityRange {
  date_from: string; // inclusive YYYY-MM-DD
  date_to: string; // inclusive YYYY-MM-DD
  availability: number;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysLocal(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Compute availability per day for a given room type and collapse consecutive
 * equal-availability days into ranges.
 *
 * @param roomTypeName  units.booking_com_name value
 * @param dateFrom      inclusive YYYY-MM-DD
 * @param dateTo        EXCLUSIVE YYYY-MM-DD (matches edge-function semantics)
 * @param propertyId    property to scope units to
 */
export async function calculateAvailabilityRanges(
  roomTypeName: string,
  dateFrom: string,
  dateTo: string,
  propertyId: string,
): Promise<AvailabilityRange[]> {
  // 1. Get all units of this room type for the property (skip maintenance)
  const { data: unitRows, error: unitErr } = await supabase
    .from("units")
    .select("id")
    .eq("property_id", propertyId)
    .eq("booking_com_name", roomTypeName)
    .neq("status", "maintenance");

  if (unitErr) {
    console.error("[availability-calculator] units query failed:", unitErr);
    return [];
  }

  const unitIds = (unitRows || []).map((u: any) => u.id as string);
  const totalUnits = unitIds.length;

  if (totalUnits === 0) {
    console.warn(
      `[availability-calculator] No units for room type "${roomTypeName}" @ property ${propertyId}`,
    );
    return [{ date_from: dateFrom, date_to: dateTo, availability: 0 }];
  }

  // 2. Fetch overlapping reservations (check_in < dateTo AND check_out > dateFrom)
  const { data: reservations } = await supabase
    .from("reservations")
    .select("unit_id, check_in_date, check_out_date")
    .in("status", ["confirmed", "checked-in"])
    .not("unit_id", "is", null)
    .in("unit_id", unitIds)
    .lt("check_in_date", dateTo)
    .gt("check_out_date", dateFrom);

  // 3. Fetch blocked dates in [dateFrom, dateTo)
  const { data: blockedDates } = await supabase
    .from("blocked_dates")
    .select("unit_id, blocked_date")
    .in("unit_id", unitIds)
    .gte("blocked_date", dateFrom)
    .lt("blocked_date", dateTo);

  // 4. Day-by-day availability
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);
  const dailyAvail: { date: string; avail: number }[] = [];

  for (let d = new Date(startDate); d < endDate; d = addDaysLocal(d, 1)) {
    const ds = formatDate(d);
    const occupiedUnits = new Set<string>();

    if (reservations) {
      for (const r of reservations as any[]) {
        if (r.check_in_date <= ds && r.check_out_date > ds && r.unit_id) {
          occupiedUnits.add(r.unit_id);
        }
      }
    }

    const blockedUnits = new Set<string>();
    if (blockedDates) {
      for (const b of blockedDates as any[]) {
        if (
          b.blocked_date === ds &&
          b.unit_id &&
          !occupiedUnits.has(b.unit_id)
        ) {
          blockedUnits.add(b.unit_id);
        }
      }
    }

    dailyAvail.push({
      date: ds,
      avail: Math.max(0, totalUnits - occupiedUnits.size - blockedUnits.size),
    });
  }

  if (dailyAvail.length === 0) {
    return [{ date_from: dateFrom, date_to: dateTo, availability: totalUnits }];
  }

  // 5. Collapse consecutive equal-availability days into ranges (date_to inclusive)
  const ranges: AvailabilityRange[] = [];
  let rangeStart = dailyAvail[0];
  let currentAvail = rangeStart.avail;
  let lastDate = rangeStart.date;

  for (let i = 1; i < dailyAvail.length; i++) {
    if (dailyAvail[i].avail === currentAvail) {
      lastDate = dailyAvail[i].date;
    } else {
      ranges.push({
        date_from: rangeStart.date,
        date_to: lastDate,
        availability: currentAvail,
      });
      rangeStart = dailyAvail[i];
      currentAvail = rangeStart.avail;
      lastDate = rangeStart.date;
    }
  }
  ranges.push({
    date_from: rangeStart.date,
    date_to: lastDate,
    availability: currentAvail,
  });

  return ranges;
}

/**
 * Resolve a representative unit id for a given room type. The
 * `channex-push-availability` edge function accepts a unit id as
 * `room_type_id` and resolves it to the Channex room_type via channex_mappings.
 */
export async function getRoomTypePrimaryUnitId(
  roomTypeName: string,
  propertyId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("units")
    .select("id")
    .eq("property_id", propertyId)
    .eq("booking_com_name", roomTypeName)
    .neq("status", "maintenance")
    .order("unit_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[availability-calculator] getRoomTypePrimaryUnitId failed:",
      error,
    );
    return null;
  }
  return (data?.id as string) || null;
}

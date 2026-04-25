import { startOfDay, differenceInDays, addDays } from 'date-fns';

export type RevenueRecognitionMethod = 'check_in' | 'check_out' | 'prorata';

/**
 * Applies a revenue date filter to a Supabase query based on the property's
 * configured revenue recognition method.
 *
 * - 'check_in'  → BETWEEN on check_in_date  (current default behavior)
 * - 'check_out' → BETWEEN on check_out_date
 * - 'prorata'   → overlap (caller must then prorate revenue by nights via prorateFactor)
 */
export function applyRevenueDateFilter<T>(
  query: T,
  method: RevenueRecognitionMethod,
  startDate: string,
  endDate: string,
): T {
  if (method === 'check_in') {
    return (query as any).gte('check_in_date', startDate).lte('check_in_date', endDate);
  }
  if (method === 'check_out') {
    return (query as any).gte('check_out_date', startDate).lte('check_out_date', endDate);
  }
  // prorata: overlap (matches the Occupancy KPI's overlap pattern in Analytics.tsx)
  return (query as any).lte('check_in_date', endDate).gte('check_out_date', startDate);
}

/**
 * Returns the share of a reservation's total nights that fall inside the
 * [startDate, endDate] window (inclusive end). Used for pro-rata revenue
 * allocation. Overlap math copied verbatim from Analytics.tsx (Occupancy KPI):
 *
 *   overlapStart = max(checkIn, windowStart)
 *   overlapEnd   = min(checkOut, addDays(windowEnd, 1))
 *   nightsInWindow = differenceInDays(overlapEnd, overlapStart)
 */
export function prorateFactor(
  checkInISO: string,
  checkOutISO: string,
  startISO: string,
  endISO: string,
): number {
  const checkIn = startOfDay(new Date(checkInISO));
  const checkOut = startOfDay(new Date(checkOutISO));
  const start = startOfDay(new Date(startISO));
  const end = startOfDay(new Date(endISO));

  const totalNights = differenceInDays(checkOut, checkIn);
  if (totalNights <= 0) return 0;

  const overlapStart = checkIn > start ? checkIn : start;
  const overlapEnd = checkOut <= end ? checkOut : addDays(end, 1);
  if (overlapStart >= overlapEnd) return 0;

  const nightsInWindow = differenceInDays(overlapEnd, overlapStart);
  return nightsInWindow / totalNights;
}

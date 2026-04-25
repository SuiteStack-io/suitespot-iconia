/**
 * Returns true if the reservation row is a "late checkout fee" row:
 * - booking_reference ends with "-LC"
 * - check_in_date === check_out_date (zero-night billing entry)
 *
 * These rows exist to charge a fee linked to the original reservation;
 * they are NOT real stays and must be excluded from conflict/overlap
 * detection in the calendar UI.
 *
 * Mirrors the same pattern used in:
 *  - src/components/ReservationQuickActions.tsx (line 891)
 *  - src/pages/ReservationDetail.tsx (line 257)
 */
export const isLateCheckoutFeeRow = (r: {
  booking_reference?: string | null;
  check_in_date: string;
  check_out_date: string;
}): boolean => {
  return !!r.booking_reference?.endsWith("-LC") && r.check_in_date === r.check_out_date;
};

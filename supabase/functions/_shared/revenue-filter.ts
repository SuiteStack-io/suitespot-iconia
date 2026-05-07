export type RevenueRecognitionMethod = 'check_in' | 'check_out' | 'prorata';

export function applyRevenueDateFilter<T>(
  query: T,
  method: RevenueRecognitionMethod,
  startDate: string,
  endDate: string,
): T {
  if (method === 'check_out') {
    return (query as any).gte('check_out_date', startDate).lte('check_out_date', endDate);
  }
  if (method === 'prorata') {
    return (query as any).lte('check_in_date', endDate).gte('check_out_date', startDate);
  }
  return (query as any).gte('check_in_date', startDate).lte('check_in_date', endDate);
}

export function prorateFactor(
  checkIn: string,
  checkOut: string,
  windowStart: string,
  windowEnd: string,
): number {
  const ci = new Date(checkIn + 'T00:00:00');
  const co = new Date(checkOut + 'T00:00:00');
  const ws = new Date(windowStart + 'T00:00:00');
  const we = new Date(windowEnd + 'T00:00:00');

  const totalNights = Math.round((co.getTime() - ci.getTime()) / 86400000);
  if (totalNights <= 0) return 0;

  const overlapStart = ci > ws ? ci : ws;
  const dayAfterEnd = new Date(we.getTime() + 86400000);
  const overlapEnd = co <= we ? co : dayAfterEnd;
  if (overlapStart >= overlapEnd) return 0;

  const nightsInWindow = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000);
  return nightsInWindow / totalNights;
}

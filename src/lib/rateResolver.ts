import { supabase } from '@/integrations/supabase/client';

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  off_peak_rate: number | null;
  min_stay: number;
  unit_id: string | null;
}

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
  room_type: string | null;
}

interface RateResult {
  weekdayRate: number;
  weekendRate: number;
  offPeakRate: number | null;
  minStay: number;
  ratePlanName: string;
  ratePlanId: string;
}

/**
 * Get the active rate for a room type on a specific date
 * Now each rate plan is linked to ONE room type via rate_plans.room_type
 * Priorities:
 * 1. Date-specific rate plan for this room type (highest priority first)
 * 2. Default rate plan for this room type
 * 3. Unit-specific override within the matched plan
 */
export const getActiveRate = async (
  roomType: string,
  checkInDate: Date,
  unitId?: string,
  weekendDays: number[] = [4, 5],
  offPeakDays: number[] = []
): Promise<RateResult | null> => {
  try {
    const dateStr = checkInDate.toISOString().split('T')[0];
    
    // Fetch all active rate plans for this room type
    const { data: ratePlans, error: plansError } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('is_active', true)
      .eq('room_type', roomType)
      .order('priority', { ascending: false });

    if (plansError) throw plansError;
    if (!ratePlans || ratePlans.length === 0) return null;

    // Find matching rate plan for the date
    let matchingPlan: RatePlan | null = null;
    
    for (const plan of ratePlans) {
      if (plan.is_default) continue;
      const validFrom = plan.valid_from;
      const validTo = plan.valid_to;
      if (validFrom && validTo && dateStr >= validFrom && dateStr <= validTo) {
        matchingPlan = plan;
        break;
      }
    }

    if (!matchingPlan) {
      matchingPlan = ratePlans.find(p => p.is_default) || ratePlans[0] || null;
    }

    if (!matchingPlan) return null;

    // Check for a date-specific override first
    const { data: dateOverride } = await supabase
      .from('rate_plan_date_overrides')
      .select('rate')
      .eq('rate_plan_id', matchingPlan.id)
      .eq('override_date', dateStr)
      .maybeSingle();

    const day = checkInDate.getDay();
    const isWeekend = weekendDays.includes(day);
    const isOffPeak = offPeakDays.includes(day);

    const buildResult = (price: RatePlanPrice): RateResult => {
      const baseWeekday = Number(price.weekday_rate);
      const baseWeekend = Number(price.weekend_rate);
      const baseOffPeak = price.off_peak_rate != null ? Number(price.off_peak_rate) : null;

      return {
        weekdayRate: dateOverride ? Number(dateOverride.rate) : baseWeekday,
        weekendRate: dateOverride ? Number(dateOverride.rate) : baseWeekend,
        offPeakRate: dateOverride ? Number(dateOverride.rate) : baseOffPeak,
        minStay: price.min_stay,
        ratePlanName: matchingPlan!.name,
        ratePlanId: matchingPlan!.id,
      };
    };

    // Try unit-specific price first
    if (unitId) {
      const { data: unitPrice, error: unitPriceError } = await supabase
        .from('rate_plan_prices')
        .select('*')
        .eq('rate_plan_id', matchingPlan.id)
        .eq('room_type', roomType)
        .eq('unit_id', unitId)
        .maybeSingle();

      if (unitPriceError) throw unitPriceError;
      if (unitPrice) return buildResult(unitPrice as RatePlanPrice);
    }

    // Fall back to room type price (unit_id is null)
    const { data: typePrice, error: typePriceError } = await supabase
      .from('rate_plan_prices')
      .select('*')
      .eq('rate_plan_id', matchingPlan.id)
      .eq('room_type', roomType)
      .is('unit_id', null)
      .maybeSingle();

    if (typePriceError) throw typePriceError;
    if (!typePrice) return null;

    return buildResult(typePrice as RatePlanPrice);
  } catch (error) {
    console.error('Error fetching active rate:', error);
    return null;
  }
};

/**
 * Get all rates for a specific rate plan
 */
export const getRatePlanPrices = async (ratePlanId: string): Promise<RatePlanPrice[]> => {
  const { data, error } = await supabase
    .from('rate_plan_prices')
    .select('*')
    .eq('rate_plan_id', ratePlanId);

  if (error) throw error;
  return data || [];
};

/**
 * Get all active rate plans
 */
export const getAllRatePlans = async (): Promise<RatePlan[]> => {
  const { data, error } = await supabase
    .from('rate_plans')
    .select('*')
    .order('priority', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Calculate weekend rate (10% higher, rounded to nearest $5)
 */
export const calculateWeekendRate = (weekdayRate: number): number => {
  if (!weekdayRate || weekdayRate <= 0) return 0;
  return Math.ceil((weekdayRate * 1.10) / 5) * 5;
};

/**
 * Calculate off-peak rate (15% lower, rounded to nearest $5)
 */
export const calculateOffPeakRate = (weekdayRate: number): number => {
  if (!weekdayRate || weekdayRate <= 0) return 0;
  return Math.round((weekdayRate * 0.85) / 5) * 5;
};

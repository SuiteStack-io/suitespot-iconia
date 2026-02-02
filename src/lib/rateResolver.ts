import { supabase } from '@/integrations/supabase/client';

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
}

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
}

interface RateResult {
  weekdayRate: number;
  weekendRate: number;
  minStay: number;
  ratePlanName: string;
  ratePlanId: string;
}

/**
 * Get the active rate for a room type on a specific date
 * Priorities:
 * 1. Active rate plans with matching date range, sorted by priority (highest first)
 * 2. Default rate plan (always valid)
 */
export const getActiveRate = async (
  roomType: string,
  checkInDate: Date
): Promise<RateResult | null> => {
  try {
    const dateStr = checkInDate.toISOString().split('T')[0];

    // Fetch all active rate plans
    const { data: ratePlans, error: plansError } = await supabase
      .from('rate_plans')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (plansError) throw plansError;
    if (!ratePlans || ratePlans.length === 0) return null;

    // Find matching rate plan for the date
    let matchingPlan: RatePlan | null = null;
    
    // First, look for date-specific plans
    for (const plan of ratePlans) {
      if (plan.is_default) continue; // Skip default plan in first pass
      
      const validFrom = plan.valid_from;
      const validTo = plan.valid_to;
      
      // Check if date falls within the plan's validity period
      if (validFrom && validTo) {
        if (dateStr >= validFrom && dateStr <= validTo) {
          matchingPlan = plan;
          break; // Highest priority match found
        }
      }
    }

    // If no date-specific plan found, use default plan
    if (!matchingPlan) {
      matchingPlan = ratePlans.find(p => p.is_default) || null;
    }

    if (!matchingPlan) return null;

    // Get prices for the matching plan and room type
    const { data: prices, error: pricesError } = await supabase
      .from('rate_plan_prices')
      .select('*')
      .eq('rate_plan_id', matchingPlan.id)
      .eq('room_type', roomType)
      .single();

    if (pricesError && pricesError.code !== 'PGRST116') throw pricesError;
    
    if (!prices) return null;

    return {
      weekdayRate: Number(prices.weekday_rate),
      weekendRate: Number(prices.weekend_rate),
      minStay: prices.min_stay,
      ratePlanName: matchingPlan.name,
      ratePlanId: matchingPlan.id,
    };
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

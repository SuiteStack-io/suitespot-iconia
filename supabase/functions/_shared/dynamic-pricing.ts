/**
 * _shared/dynamic-pricing.ts
 *
 * Pure dynamic-pricing math, ported verbatim from
 * supabase/functions/calculate-dynamic-price/index.ts.
 *
 * No Supabase imports, no network, no Deno.serve. Callers load all data,
 * build a DynamicPricingContext, and invoke calculateDynamicRate(ctx, input).
 *
 * Used by:
 *   - calculate-dynamic-price (Edge Function path) — pre-seeds month caches
 *   - channex-* sync functions (sync path) — passes empty caches; helper
 *     computes from ctx.reservations on first encounter of each YYYY-MM
 *     and writes back to the cache.
 */

// ───────────────────────── Types ─────────────────────────

export interface DynamicPricingContext {
  property: {
    id: string;
    weekend_days: number[];
    off_peak_days: number[];
    timezone: string;
  };
  pricingRules: any | null;
  /**
   * Reservations covering at least the target month for this property.
   * Required columns: unit_id, property_id, status, check_in_date,
   * check_out_date, total_price.
   */
  reservations: any[];
  /** Active (non-maintenance) units for the property. */
  units: { id: string }[];
  /**
   * Pricing overrides. Required: id, override_type, value, room_type,
   * override_date, property_id.
   */
  overrides: any[];
  /**
   * Active promotions. Required: id, discount_type, discount_value,
   * room_types, created_at, booking_window_start, booking_window_end,
   * stay_start, stay_end. Optional: is_active, property_id.
   */
  promotions: any[];
  /** YYYY-MM-DD in the property timezone. */
  todayStrInTz: string;
  /**
   * Lazy month caches keyed by 'YYYY-MM'. Pre-populated on the Edge
   * Function path; left empty {} on the sync path. Helper checks each
   * key and computes-then-writes-back when missing.
   */
  monthlyBookedNightsByMonth: Record<string, number>;
  monthlyRevenueByMonth: Record<string, number>;
}

export interface DynamicPricingInput {
  room_type: string;
  rate_plan_id: string;
  /** YYYY-MM-DD */
  target_date: string;
  priceRow: {
    weekday_rate: number;
    weekend_rate: number | null;
    off_peak_rate: number | null;
    min_rate: number | null;
    max_rate: number | null;
  };
}

export type DynamicPricingResult =
  | {
      kind: "static";
      base_rate: number;
      final_rate: number;
      static_reason: "no_pricing_rules" | "dynamic_pricing_disabled";
      was_clamped: boolean;
      clamp_direction: "floor" | "ceiling" | null;
      room_type_min_rate: number | null;
      room_type_max_rate: number | null;
    }
  | {
      kind: "dynamic";
      base_rate: number;
      calculated_rate: number; // pre-clamp, post-promo
      final_rate: number; // post-clamp
      month_phase: "A" | "B" | "historical";
      day_of_week_multiplier: number;
      occupancy_percent: number;
      occupancy_tier: number;
      occupancy_adjustment_percent: number;
      pace_index: number | null;
      pace_index_bumped: boolean;
      revenue_total: number;
      revenue_achievement_percent: number;
      revenue_adjustment_percent: number;
      room_type_min_rate: number | null;
      room_type_max_rate: number | null;
      was_clamped: boolean;
      clamp_direction: "floor" | "ceiling" | null;
      override: { id: string; active: true } | null;
      promotion: { id: string; discount_percent: number | null } | null;
    };

// ───────────────────────── Date helpers ─────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function daysInMonthFn(year: number, monthIdx0: number): number {
  return new Date(year, monthIdx0 + 1, 0).getDate();
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Find which tier index a value falls into given an ascending thresholds
 * array. Tier i means: thresholds[i-1] <= value < thresholds[i] (tier 0 =
 * below first threshold). The adjustments array is expected to have
 * thresholds.length + 1 entries.
 */
function tierIndex(value: number, thresholds: number[]): number {
  let i = 0;
  for (; i < thresholds.length; i++) {
    if (value < Number(thresholds[i])) return i;
  }
  return i; // top tier
}

/**
 * Compute month bounds for a YYYY-MM-DD target date. Exported so callers
 * can derive identical bounds for SQL pre-seeding.
 */
export function computeMonthBounds(targetDate: string): {
  year: number;
  monthIdx0: number;
  totalDaysInMonth: number;
  monthStartStr: string;
  monthEndExclusiveStr: string;
  monthEndInclusiveStr: string;
} {
  const [yearStr, monthStr] = targetDate.split("-");
  const year = Number(yearStr);
  const monthIdx0 = Number(monthStr) - 1;
  const totalDaysInMonth = daysInMonthFn(year, monthIdx0);
  const monthStart = new Date(Date.UTC(year, monthIdx0, 1));
  const monthEnd = new Date(Date.UTC(year, monthIdx0, totalDaysInMonth));
  return {
    year,
    monthIdx0,
    totalDaysInMonth,
    monthStartStr: formatDate(monthStart),
    monthEndExclusiveStr: formatDate(addDays(monthEnd, 1)),
    monthEndInclusiveStr: formatDate(monthEnd),
  };
}

/**
 * Single source of truth for A / B / historical phase.
 */
export function computeMonthPhase(
  targetDate: string,
  todayStrInTz: string,
): "A" | "B" | "historical" {
  const { monthStartStr, monthEndInclusiveStr } = computeMonthBounds(targetDate);
  if (monthStartStr > todayStrInTz) return "A";
  if (monthEndInclusiveStr < todayStrInTz) return "historical";
  return "B";
}

// ───────────────────────── Internal compute helpers ─────────────────────────

const ACTIVE_STATUSES = new Set(["confirmed", "checked-in"]);

function computeBookedNightsFromReservations(
  reservations: any[],
  units: { id: string }[],
  monthStartStr: string,
  monthEndExclusiveStr: string,
): number {
  if (units.length === 0) return 0;
  const unitIds = new Set(units.map((u) => u.id));
  let bookedNights = 0;
  for (const r of reservations) {
    if (!ACTIVE_STATUSES.has(r.status)) continue;
    if (!unitIds.has(r.unit_id)) continue;
    const ci = r.check_in_date as string;
    const co = r.check_out_date as string;
    // Mirror SQL: check_in_date < monthEndExclusiveStr AND check_out_date > monthStartStr
    if (!(ci < monthEndExclusiveStr && co > monthStartStr)) continue;
    const overlapStart = ci > monthStartStr ? ci : monthStartStr;
    const overlapEndExclusive =
      co < monthEndExclusiveStr ? co : monthEndExclusiveStr;
    if (overlapEndExclusive > overlapStart) {
      const a = new Date(overlapStart + "T00:00:00Z").getTime();
      const b = new Date(overlapEndExclusive + "T00:00:00Z").getTime();
      const nights = Math.round((b - a) / 86400000);
      if (nights > 0) bookedNights += nights;
    }
  }
  return bookedNights;
}

function computeRevenueFromReservations(
  reservations: any[],
  propertyId: string,
  monthPhase: "A" | "B" | "historical",
  monthStartStr: string,
  monthEndExclusiveStr: string,
): number {
  if (monthPhase === "historical") return 0;
  let revenueTotal = 0;
  for (const r of reservations) {
    if (r.property_id !== propertyId) continue;
    if (!ACTIVE_STATUSES.has(r.status)) continue;
    const ci = r.check_in_date as string;
    const co = r.check_out_date as string;
    if (monthPhase === "A") {
      // SQL: check_in_date >= monthStartStr AND check_in_date < monthEndExclusiveStr
      if (ci >= monthStartStr && ci < monthEndExclusiveStr) {
        revenueTotal += Number(r.total_price ?? 0);
      }
    } else {
      // Phase B: check_in_date < monthEndExclusiveStr AND check_out_date > monthStartStr
      if (ci < monthEndExclusiveStr && co > monthStartStr) {
        revenueTotal += Number(r.total_price ?? 0);
      }
    }
  }
  return revenueTotal;
}

// ───────────────────────── Main entry point ─────────────────────────

export function calculateDynamicRate(
  ctx: DynamicPricingContext,
  input: DynamicPricingInput,
): DynamicPricingResult {
  const { room_type, target_date, priceRow } = input;

  const propertyWeekendDays = ctx.property.weekend_days?.length
    ? ctx.property.weekend_days
    : [4, 5];
  const propertyOffPeakDays = ctx.property.off_peak_days || [];

  const weekdayRate = Number(priceRow.weekday_rate);
  const weekendRate =
    priceRow.weekend_rate != null ? Number(priceRow.weekend_rate) : weekdayRate;
  const offPeakRate =
    priceRow.off_peak_rate != null ? Number(priceRow.off_peak_rate) : 0;
  const roomTypeMinRate: number | null =
    priceRow.min_rate != null ? Number(priceRow.min_rate) : null;
  const roomTypeMaxRate: number | null =
    priceRow.max_rate != null ? Number(priceRow.max_rate) : null;

  // ── Base rate ──
  const targetDateObj = new Date(target_date + "T00:00:00Z");
  const dow = targetDateObj.getUTCDay(); // 0=Sun..6=Sat

  let baseRate = weekdayRate;
  if (
    propertyOffPeakDays.length > 0 &&
    propertyOffPeakDays.includes(dow) &&
    offPeakRate > 0
  ) {
    baseRate = offPeakRate;
  } else if (propertyWeekendDays.includes(dow) && weekendRate > 0) {
    baseRate = weekendRate;
  }

  const rules = ctx.pricingRules;

  // ── Static fast path ──
  if (!rules || rules.is_enabled === false) {
    let finalRateStatic = baseRate;
    let wasClampedStatic = false;
    let clampDirectionStatic: "floor" | "ceiling" | null = null;
    if (roomTypeMinRate !== null && finalRateStatic < roomTypeMinRate) {
      finalRateStatic = roomTypeMinRate;
      wasClampedStatic = true;
      clampDirectionStatic = "floor";
    } else if (roomTypeMaxRate !== null && finalRateStatic > roomTypeMaxRate) {
      finalRateStatic = roomTypeMaxRate;
      wasClampedStatic = true;
      clampDirectionStatic = "ceiling";
    }
    if (finalRateStatic <= 0) finalRateStatic = baseRate;
    finalRateStatic = round2(finalRateStatic);

    return {
      kind: "static",
      base_rate: round2(baseRate),
      final_rate: finalRateStatic,
      static_reason: rules ? "dynamic_pricing_disabled" : "no_pricing_rules",
      was_clamped: wasClampedStatic,
      clamp_direction: clampDirectionStatic,
      room_type_min_rate: roomTypeMinRate,
      room_type_max_rate: roomTypeMaxRate,
    };
  }

  // ── Override (defensive filter) ──
  const overrideMatches = (ctx.overrides || []).filter(
    (o) =>
      o.override_date === target_date &&
      (o.property_id === undefined || o.property_id === ctx.property.id),
  );
  let override:
    | { id: string; override_type: string; value: number; room_type: string | null }
    | null = null;
  if (overrideMatches.length > 0) {
    const specific = overrideMatches.find((o: any) => o.room_type === room_type);
    const wildcard = overrideMatches.find((o: any) => o.room_type === null);
    override = (specific ?? wildcard ?? null) as any;
  }

  // ── DOW multiplier ──
  const dowMultipliers = (rules.day_of_week_multipliers || {}) as Record<
    string,
    number
  >;
  const dowMultiplier = Number(dowMultipliers[String(dow)] ?? 1);

  // ── Month bounds ──
  const {
    year,
    monthIdx0,
    totalDaysInMonth,
    monthStartStr,
    monthEndExclusiveStr,
  } = computeMonthBounds(target_date);
  const monthStart = new Date(Date.UTC(year, monthIdx0, 1));

  const totalUnits = ctx.units?.length || 0;
  const totalAvailableNights = totalUnits * totalDaysInMonth;

  const targetMonth = target_date.slice(0, 7); // 'YYYY-MM'

  // ── Lazy booked-nights cache ──
  let bookedNights: number;
  if (
    Object.prototype.hasOwnProperty.call(
      ctx.monthlyBookedNightsByMonth,
      targetMonth,
    )
  ) {
    bookedNights = ctx.monthlyBookedNightsByMonth[targetMonth];
  } else {
    bookedNights = computeBookedNightsFromReservations(
      ctx.reservations || [],
      ctx.units || [],
      monthStartStr,
      monthEndExclusiveStr,
    );
    ctx.monthlyBookedNightsByMonth[targetMonth] = bookedNights;
  }

  const occupancyPercent =
    totalAvailableNights > 0 ? (bookedNights / totalAvailableNights) * 100 : 0;

  // ── Month phase (shared with caller via computeMonthPhase) ──
  const monthPhase = computeMonthPhase(target_date, ctx.todayStrInTz);

  // ── Pace index (Phase B only) ──
  let paceIndex: number | null = null;
  let paceIndexBumped = false;
  const paceBumpThreshold = Number(rules.pace_index_bump_threshold ?? 1.3);
  if (monthPhase === "B") {
    const todayDate = new Date(ctx.todayStrInTz + "T00:00:00Z");
    const daysElapsed =
      Math.round((todayDate.getTime() - monthStart.getTime()) / 86400000) + 1;
    const daysElapsedPercent = (daysElapsed / totalDaysInMonth) * 100;
    paceIndex =
      daysElapsedPercent <= 0 ? 1.0 : occupancyPercent / daysElapsedPercent;
  }

  // ── Occupancy adjustment ──
  const occThresholds = ((rules.occupancy_thresholds || []) as any[]).map(Number);
  const occAdjustments = ((rules.occupancy_adjustments || []) as any[]).map(
    Number,
  );
  let occTier = tierIndex(occupancyPercent, occThresholds);
  if (
    monthPhase === "B" &&
    paceIndex !== null &&
    paceIndex >= paceBumpThreshold
  ) {
    if (occTier < occAdjustments.length - 1) {
      occTier += 1;
      paceIndexBumped = true;
    }
  }
  const occupancyAdjustmentPercent = Number(occAdjustments[occTier] ?? 0);

  // ── Lazy revenue cache ──
  let revenueTotal: number;
  if (
    Object.prototype.hasOwnProperty.call(ctx.monthlyRevenueByMonth, targetMonth)
  ) {
    revenueTotal = ctx.monthlyRevenueByMonth[targetMonth];
  } else {
    revenueTotal = computeRevenueFromReservations(
      ctx.reservations || [],
      ctx.property.id,
      monthPhase,
      monthStartStr,
      monthEndExclusiveStr,
    );
    ctx.monthlyRevenueByMonth[targetMonth] = revenueTotal;
  }

  const monthlyTarget =
    rules.monthly_revenue_target != null
      ? Number(rules.monthly_revenue_target)
      : 0;
  const revenueAchievementPercent =
    monthlyTarget > 0 ? (revenueTotal / monthlyTarget) * 100 : 0;

  // ── Revenue adjustment ──
  const revThresholds = ((rules.revenue_thresholds || []) as any[]).map(Number);
  const revAdjustmentsPhaseA = (
    (rules.revenue_adjustments_phase_a || []) as any[]
  ).map(Number);
  const revAdjustmentsPhaseB = (
    (rules.revenue_adjustments_phase_b || []) as any[]
  ).map(Number);
  const revAdjustments =
    monthPhase === "B" ? revAdjustmentsPhaseB : revAdjustmentsPhaseA;

  let revenueAdjustmentPercent = 0;
  if (monthlyTarget > 0 && monthPhase !== "historical") {
    const revTier = tierIndex(revenueAchievementPercent, revThresholds);
    revenueAdjustmentPercent = Number(revAdjustments[revTier] ?? 0);

    const conflictCap = Number(rules.revenue_occupancy_conflict_cap ?? 5);
    const conflictRevMin = Number(
      rules.revenue_occupancy_conflict_revenue_min ?? 80,
    );
    const conflictOccMax = Number(
      rules.revenue_occupancy_conflict_occupancy_max ?? 40,
    );
    if (
      revenueAchievementPercent > conflictRevMin &&
      occupancyPercent < conflictOccMax &&
      revenueAdjustmentPercent > conflictCap
    ) {
      revenueAdjustmentPercent = conflictCap;
    }
  }

  // ── Combine OR override ──
  let calculatedRate: number;
  let overrideActive = false;
  if (override) {
    overrideActive = true;
    const v = Number(override.value);
    if (override.override_type === "fixed_rate") {
      calculatedRate = v;
    } else if (override.override_type === "percentage_adjustment") {
      calculatedRate = baseRate * (1 + v / 100);
    } else if (override.override_type === "multiplier") {
      calculatedRate = baseRate * v;
    } else {
      calculatedRate = baseRate;
    }
  } else {
    calculatedRate =
      baseRate *
      dowMultiplier *
      (1 + occupancyAdjustmentPercent / 100) *
      (1 + revenueAdjustmentPercent / 100);
  }

  // ── Promotion (skipped when override is active) ──
  let appliedPromotionId: string | null = null;
  let appliedPromotionDiscountPercent: number | null = null;
  if (!overrideActive) {
    const today = ctx.todayStrInTz;
    const matchingPromos = (ctx.promotions || []).filter((p: any) => {
      if (p.is_active === false) return false;
      if (p.property_id !== undefined && p.property_id !== ctx.property.id) {
        return false;
      }
      if (!(p.booking_window_start <= today && p.booking_window_end >= today)) {
        return false;
      }
      if (!(p.stay_start <= target_date && p.stay_end >= target_date)) {
        return false;
      }
      if (p.room_types && !p.room_types.includes(room_type)) return false;
      return true;
    });

    const candidates = matchingPromos
      .map((p: any) => {
        const v = Number(p.discount_value);
        const savings =
          p.discount_type === "percentage" ? (calculatedRate * v) / 100 : v;
        return { promo: p, savings };
      })
      .sort(
        (a: any, b: any) =>
          b.savings - a.savings ||
          new Date(b.promo.created_at).getTime() -
            new Date(a.promo.created_at).getTime(),
      );

    const winner = candidates[0];
    if (winner && winner.savings > 0) {
      const preDiscount = calculatedRate;
      if (winner.promo.discount_type === "percentage") {
        calculatedRate =
          preDiscount * (1 - Number(winner.promo.discount_value) / 100);
        appliedPromotionDiscountPercent = round2(
          Number(winner.promo.discount_value),
        );
      } else {
        calculatedRate = preDiscount - Number(winner.promo.discount_value);
        appliedPromotionDiscountPercent =
          preDiscount > 0 ? round2((winner.savings / preDiscount) * 100) : null;
      }
      appliedPromotionId = winner.promo.id as string;
    }
  }

  // ── Clamp ──
  let finalRate = calculatedRate;
  let wasClamped = false;
  let clampDirection: "floor" | "ceiling" | null = null;
  if (roomTypeMinRate !== null && finalRate < roomTypeMinRate) {
    finalRate = roomTypeMinRate;
    wasClamped = true;
    clampDirection = "floor";
  } else if (roomTypeMaxRate !== null && finalRate > roomTypeMaxRate) {
    finalRate = roomTypeMaxRate;
    wasClamped = true;
    clampDirection = "ceiling";
  }
  if (finalRate <= 0) {
    finalRate = baseRate > 0 ? baseRate : roomTypeMinRate ?? baseRate;
  }
  finalRate = round2(finalRate);

  return {
    kind: "dynamic",
    base_rate: round2(baseRate),
    calculated_rate: round2(calculatedRate),
    final_rate: finalRate,
    month_phase: monthPhase,
    day_of_week_multiplier: override ? 1 : dowMultiplier,
    occupancy_percent: round2(occupancyPercent),
    occupancy_tier: occTier,
    occupancy_adjustment_percent: override ? 0 : occupancyAdjustmentPercent,
    pace_index: paceIndex !== null ? round2(paceIndex) : null,
    pace_index_bumped: paceIndexBumped,
    revenue_total: round2(revenueTotal),
    revenue_achievement_percent: round2(revenueAchievementPercent),
    revenue_adjustment_percent: override ? 0 : revenueAdjustmentPercent,
    room_type_min_rate: roomTypeMinRate,
    room_type_max_rate: roomTypeMaxRate,
    was_clamped: wasClamped,
    clamp_direction: clampDirection,
    override: override ? { id: override.id, active: true } : null,
    promotion: appliedPromotionId
      ? {
          id: appliedPromotionId,
          discount_percent: appliedPromotionDiscountPercent,
        }
      : null,
  };
}

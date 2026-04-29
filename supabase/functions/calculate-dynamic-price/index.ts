import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * calculate-dynamic-price
 *
 * Service-role function that calculates the dynamically-adjusted nightly rate
 * for a given (property, room_type, rate_plan, target_date) tuple.
 *
 * Called by other edge functions (channex-full-sync, channex-daily-sync,
 * channex-process-sync-queue), not by users directly.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function daysInMonth(year: number, monthIdx0: number): number {
  return new Date(year, monthIdx0 + 1, 0).getDate();
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Find which tier index a value falls into given an ascending thresholds array.
 * Tier i means: thresholds[i-1] <= value < thresholds[i] (tier 0 = below first threshold).
 * The adjustments array is expected to have thresholds.length + 1 entries.
 */
function tierIndex(value: number, thresholds: number[]): number {
  let i = 0;
  for (; i < thresholds.length; i++) {
    if (value < Number(thresholds[i])) return i;
  }
  return i; // top tier
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { property_id, room_type, rate_plan_id, target_date } = body ?? {};

    if (!property_id || !room_type || !rate_plan_id || !target_date) {
      return respond(400, {
        success: false,
        error:
          "property_id, room_type, rate_plan_id and target_date are required",
      });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return respond(400, {
        success: false,
        error: "target_date must be YYYY-MM-DD",
      });
    }

    // ── 1. Property + pricing config ──
    const { data: property } = await supabase
      .from("properties")
      .select("id, weekend_days, off_peak_days, timezone")
      .eq("id", property_id)
      .maybeSingle();

    if (!property) {
      return respond(404, { success: false, error: "Property not found" });
    }
    const propertyWeekendDays: number[] = property.weekend_days || [4, 5];
    const propertyOffPeakDays: number[] = property.off_peak_days || [];
    const propertyTimezone: string = property.timezone || "Africa/Cairo";

    // ── 2. Rate plan + price row ──
    const { data: ratePlan } = await supabase
      .from("rate_plans")
      .select("id")
      .eq("id", rate_plan_id)
      .maybeSingle();
    if (!ratePlan) {
      return respond(404, { success: false, error: "Rate plan not found" });
    }

    let priceRow: any = null;
    {
      const { data: rtLevel } = await supabase
        .from("rate_plan_prices")
        .select("weekday_rate, weekend_rate, off_peak_rate, min_rate, max_rate")
        .eq("rate_plan_id", rate_plan_id)
        .eq("room_type", room_type)
        .is("unit_id", null)
        .maybeSingle();
      priceRow = rtLevel;
    }
    if (!priceRow) {
      const { data: anyPrice } = await supabase
        .from("rate_plan_prices")
        .select("weekday_rate, weekend_rate, off_peak_rate, min_rate, max_rate")
        .eq("rate_plan_id", rate_plan_id)
        .eq("room_type", room_type)
        .limit(1)
        .maybeSingle();
      priceRow = anyPrice;
    }
    if (!priceRow) {
      return respond(404, {
        success: false,
        error: `No rate_plan_prices row for rate_plan_id ${rate_plan_id} / room_type ${room_type}`,
      });
    }

    const weekdayRate = Number(priceRow.weekday_rate);
    const weekendRate =
      priceRow.weekend_rate != null ? Number(priceRow.weekend_rate) : weekdayRate;
    const offPeakRate =
      priceRow.off_peak_rate != null ? Number(priceRow.off_peak_rate) : 0;
    const roomTypeMinRate: number | null =
      priceRow.min_rate != null ? Number(priceRow.min_rate) : null;
    const roomTypeMaxRate: number | null =
      priceRow.max_rate != null ? Number(priceRow.max_rate) : null;

    // ── 3. Determine base rate (matches channex-full-sync lines 291-307) ──
    // target_date is a calendar date — parse as UTC midnight and use UTC weekday
    // so the resulting `dow` matches the stored date string regardless of runtime TZ.
    const targetDate = new Date(target_date + "T00:00:00Z");
    const dow = targetDate.getUTCDay(); // 0=Sun, 6=Sat

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

    // ── 4. pricing_rules ──
    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("property_id", property_id)
      .maybeSingle();

    // Static fast path: dynamic pricing disabled or no rules at all.
    // Per spec: do NOT log to pricing_log here — the CHECK constraint on
    // month_phase only allows 'A' or 'B', and a static rate is not a dynamic
    // pricing decision worth logging.
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

      return respond(200, {
        success: true,
        base_rate: round2(baseRate),
        final_rate: finalRateStatic,
        adjustments: {
          day_of_week_multiplier: 1,
          occupancy_percent: null,
          occupancy_adjustment: 0,
          pace_index: null,
          pace_index_bumped: false,
          revenue_achievement_percent: null,
          revenue_adjustment: 0,
          month_phase: null,
          room_type_min_rate: roomTypeMinRate,
          room_type_max_rate: roomTypeMaxRate,
          override_active: false,
          was_clamped: wasClampedStatic,
          clamp_direction: clampDirectionStatic,
          static_reason: rules ? "dynamic_pricing_disabled" : "no_pricing_rules",
        },
      });
    }

    // ── 5. Manual override ──
    const { data: overrideMatches } = await supabase
      .from("pricing_overrides")
      .select("id, override_type, value, room_type")
      .eq("property_id", property_id)
      .eq("override_date", target_date);

    let override:
      | { id: string; override_type: string; value: number; room_type: string | null }
      | null = null;
    if (overrideMatches && overrideMatches.length > 0) {
      const specific = (overrideMatches as any[]).find(
        (o) => o.room_type === room_type,
      );
      const wildcard = (overrideMatches as any[]).find(
        (o) => o.room_type === null,
      );
      override = (specific ?? wildcard ?? null) as any;
    }

    // ── Day-of-week multiplier ──
    const dowMultipliers = (rules.day_of_week_multipliers || {}) as Record<
      string,
      number
    >;
    const dowMultiplier = Number(dowMultipliers[String(dow)] ?? 1);

    // ── 6. Occupancy for the target month ──
    const [yearStr, monthStr] = (target_date as string).split("-");
    const year = Number(yearStr);
    const monthIdx0 = Number(monthStr) - 1;
    const totalDaysInMonth = daysInMonth(year, monthIdx0);
    const monthStart = new Date(Date.UTC(year, monthIdx0, 1));
    const monthEnd = new Date(Date.UTC(year, monthIdx0, totalDaysInMonth)); // last day inclusive
    const monthStartStr = formatDate(monthStart);
    const monthEndExclusiveStr = formatDate(addDays(monthEnd, 1)); // first day of next month

    const { data: allUnits } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", property_id)
      .neq("status", "maintenance");

    const totalUnits = allUnits?.length || 0;
    const totalAvailableNights = totalUnits * totalDaysInMonth;

    let bookedNights = 0;
    if (totalUnits > 0) {
      const unitIds = (allUnits as any[]).map((u) => u.id);
      const { data: monthReservations } = await supabase
        .from("reservations")
        .select("unit_id, check_in_date, check_out_date")
        .in("status", ["confirmed", "checked-in"])
        .in("unit_id", unitIds)
        .lt("check_in_date", monthEndExclusiveStr)
        .gt("check_out_date", monthStartStr);

      if (monthReservations) {
        for (const r of monthReservations as any[]) {
          const ci = r.check_in_date as string;
          const co = r.check_out_date as string;
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
      }
    }

    const occupancyPercent =
      totalAvailableNights > 0
        ? (bookedNights / totalAvailableNights) * 100
        : 0;

    // ── 7. Month phase (today in property timezone) ──
    // en-CA returns YYYY-MM-DD. (todayStrInTz computed earlier, after property load)
    let monthPhase: "A" | "B" | "historical";
    if (monthStartStr > todayStrInTz) {
      monthPhase = "A";
    } else if (formatDate(monthEnd) < todayStrInTz) {
      monthPhase = "historical";
    } else {
      monthPhase = "B";
    }

    // ── 8. Pace index (Phase B only) ──
    let paceIndex: number | null = null;
    let paceIndexBumped = false;
    const paceBumpThreshold = Number(rules.pace_index_bump_threshold ?? 1.30);
    if (monthPhase === "B") {
      const todayDate = new Date(todayStrInTz + "T00:00:00Z");
      const daysElapsed =
        Math.round((todayDate.getTime() - monthStart.getTime()) / 86400000) + 1;
      const daysElapsedPercent = (daysElapsed / totalDaysInMonth) * 100;
      paceIndex =
        daysElapsedPercent <= 0 ? 1.0 : occupancyPercent / daysElapsedPercent;
    }

    // ── 9. Occupancy adjustment ──
    const occThresholds = ((rules.occupancy_thresholds || []) as any[]).map(
      Number,
    );
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

    // ── 10. Revenue for target month ──
    let revenueTotal = 0;
    if (monthPhase === "A") {
      const { data: revRes } = await supabase
        .from("reservations")
        .select("total_price")
        .eq("property_id", property_id)
        .in("status", ["confirmed", "checked-in"])
        .gte("check_in_date", monthStartStr)
        .lt("check_in_date", monthEndExclusiveStr);
      if (revRes) {
        for (const r of revRes as any[]) {
          revenueTotal += Number(r.total_price ?? 0);
        }
      }
    } else if (monthPhase === "B") {
      const { data: revRes } = await supabase
        .from("reservations")
        .select("total_price")
        .eq("property_id", property_id)
        .in("status", ["confirmed", "checked-in"])
        .lt("check_in_date", monthEndExclusiveStr)
        .gt("check_out_date", monthStartStr);
      if (revRes) {
        for (const r of revRes as any[]) {
          revenueTotal += Number(r.total_price ?? 0);
        }
      }
    }

    const monthlyTarget =
      rules.monthly_revenue_target != null
        ? Number(rules.monthly_revenue_target)
        : 0;
    const revenueAchievementPercent =
      monthlyTarget > 0 ? (revenueTotal / monthlyTarget) * 100 : 0;

    // ── 11. Revenue adjustment ──
    const revThresholds = ((rules.revenue_thresholds || []) as any[]).map(
      Number,
    );
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

    // ── 12. Combine OR apply override ──
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

    // ── 13. Clamp (two layers) ──
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

    // Layer 2 safety: never zero or negative
    if (finalRate <= 0) {
      finalRate = baseRate > 0 ? baseRate : (roomTypeMinRate ?? baseRate);
    }

    // ── 14. Round ──
    finalRate = round2(finalRate);

    // ── 15. Log (only when month_phase is 'A' or 'B' — CHECK constraint) ──
    if (monthPhase === "A" || monthPhase === "B") {
      await supabase.from("pricing_log").insert({
        property_id,
        date_priced: target_date,
        target_month: (target_date as string).slice(0, 7),
        month_phase: monthPhase,
        room_type,
        rate_plan_id,
        base_rate: baseRate,
        calculated_rate: round2(calculatedRate),
        final_rate: finalRate,
        day_of_week_multiplier: override ? 1 : dowMultiplier,
        occupancy_percent: round2(occupancyPercent),
        occupancy_tier: occTier,
        occupancy_adjustment_percent: override ? 0 : occupancyAdjustmentPercent,
        pace_index: paceIndex !== null ? round2(paceIndex) : null,
        revenue_total: round2(revenueTotal),
        revenue_achievement_percent: round2(revenueAchievementPercent),
        revenue_adjustment_percent: override ? 0 : revenueAdjustmentPercent,
        room_type_min_rate: roomTypeMinRate,
        room_type_max_rate: roomTypeMaxRate,
        was_clamped: wasClamped,
        clamp_direction: clampDirection,
        override_id: override?.id ?? null,
        override_active: overrideActive,
      });
    }

    // ── 16. Return ──
    return respond(200, {
      success: true,
      base_rate: round2(baseRate),
      final_rate: finalRate,
      adjustments: {
        day_of_week_multiplier: override ? 1 : dowMultiplier,
        occupancy_percent: round2(occupancyPercent),
        occupancy_adjustment: override ? 0 : occupancyAdjustmentPercent,
        pace_index: paceIndex !== null ? round2(paceIndex) : null,
        pace_index_bumped: paceIndexBumped,
        revenue_achievement_percent: round2(revenueAchievementPercent),
        revenue_adjustment: override ? 0 : revenueAdjustmentPercent,
        month_phase: monthPhase,
        room_type_min_rate: roomTypeMinRate,
        room_type_max_rate: roomTypeMaxRate,
        override_active: overrideActive,
        was_clamped: wasClamped,
        clamp_direction: clampDirection,
      },
    });
  } catch (err: any) {
    console.error("[calculate-dynamic-price] Error:", err);
    return respond(500, {
      success: false,
      error: err?.message || String(err),
    });
  }
});

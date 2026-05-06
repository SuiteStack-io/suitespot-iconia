import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateDynamicRate,
  computeMonthBounds,
  computeMonthPhase,
  type DynamicPricingContext,
} from "../_shared/dynamic-pricing.ts";

/**
 * calculate-dynamic-price
 *
 * Service-role function that calculates the dynamically-adjusted nightly
 * rate for a given (property, room_type, rate_plan, target_date) tuple.
 *
 * Now a thin loader: it fetches the data, builds a DynamicPricingContext
 * (with month caches pre-seeded from SQL), delegates the math to the
 * shared helper in _shared/dynamic-pricing.ts, then handles pricing_log
 * insertion and the HTTP response.
 *
 * Called by other edge functions (channex-full-sync, channex-daily-sync,
 * channex-process-sync-queue), not by users directly.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

    // ── 1. Property ──
    const { data: property } = await supabase
      .from("properties")
      .select("id, weekend_days, off_peak_days, timezone")
      .eq("id", property_id)
      .maybeSingle();

    if (!property) {
      return respond(404, { success: false, error: "Property not found" });
    }
    const propertyTimezone: string = property.timezone || "Africa/Cairo";

    // Today in property timezone (en-CA returns YYYY-MM-DD).
    const todayStrInTz = new Date().toLocaleDateString("en-CA", {
      timeZone: propertyTimezone,
    });

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

    // ── 3. Pricing rules ──
    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("property_id", property_id)
      .maybeSingle();

    // ── 4. Overrides for the target date ──
    const { data: overrideMatches } = await supabase
      .from("pricing_overrides")
      .select("id, override_type, value, room_type, override_date, property_id")
      .eq("property_id", property_id)
      .eq("override_date", target_date);

    // ── 5. Units (active, non-maintenance) ──
    const { data: allUnits } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", property_id)
      .neq("status", "maintenance");

    const units = (allUnits ?? []) as { id: string }[];

    // ── 6. Month bounds + phase (shared helper) ──
    const { monthStartStr, monthEndExclusiveStr } =
      computeMonthBounds(target_date);
    const monthPhase = computeMonthPhase(target_date, todayStrInTz);
    const targetMonth = target_date.slice(0, 7); // 'YYYY-MM'

    // ── 7. Reservations for occupancy (same query as before) ──
    let monthReservations: any[] = [];
    if (units.length > 0) {
      const unitIds = units.map((u) => u.id);
      const { data } = await supabase
        .from("reservations")
        .select(
          "unit_id, property_id, status, check_in_date, check_out_date, total_price",
        )
        .in("status", ["confirmed", "checked-in"])
        .in("unit_id", unitIds)
        .lt("check_in_date", monthEndExclusiveStr)
        .gt("check_out_date", monthStartStr);
      monthReservations = (data ?? []) as any[];
    }

    // Pre-compute booked nights for the cache (mirrors helper logic).
    let bookedNightsSeed = 0;
    if (units.length > 0) {
      const unitIdSet = new Set(units.map((u) => u.id));
      for (const r of monthReservations) {
        if (!unitIdSet.has(r.unit_id)) continue;
        const ci = r.check_in_date as string;
        const co = r.check_out_date as string;
        const overlapStart = ci > monthStartStr ? ci : monthStartStr;
        const overlapEndExclusive =
          co < monthEndExclusiveStr ? co : monthEndExclusiveStr;
        if (overlapEndExclusive > overlapStart) {
          const a = new Date(overlapStart + "T00:00:00Z").getTime();
          const b = new Date(overlapEndExclusive + "T00:00:00Z").getTime();
          const nights = Math.round((b - a) / 86400000);
          if (nights > 0) bookedNightsSeed += nights;
        }
      }
    }

    // ── 8. Phase-aware revenue query — preserves existing SQL behavior ──
    let revenueReservations: any[] = [];
    if (monthPhase === "A") {
      const { data: revRes } = await supabase
        .from("reservations")
        .select(
          "unit_id, property_id, status, check_in_date, check_out_date, total_price",
        )
        .eq("property_id", property_id)
        .in("status", ["confirmed", "checked-in"])
        .gte("check_in_date", monthStartStr)
        .lt("check_in_date", monthEndExclusiveStr);
      revenueReservations = (revRes ?? []) as any[];
    } else if (monthPhase === "B") {
      const { data: revRes } = await supabase
        .from("reservations")
        .select(
          "unit_id, property_id, status, check_in_date, check_out_date, total_price",
        )
        .eq("property_id", property_id)
        .in("status", ["confirmed", "checked-in"])
        .lt("check_in_date", monthEndExclusiveStr)
        .gt("check_out_date", monthStartStr);
      revenueReservations = (revRes ?? []) as any[];
    }

    let revenueSeed = 0;
    if (monthPhase !== "historical") {
      for (const r of revenueReservations) {
        revenueSeed += Number(r.total_price ?? 0);
      }
    }

    // ── 9. Active matching promotions ──
    const { data: matchingPromos } = await supabase
      .from("promotional_periods")
      .select(
        "id, discount_type, discount_value, room_types, created_at, booking_window_start, booking_window_end, stay_start, stay_end, is_active, property_id",
      )
      .eq("property_id", property_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .lte("booking_window_start", todayStrInTz)
      .gte("booking_window_end", todayStrInTz)
      .lte("stay_start", target_date)
      .gte("stay_end", target_date);

    // ── 10. Build context with pre-seeded caches ──
    // Combine occupancy + revenue reservations so the helper has every row
    // it could need — though with both caches pre-seeded for targetMonth,
    // the helper won't actually iterate ctx.reservations on the EF path.
    const dedupeKey = (r: any) =>
      r.id ??
      `${r.unit_id}|${r.check_in_date}|${r.check_out_date}|${r.property_id}`;
    const seen = new Set<string>();
    const allReservations: any[] = [];
    for (const r of [...monthReservations, ...revenueReservations]) {
      const k = dedupeKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      allReservations.push(r);
    }

    const ctx: DynamicPricingContext = {
      property: {
        id: property.id,
        weekend_days: property.weekend_days || [4, 5],
        off_peak_days: property.off_peak_days || [],
        timezone: propertyTimezone,
      },
      pricingRules: rules ?? null,
      reservations: allReservations,
      units,
      overrides: (overrideMatches ?? []) as any[],
      promotions: (matchingPromos ?? []) as any[],
      todayStrInTz,
      monthlyBookedNightsByMonth: { [targetMonth]: bookedNightsSeed },
      monthlyRevenueByMonth: { [targetMonth]: revenueSeed },
    };

    // ── 11. Delegate the math ──
    const result = calculateDynamicRate(ctx, {
      room_type,
      rate_plan_id,
      target_date,
      priceRow: {
        weekday_rate: Number(priceRow.weekday_rate),
        weekend_rate:
          priceRow.weekend_rate != null ? Number(priceRow.weekend_rate) : null,
        off_peak_rate:
          priceRow.off_peak_rate != null
            ? Number(priceRow.off_peak_rate)
            : null,
        min_rate: priceRow.min_rate != null ? Number(priceRow.min_rate) : null,
        max_rate: priceRow.max_rate != null ? Number(priceRow.max_rate) : null,
      },
    });

    // ── 12. Static fast path response (no log row) ──
    if (result.kind === "static") {
      return respond(200, {
        success: true,
        base_rate: result.base_rate,
        final_rate: result.final_rate,
        adjustments: {
          day_of_week_multiplier: 1,
          occupancy_percent: null,
          occupancy_adjustment: 0,
          pace_index: null,
          pace_index_bumped: false,
          revenue_achievement_percent: null,
          revenue_adjustment: 0,
          month_phase: null,
          room_type_min_rate: result.room_type_min_rate,
          room_type_max_rate: result.room_type_max_rate,
          override_active: false,
          was_clamped: result.was_clamped,
          clamp_direction: result.clamp_direction,
          static_reason: result.static_reason,
        },
      });
    }

    // ── 13. Log (only when month_phase is 'A' or 'B' — CHECK constraint) ──
    if (result.month_phase === "A" || result.month_phase === "B") {
      await supabase.from("pricing_log").insert({
        property_id,
        date_priced: target_date,
        target_month: targetMonth,
        month_phase: result.month_phase,
        room_type,
        rate_plan_id,
        base_rate: result.base_rate,
        calculated_rate: round2(result.calculated_rate),
        final_rate: result.final_rate,
        day_of_week_multiplier: result.day_of_week_multiplier,
        occupancy_percent: result.occupancy_percent,
        occupancy_tier: result.occupancy_tier,
        occupancy_adjustment_percent: result.occupancy_adjustment_percent,
        pace_index: result.pace_index,
        revenue_total: result.revenue_total,
        revenue_achievement_percent: result.revenue_achievement_percent,
        revenue_adjustment_percent: result.revenue_adjustment_percent,
        room_type_min_rate: result.room_type_min_rate,
        room_type_max_rate: result.room_type_max_rate,
        was_clamped: result.was_clamped,
        clamp_direction: result.clamp_direction,
        override_id: result.override?.id ?? null,
        override_active: !!result.override,
        promotion_id: result.promotion?.id ?? null,
        promotion_discount_percent: result.promotion?.discount_percent ?? null,
      });
    }

    // ── 14. Response ──
    return respond(200, {
      success: true,
      base_rate: result.base_rate,
      final_rate: result.final_rate,
      adjustments: {
        day_of_week_multiplier: result.day_of_week_multiplier,
        occupancy_percent: result.occupancy_percent,
        occupancy_adjustment: result.occupancy_adjustment_percent,
        pace_index: result.pace_index,
        pace_index_bumped: result.pace_index_bumped,
        revenue_achievement_percent: result.revenue_achievement_percent,
        revenue_adjustment: result.revenue_adjustment_percent,
        month_phase: result.month_phase,
        room_type_min_rate: result.room_type_min_rate,
        room_type_max_rate: result.room_type_max_rate,
        override_active: !!result.override,
        was_clamped: result.was_clamped,
        clamp_direction: result.clamp_direction,
        promotion_applied: result.promotion
          ? {
              id: result.promotion.id,
              discount_percent: result.promotion.discount_percent,
            }
          : null,
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

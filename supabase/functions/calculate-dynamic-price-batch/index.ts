/**
 * calculate-dynamic-price-batch
 *
 * Read-only batch endpoint that returns dynamic-rate calculations for a
 * date range. Loads all dependencies ONCE then loops through dates using
 * the shared helper. Does NOT insert into pricing_log — preview only.
 */

// ── Imports (dynamic so we can log import failures at boot) ──
let createClient: any;
let calculateDynamicRate: any;
type DynamicPricingContext = any;

try {
  const supaMod = await import("https://esm.sh/@supabase/supabase-js@2");
  createClient = supaMod.createClient;
  const helperMod = await import("../_shared/dynamic-pricing.ts");
  calculateDynamicRate = helperMod.calculateDynamicRate;
  console.log("[batch] Imports loaded successfully");
} catch (importErr) {
  console.error("[batch] Import failed:", importErr);
  throw importErr;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysStr(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  try {
    console.log("[batch] Function started");

    if (req.method === "OPTIONS") {
      console.log("[batch] CORS preflight handled");
      return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { property_id, room_type, rate_plan_id, date_from, date_to } =
      body ?? {};
    console.log("[batch] Body parsed:", {
      property_id,
      room_type,
      rate_plan_id,
      date_from,
      date_to,
    });

    if (!property_id || !room_type || !rate_plan_id || !date_from || !date_to) {
      return respond(400, {
        success: false,
        error:
          "property_id, room_type, rate_plan_id, date_from, date_to are required",
      });
    }
    if (!isYmd(date_from) || !isYmd(date_to)) {
      return respond(400, {
        success: false,
        error: "date_from and date_to must be YYYY-MM-DD",
      });
    }
    if (date_to < date_from) {
      return respond(400, {
        success: false,
        error: "date_to must be >= date_from",
      });
    }

    // ── Property ──
    const { data: property } = await supabase
      .from("properties")
      .select("id, weekend_days, off_peak_days, timezone")
      .eq("id", property_id)
      .maybeSingle();
    if (!property) {
      return respond(404, { success: false, error: "Property not found" });
    }
    const propertyTimezone: string = property.timezone || "Africa/Cairo";
    const todayStrInTz = new Date().toLocaleDateString("en-CA", {
      timeZone: propertyTimezone,
    });
    console.log("[batch] Property loaded:", {
      id: property.id,
      timezone: propertyTimezone,
    });

    // ── Rate plan ──
    const { data: ratePlan } = await supabase
      .from("rate_plans")
      .select("id")
      .eq("id", rate_plan_id)
      .maybeSingle();
    if (!ratePlan) {
      return respond(404, { success: false, error: "Rate plan not found" });
    }
    console.log("[batch] Rate plan validated:", { id: ratePlan.id });

    // ── Price row ──
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
    console.log("[batch] Price row loaded:", priceRow);

    // ── Pricing rules ──
    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("property_id", property_id)
      .maybeSingle();
    console.log("[batch] Pricing rules loaded:", {
      is_enabled: rules?.is_enabled ?? null,
    });

    // ── Active units ──
    const { data: allUnits } = await supabase
      .from("units")
      .select("id")
      .eq("property_id", property_id)
      .neq("status", "maintenance");
    const units = (allUnits ?? []) as { id: string }[];
    console.log("[batch] Units loaded:", { count: units.length });

    // ── Overrides across the range ──
    const { data: overrides } = await supabase
      .from("pricing_overrides")
      .select("id, override_type, value, room_type, override_date, property_id")
      .eq("property_id", property_id)
      .gte("override_date", date_from)
      .lte("override_date", date_to);
    console.log("[batch] Overrides loaded:", {
      count: (overrides ?? []).length,
    });

    // ── Reservations spanning [date_from, date_to+1) ──
    const rangeEndExclusive = addDaysStr(date_to, 1);
    let reservations: any[] = [];
    if (units.length > 0) {
      const unitIds = units.map((u) => u.id);
      const { data: resData } = await supabase
        .from("reservations")
        .select(
          "unit_id, property_id, status, check_in_date, check_out_date, total_price",
        )
        .in("status", ["confirmed", "checked-in"])
        .in("unit_id", unitIds)
        .lt("check_in_date", rangeEndExclusive)
        .gt("check_out_date", date_from);
      reservations = (resData ?? []) as any[];
    }

    // Phase B for the active month requires reservations whose check_in
    // may be before date_from too — re-fetch a wider window per month if
    // needed. For preview we expand the lower bound to the first of the
    // earliest month.
    const earliestMonthStart = date_from.slice(0, 7) + "-01";
    if (earliestMonthStart < date_from && units.length > 0) {
      const unitIds = units.map((u) => u.id);
      const { data: extra } = await supabase
        .from("reservations")
        .select(
          "unit_id, property_id, status, check_in_date, check_out_date, total_price",
        )
        .in("status", ["confirmed", "checked-in"])
        .in("unit_id", unitIds)
        .lt("check_in_date", date_from)
        .gt("check_out_date", earliestMonthStart);
      reservations = reservations.concat((extra ?? []) as any[]);
    }
    console.log("[batch] Reservations loaded:", { count: reservations.length });

    // ── Promotions ──
    const { data: promotions } = await supabase
      .from("promotional_periods")
      .select(
        "id, discount_type, discount_value, room_types, created_at, booking_window_start, booking_window_end, stay_start, stay_end, is_active, property_id",
      )
      .eq("property_id", property_id)
      .eq("is_active", true)
      .lte("booking_window_start", todayStrInTz)
      .gte("booking_window_end", todayStrInTz)
      .lte("stay_start", date_to)
      .gte("stay_end", date_from);
    console.log("[batch] Promotions loaded:", {
      count: (promotions ?? []).length,
    });

    // ── Build context (lazy month caches start empty) ──
    const ctx: DynamicPricingContext = {
      property: {
        id: property.id,
        weekend_days: property.weekend_days || [4, 5],
        off_peak_days: property.off_peak_days || [],
        timezone: propertyTimezone,
      },
      pricingRules: rules ?? null,
      reservations,
      units,
      overrides: (overrides ?? []) as any[],
      promotions: (promotions ?? []) as any[],
      todayStrInTz,
      monthlyBookedNightsByMonth: {},
      monthlyRevenueByMonth: {},
    };

    const priceRowNorm = {
      weekday_rate: Number(priceRow.weekday_rate),
      weekend_rate:
        priceRow.weekend_rate != null ? Number(priceRow.weekend_rate) : null,
      off_peak_rate:
        priceRow.off_peak_rate != null ? Number(priceRow.off_peak_rate) : null,
      min_rate: priceRow.min_rate != null ? Number(priceRow.min_rate) : null,
      max_rate: priceRow.max_rate != null ? Number(priceRow.max_rate) : null,
    };

    // ── Loop dates ──
    const startMs = new Date(date_from + "T00:00:00Z").getTime();
    const endMs = new Date(date_to + "T00:00:00Z").getTime();
    const numDays = Math.round((endMs - startMs) / 86400000) + 1;
    console.log(
      `[batch] Calculating dates from ${date_from} to ${date_to}, total ${numDays} days`,
    );

    const rates: any[] = [];
    let cursor = date_from;
    while (cursor <= date_to) {
      const result = calculateDynamicRate(ctx, {
        room_type,
        rate_plan_id,
        target_date: cursor,
        priceRow: priceRowNorm,
      });

      if (result.kind === "static") {
        rates.push({
          target_date: cursor,
          base_rate: result.base_rate,
          final_rate: result.final_rate,
          adjustments: {
            day_of_week_multiplier: 1,
            occupancy_percent: null,
            occupancy_adjustment: 0,
            revenue_adjustment: 0,
            month_phase: null,
            override_active: false,
            was_clamped: result.was_clamped,
            clamp_direction: result.clamp_direction,
            promotion_applied: null,
          },
        });
      } else {
        rates.push({
          target_date: cursor,
          base_rate: result.base_rate,
          final_rate: result.final_rate,
          adjustments: {
            day_of_week_multiplier: result.day_of_week_multiplier,
            occupancy_percent: result.occupancy_percent,
            occupancy_adjustment: result.occupancy_adjustment_percent,
            revenue_adjustment: result.revenue_adjustment_percent,
            month_phase: result.month_phase,
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
      }

      cursor = addDaysStr(cursor, 1);
    }
    console.log("[batch] Loop completed, results count:", rates.length);

    console.log("[batch] Returning success response");
    return respond(200, { success: true, rates });
  } catch (err: any) {
    console.error("[batch] FATAL ERROR:", err?.message);
    console.error("[batch] Stack:", err?.stack);
    console.error("[batch] Error name:", err?.name);
    return respond(500, {
      success: false,
      error: err?.message || String(err),
    });
  }
});

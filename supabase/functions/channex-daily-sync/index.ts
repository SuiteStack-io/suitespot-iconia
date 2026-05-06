
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync, createAlert } from "../_shared/channex-client.ts";
import { calculateDynamicRate, type DynamicPricingContext } from "../_shared/dynamic-pricing.ts";

/**
 * channex-daily-sync
 *
 * Scheduled daily backup: pushes all availability and rates for the next
 * 365 days to Channex. Ensures data consistency even if real-time triggers
 * missed updates.
 *
 * Called by pg_cron – no user auth required.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 6000; // 6s between batches → max 10 req/min

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const summary = {
    properties_synced: 0,
    availability_values_pushed: 0,
    rate_values_pushed: 0,
    restriction_values_pushed: 0,
    errors: [] as string[],
  };

  try {
    // ── 1. Get all synced properties ─────────────────────────────
    const { data: propertyMappings, error: propErr } = await supabase
      .from("channex_mappings")
      .select("*")
      .eq("entity_type", "property")
      .eq("sync_status", "synced");

    if (propErr) throw new Error(`Failed to fetch property mappings: ${propErr.message}`);
    if (!propertyMappings || propertyMappings.length === 0) {
      return respond(200, { success: true, message: "No synced properties found", summary, duration_seconds: elapsed(startTime) });
    }

    // Filter to only properties that still exist in the properties table
    const { data: activeProperties } = await supabase
      .from("properties")
      .select("id");
    const activePropertyIds = new Set((activeProperties || []).map((p: any) => p.id));
    const validMappings = propertyMappings.filter((m: any) => activePropertyIds.has(m.local_id));

    console.log(`[daily-sync] Found ${propertyMappings.length} synced property mappings, ${validMappings.length} active`);

    if (validMappings.length === 0) {
      return respond(200, { success: true, message: "No active synced properties found", summary, duration_seconds: elapsed(startTime) });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = addDays(today, 500);

    // ── 2. Process each property ─────────────────────────────────
    for (const propMapping of validMappings) {
      try {
        console.log(`[daily-sync] Processing property ${propMapping.local_id} (Channex: ${propMapping.channex_id})`);

        // Fetch property pricing config
        const { data: propConfig } = await supabase
          .from("properties")
          .select("id, weekend_days, off_peak_days, timezone")
          .eq("id", propMapping.local_id)
          .maybeSingle();
        const propWeekendDays: number[] = propConfig?.weekend_days || [4, 5];
        const propOffPeakDays: number[] = propConfig?.off_peak_days || [];

        // ── DYNAMIC PRICING PRE-LOAD (per property) ──
        const propertyId = propMapping.local_id;
        const { data: pricingRules } = await supabase
          .from('pricing_rules')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle();
        const dynamicPricingEnabled = pricingRules?.is_enabled === true;

        let promotions: any[] = [];
        let overrides: any[] = [];
        let unitsForOcc: any[] = [];
        let reservationsForOcc: any[] = [];
        let todayInTz: string = '';
        const monthlyRevenueByMonth: Record<string, number> = {};
        const monthlyBookedNightsByMonth: Record<string, number> = {};
        const pricingLogRows: any[] = [];

        if (dynamicPricingEnabled) {
          const tz = propConfig?.timezone || 'Africa/Cairo';
          todayInTz = new Date().toLocaleDateString('en-CA', { timeZone: tz });
          const endDateStr = formatDate(endDate);

          const { data: promosData } = await supabase
            .from('promotional_periods')
            .select('id, discount_type, discount_value, room_types, created_at, stay_start, stay_end, booking_window_start, booking_window_end, is_active')
            .eq('property_id', propertyId)
            .eq('is_active', true)
            .lte('booking_window_start', todayInTz)
            .gte('booking_window_end', todayInTz)
            .lte('stay_start', endDateStr)
            .gte('stay_end', todayInTz);
          promotions = promosData || [];

          const { data: overridesData } = await supabase
            .from('pricing_overrides')
            .select('id, override_date, override_type, value, room_type, property_id')
            .eq('property_id', propertyId)
            .gte('override_date', todayInTz)
            .lte('override_date', endDateStr);
          overrides = overridesData || [];

          const { data: unitsData } = await supabase
            .from('units')
            .select('id, status')
            .eq('property_id', propertyId)
            .neq('status', 'maintenance');
          unitsForOcc = unitsData || [];

          const { data: resData } = await supabase
            .from('reservations')
            .select('id, unit_id, property_id, check_in_date, check_out_date, total_price, status')
            .eq('property_id', propertyId)
            .in('status', ['confirmed', 'checked-in'])
            .lt('check_in_date', endDateStr)
            .gt('check_out_date', todayInTz);
          reservationsForOcc = resData || [];
        }

        const dynamicCtx: DynamicPricingContext | null = dynamicPricingEnabled
          ? {
              property: {
                id: propertyId,
                weekend_days: propWeekendDays,
                off_peak_days: propOffPeakDays,
                timezone: propConfig?.timezone || 'Africa/Cairo',
              },
              pricingRules,
              reservations: reservationsForOcc,
              units: unitsForOcc,
              overrides,
              promotions,
              todayStrInTz: todayInTz,
              monthlyBookedNightsByMonth,
              monthlyRevenueByMonth,
            }
          : null;

        // ── 2a. AVAILABILITY ──────────────────────────────────────
        const { data: roomTypeMappings } = await supabase
          .from("channex_mappings")
          .select("*")
          .eq("entity_type", "room_type")
          .eq("sync_status", "synced");

        if (roomTypeMappings && roomTypeMappings.length > 0) {
          for (const rtMapping of roomTypeMappings) {
            try {
              // Get room type name from the unit and verify it belongs to this property
              const { data: unitData } = await supabase
                .from("units")
                .select("booking_com_name, property_id")
                .eq("id", rtMapping.local_id)
                .maybeSingle();

              // Skip room types that don't belong to this property
              if (!unitData || unitData.property_id !== propMapping.local_id) {
                continue;
              }

              if (!unitData?.booking_com_name) {
                summary.errors.push(`Room type ${rtMapping.local_id}: no booking_com_name`);
                continue;
              }

              // Get all units of this room type (not maintenance)
              const { data: allUnits } = await supabase
                .from("units")
                .select("id")
                .eq("booking_com_name", unitData.booking_com_name)
                .neq("status", "maintenance");

              const totalUnits = allUnits?.length || 0;
              if (totalUnits === 0) continue;

              const unitIds = allUnits!.map((u: any) => u.id);

              // Get all reservations overlapping the 365-day window
              const { data: reservations } = await supabase
                .from("reservations")
                .select("unit_id, check_in_date, check_out_date")
                .in("status", ["confirmed", "checked-in"])
                .in("unit_id", unitIds)
                .lt("check_in_date", formatDate(endDate))
                .gt("check_out_date", formatDate(today));

              // Get all blocked dates in the window
              const { data: blockedDates } = await supabase
                .from("blocked_dates")
                .select("unit_id, blocked_date")
                .in("unit_id", unitIds)
                .gte("blocked_date", formatDate(today))
                .lt("blocked_date", formatDate(endDate));

              // Build day-by-day availability
              const availByDate: { date: string; avail: number }[] = [];
              for (let d = new Date(today); d < endDate; d = addDays(d, 1)) {
                const ds = formatDate(d);
                // Count reservations overlapping this date
                let reserved = 0;
                const occupiedUnits = new Set<string>();
                if (reservations) {
                  for (const r of reservations) {
                    if (r.check_in_date <= ds && r.check_out_date > ds && r.unit_id) {
                      occupiedUnits.add(r.unit_id);
                    }
                  }
                }
                reserved = occupiedUnits.size;

                // Count blocked dates on this date
                let blocked = 0;
                const blockedUnits = new Set<string>();
                if (blockedDates) {
                  for (const b of blockedDates) {
                    if (b.blocked_date === ds && b.unit_id && !occupiedUnits.has(b.unit_id)) {
                      blockedUnits.add(b.unit_id);
                    }
                  }
                }
                blocked = blockedUnits.size;

                availByDate.push({ date: ds, avail: Math.max(0, totalUnits - reserved - blocked) });
              }

              // Collapse consecutive same-availability dates into ranges
              const ranges: { date_from: string; date_to: string; availability: number }[] = [];
              let rangeStart = availByDate[0];
              let currentAvail = rangeStart.avail;
              let lastDate = rangeStart.date;

              for (let i = 1; i < availByDate.length; i++) {
                if (availByDate[i].avail === currentAvail) {
                  lastDate = availByDate[i].date;
                } else {
                  ranges.push({
                    date_from: rangeStart.date,
                    date_to: formatDate(addDays(new Date(lastDate), 1)),
                    availability: currentAvail,
                  });
                  rangeStart = availByDate[i];
                  currentAvail = rangeStart.avail;
                  lastDate = rangeStart.date;
                }
              }
              // Push last range
              ranges.push({
                date_from: rangeStart.date,
                date_to: formatDate(addDays(new Date(lastDate), 1)),
                availability: currentAvail,
              });

              // Build values array
              const availValues = ranges.map((r) => ({
                property_id: propMapping.channex_id,
                room_type_id: rtMapping.channex_id,
                date_from: r.date_from,
                date_to: r.date_to,
                availability: r.availability,
              }));

              // Push in batches of 10
              for (let i = 0; i < availValues.length; i += BATCH_SIZE) {
                const batch = availValues.slice(i, i + BATCH_SIZE);
                try {
                  await channexRequest("POST", "/api/v1/availability", { values: batch });
                  summary.availability_values_pushed += batch.length;
                } catch (err: any) {
                  summary.errors.push(`Availability push failed for ${unitData.booking_com_name} batch ${i / BATCH_SIZE}: ${err.message}`);
                }
                if (i + BATCH_SIZE < availValues.length) await delay(BATCH_DELAY_MS);
              }

              console.log(`[daily-sync] Pushed ${availValues.length} availability ranges for ${unitData.booking_com_name}`);
            } catch (err: any) {
              summary.errors.push(`Room type ${rtMapping.local_id}: ${err.message}`);
            }
          }
        }

        // ── 2b. RATES + RESTRICTIONS ──────────────────────────────
        const { data: ratePlanMappings } = await supabase
          .from("channex_mappings")
          .select("*")
          .eq("entity_type", "rate_plan")
          .eq("sync_status", "synced");

        if (ratePlanMappings && ratePlanMappings.length > 0) {
          for (const rpMapping of ratePlanMappings) {
            try {
              // Get rate plan details (including default restrictions)
              const { data: ratePlan, error: rpError } = await supabase
                .from("rate_plans")
                .select("*")
                .eq("id", rpMapping.local_id)
                .maybeSingle();

              if (rpError) {
                summary.errors.push(`Rate plan ${rpMapping.local_id}: query error - ${rpError.message}`);
                continue;
              }
              if (!ratePlan) {
                summary.errors.push(`Rate plan ${rpMapping.local_id}: not found`);
                continue;
              }

              // Skip rate plans that don't belong to this property
              if (ratePlan.property_id !== propMapping.local_id) {
                continue;
              }

              // Get prices for this rate plan
              const { data: prices } = await supabase
                .from("rate_plan_prices")
                .select("*")
                .eq("rate_plan_id", rpMapping.local_id);

              if (!prices || prices.length === 0) continue;

              // Get date-specific restrictions for this rate plan
              const { data: dateRestrictions } = await supabase
                .from("rate_plan_restrictions")
                .select("*")
                .eq("rate_plan_id", rpMapping.local_id)
                .lt("date_from", formatDate(endDate))
                .gt("date_to", formatDate(today));

              // Get date-specific rate overrides for this rate plan
              const { data: dateOverrides } = await supabase
                .from("rate_plan_date_overrides")
                .select("*")
                .eq("rate_plan_id", rpMapping.local_id)
                .gte("override_date", formatDate(today))
                .lt("override_date", formatDate(endDate));

              const dateFrom = ratePlan.valid_from || formatDate(today);
              const dateTo = ratePlan.valid_to || formatDate(endDate);

              // Build rate values with 30-day chunking to avoid Channex 500 errors
              const rateValues: object[] = [];
              const CHUNK_DAYS = 30;
              const todayStr = formatDate(today);

              // Default restriction values
              const defaultMinStayArr = ratePlan.default_min_stay_arrival;
              const defaultMinStayVal = Array.isArray(defaultMinStayArr) && defaultMinStayArr.length > 0 ? defaultMinStayArr[0] : 1;
              const defaultMinThroughArr = ratePlan.default_min_stay_through;
              const defaultMinThroughVal = Array.isArray(defaultMinThroughArr) && defaultMinThroughArr.length > 0 ? defaultMinThroughArr[0] : 1;

              for (const p of prices) {
                // Build day-by-day rates (default from rate_plan_prices)
                const rateStart = new Date(dateFrom < todayStr ? todayStr : dateFrom);
                const rateEnd = new Date(dateTo);
                const dailyRates: { date: string; rate: number }[] = [];

                if (dynamicCtx) {
                  for (let d = new Date(rateStart); d < rateEnd; d = addDays(d, 1)) {
                    const ds = formatDate(d);
                    const result = calculateDynamicRate(dynamicCtx, {
                      target_date: ds,
                      room_type: p.room_type,
                      rate_plan_id: ratePlan.id,
                      priceRow: {
                        weekday_rate: p.weekday_rate,
                        weekend_rate: p.weekend_rate,
                        off_peak_rate: p.off_peak_rate,
                        min_rate: p.min_rate,
                        max_rate: p.max_rate,
                      },
                    });
                    dailyRates.push({ date: ds, rate: Math.round(result.final_rate * 100) });

                    if (result.kind === 'dynamic' && (result.month_phase === 'A' || result.month_phase === 'B')) {
                      pricingLogRows.push({
                        property_id: propertyId,
                        date_priced: ds,
                        target_month: ds.slice(0, 7),
                        month_phase: result.month_phase,
                        room_type: p.room_type,
                        rate_plan_id: ratePlan.id,
                        base_rate: result.base_rate,
                        calculated_rate: result.calculated_rate,
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
                        override_id: result.override?.id || null,
                        override_active: !!result.override,
                        promotion_id: result.promotion?.id || null,
                        promotion_discount_percent: result.promotion?.discount_percent || null,
                      });
                    }
                  }
                } else {
                  const weekdayRateCents = Math.round(p.weekday_rate * 100);
                  const weekendRateCents = p.weekend_rate ? Math.round(p.weekend_rate * 100) : weekdayRateCents;
                  const offPeakRateCents = p.off_peak_rate ? Math.round(p.off_peak_rate * 100) : weekdayRateCents;
                  console.log(`[daily-sync] Rate plan ${ratePlan.name}: weekday=${weekdayRateCents} weekend=${weekendRateCents} offpeak=${offPeakRateCents} cents`);

                  for (let d = new Date(rateStart); d < rateEnd; d = addDays(d, 1)) {
                    const ds = formatDate(d);
                    const dow = d.getDay();
                    let rateCents = weekdayRateCents;
                    if (propOffPeakDays.length > 0 && propOffPeakDays.includes(dow) && offPeakRateCents > 0) {
                      rateCents = offPeakRateCents;
                    } else if (propWeekendDays.includes(dow) && weekendRateCents > 0) {
                      rateCents = weekendRateCents;
                    }
                    dailyRates.push({ date: ds, rate: rateCents });
                  }
                }

                // Overlay rate overrides: priority 1 = rate_plan_restrictions, priority 2 = rate_plan_date_overrides
                // Both tables now store rates in DOLLARS — convert to cents for Channex
                for (const day of dailyRates) {
                  // Skip rate_plan_restrictions.rate overlay when dynamic pricing is active —
                  // engine output wins. Other restriction fields handled elsewhere.
                  if (!dynamicCtx) {
                    const restrictionOverride = dateRestrictions?.find(
                      (r: any) => r.rate != null && r.date_from <= day.date && r.date_to > day.date
                    );
                    if (restrictionOverride) {
                      day.rate = Math.round(restrictionOverride.rate * 100);
                      continue;
                    }
                  }
                  // rate_plan_date_overrides always applies (stored in dollars)
                  const dateOverride = dateOverrides?.find(
                    (o: any) => o.override_date === day.date
                  );
                  if (dateOverride) {
                    day.rate = Math.round(dateOverride.rate * 100);
                  }
                }

                // Collapse consecutive same-rate days into ranges (max 30 days each)
                let rangeIdx = 0;
                while (rangeIdx < dailyRates.length) {
                  const segStart = dailyRates[rangeIdx];
                  let segRate = segStart.rate;
                  let segLastDate = segStart.date;
                  let segDayCount = 1;

                  while (rangeIdx + segDayCount < dailyRates.length && segDayCount < CHUNK_DAYS) {
                    const next = dailyRates[rangeIdx + segDayCount];
                    if (next.rate !== segRate) break;
                    segLastDate = next.date;
                    segDayCount++;
                  }

                  const segRestriction = dateRestrictions?.find(
                    (r: any) => r.date_from <= segStart.date && r.date_to >= segLastDate
                  );

                  const value: Record<string, any> = {
                    property_id: propMapping.channex_id,
                    rate_plan_id: rpMapping.channex_id,
                    date_from: segStart.date,
                    date_to: formatDate(addDays(new Date(segLastDate), 1)),
                    rate: segRate,
                    min_stay_arrival: segRestriction?.min_stay_arrival ?? defaultMinStayVal,
                    min_stay_through: segRestriction?.min_stay_through ?? defaultMinThroughVal,
                    stop_sell: segRestriction?.stop_sell ?? ratePlan.default_stop_sell ?? false,
                    closed_to_arrival: segRestriction?.closed_to_arrival ?? ratePlan.default_closed_to_arrival ?? false,
                    closed_to_departure: segRestriction?.closed_to_departure ?? ratePlan.default_closed_to_departure ?? false,
                  };

                  const maxStay = segRestriction?.max_stay ?? ratePlan.default_max_stay ?? null;
                  if (maxStay) value.max_stay = maxStay;

                  rateValues.push(value);
                  rangeIdx += segDayCount;
                }
              }

              console.log(`[daily-sync] Plan ${ratePlan.name}: ${rateValues.length} chunked rate+restriction values (${dateFrom} to ${dateTo})`);

              // Push in batches of 10
              for (let i = 0; i < rateValues.length; i += BATCH_SIZE) {
                const batch = rateValues.slice(i, i + BATCH_SIZE);
                console.log(`[daily-sync] Pushing rate+restriction batch ${i / BATCH_SIZE} for ${ratePlan.name}:`, JSON.stringify(batch));
                try {
                  await channexRequest("POST", "/api/v1/restrictions", { values: batch });
                  summary.rate_values_pushed += batch.length;
                  summary.restriction_values_pushed += batch.length;
                } catch (err: any) {
                  summary.errors.push(`Rate push failed for plan ${ratePlan.name} batch ${i / BATCH_SIZE}: ${err.message}`);
                }
                if (i + BATCH_SIZE < rateValues.length) await delay(BATCH_DELAY_MS);
              }

              // Mark date-specific restrictions as synced
              if (dateRestrictions && dateRestrictions.length > 0) {
                const restrictionIds = dateRestrictions.map((r: any) => r.id);
                await supabase
                  .from("rate_plan_restrictions")
                  .update({ synced_to_channex: true })
                  .in("id", restrictionIds);
              }

              console.log(`[daily-sync] Pushed ${rateValues.length} rate+restriction values for plan ${ratePlan.name}`);
            } catch (err: any) {
              summary.errors.push(`Rate plan ${rpMapping.local_id}: ${err.message}`);
            }
          }
        }

        // ── Batched pricing_log insert (per property) ──
        if (pricingLogRows.length > 0) {
          const { error: logErr } = await supabase
            .from('pricing_log')
            .insert(pricingLogRows);
          if (logErr) {
            console.error(`[daily-sync] pricing_log insert failed for property ${propertyId}:`, logErr);
          }
        }

        summary.properties_synced++;
      } catch (err: any) {
        summary.errors.push(`Property ${propMapping.local_id}: ${err.message}`);
      }
    }

    // ── 3. Log summary ──────────────────────────────────────────
    await logSync(
      "channex-daily-sync",
      "full-sync",
      { summary },
      { summary },
      200,
      summary.errors.length === 0,
      summary.errors.length > 0 ? summary.errors.join("; ") : null,
      propertyMappings[0]?.local_id || null
    );

    // Create alert if there were errors
    if (summary.errors.length > 0) {
      await createAlert(
        'sync_error',
        `Daily sync completed with ${summary.errors.length} error(s): ${summary.errors.slice(0, 3).join('; ')}`,
        propertyMappings[0]?.local_id || null
      );
    }

    return respond(200, { success: true, summary, duration_seconds: elapsed(startTime) });
  } catch (err: any) {
    console.error("[daily-sync] Fatal error:", err);
    try {
      await logSync("channex-daily-sync", "full-sync", null, null, null, false, err.message, null);
    } catch (_e) { /* ignore */ }
    return respond(500, { success: false, error: err.message, summary, duration_seconds: elapsed(startTime) });
  }
});

function elapsed(start: number): number {
  return Math.round((Date.now() - start) / 1000);
}

function respond(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

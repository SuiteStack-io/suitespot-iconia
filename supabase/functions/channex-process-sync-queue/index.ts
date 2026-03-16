
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { channexRequest, logSync, createAlert } from "../_shared/channex-client.ts";

/**
 * channex-process-sync-queue
 *
 * Called by pg_net from database triggers. Reads all pending items from
 * channex_sync_queue, batches them by type (availability / rate), resolves
 * Channex IDs, pushes to the Channex API, and marks rows completed/failed.
 *
 * No user auth – called with service role key from triggers.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── 0. Wait for concurrent trigger-fired items to accumulate ──
    await new Promise(r => setTimeout(r, 30000));

    // ── 1. Claim pending rows ──────────────────────────────────
    const { data: pending, error: fetchErr } = await supabase
      .from("channex_sync_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) throw new Error(`Failed to fetch queue: ${fetchErr.message}`);
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mark them processing
    const ids = pending.map((r: any) => r.id);
    await supabase
      .from("channex_sync_queue")
      .update({ status: "processing" })
      .in("id", ids);

    console.log(`[process-sync-queue] Processing ${pending.length} items`);

    // ── 2. Split by type ───────────────────────────────────────
    const availabilityItems = pending.filter((r: any) => r.sync_type === "availability");
    const rateItems = pending.filter((r: any) => r.sync_type === "rate");
    const restrictionItems = pending.filter((r: any) => r.sync_type === "restriction");

    // ── Helper: resolve Channex ID ─────────────────────────────
    const mappingCache: Record<string, string | null> = {};
    async function resolve(localId: string, entityType: string): Promise<string | null> {
      const key = `${entityType}:${localId}`;
      if (key in mappingCache) return mappingCache[key];
      const { data } = await supabase
        .from("channex_mappings")
        .select("channex_id")
        .eq("local_id", localId)
        .eq("entity_type", entityType)
        .maybeSingle();
      mappingCache[key] = data?.channex_id || null;
      return mappingCache[key];
    }

    // ── 3. Process AVAILABILITY items ──────────────────────────
    if (availabilityItems.length > 0) {
      // Deduplicate by entity_id + date range
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (const item of availabilityItems) {
        const key = `${item.entity_id}:${item.date_from}:${item.date_to}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }

      // Merge overlapping date ranges for the same entity_id
      const entityMap = new Map<string, any>();
      for (const item of deduped) {
        const eid = item.entity_id;
        if (!entityMap.has(eid)) {
          entityMap.set(eid, { ...item });
        } else {
          const existing = entityMap.get(eid)!;
          if (item.date_from < existing.date_from) existing.date_from = item.date_from;
          if (item.date_to > existing.date_to) existing.date_to = item.date_to;
        }
      }
      const merged = Array.from(entityMap.values());

      const values: object[] = [];

      for (const item of deduped) {
        try {
          const channexRoomTypeId = await resolve(item.entity_id, "room_type");
          if (!channexRoomTypeId) {
            await markFailed(supabase, item.id, "Room type not mapped to Channex");
            continue;
          }

          // Look up the room type name from the unit
          const { data: unitData } = await supabase
            .from("units")
            .select("booking_com_name, location, property_id")
            .eq("id", item.entity_id)
            .maybeSingle();

          if (!unitData?.booking_com_name) {
            await markFailed(supabase, item.id, "Unit has no booking_com_name");
            continue;
          }

          // Resolve the unit's property to get the correct Channex property ID
          const channexPropertyId = unitData.property_id
            ? await resolve(unitData.property_id, "property")
            : null;

          if (!channexPropertyId) {
            await markFailed(supabase, item.id, "No property mapped to Channex");
            continue;
          }

          // Calculate day-by-day availability and collapse into ranges
          const ranges = await calculateAvailabilityRanges(
            supabase,
            unitData.booking_com_name,
            item.date_from,
            item.date_to,
            unitData.property_id
          );

          for (const range of ranges) {
            values.push({
              property_id: channexPropertyId,
              room_type_id: channexRoomTypeId,
              date_from: range.date_from,
              date_to: range.date_to,
              availability: range.availability,
            });
          }

          await markCompleted(supabase, item.id);
        } catch (err: any) {
          await markFailed(supabase, item.id, err.message);
        }
      }

      // Mark deduplicated-out items as completed too
      const dedupedIds = new Set(deduped.map((d: any) => d.id));
      for (const item of availabilityItems) {
        if (!dedupedIds.has(item.id)) {
          await markCompleted(supabase, item.id);
        }
      }

      if (values.length > 0) {
        try {
          const channexPayload = { values };
          console.log(`[process-sync-queue] Pushing ${values.length} availability values`);
          const response = await channexRequest<object>("POST", "/api/v1/availability", channexPayload);
          // Resolve local property ID from the first availability item for logging
          const firstAvailItem = deduped[0];
          let availPropertyId: string | null = null;
          if (firstAvailItem?.entity_id) {
            const { data: avUnit } = await supabase.from("units").select("property_id").eq("id", firstAvailItem.entity_id).maybeSingle();
            availPropertyId = avUnit?.property_id || null;
          }
          await logSync("channex-process-sync-queue", "/api/v1/availability", channexPayload, response, 200, true, null, availPropertyId);
        } catch (err: any) {
          console.error("[process-sync-queue] Availability push failed:", err.message);
          await logSync("channex-process-sync-queue", "/api/v1/availability", null, null, null, false, err.message, null);
          await createAlert('sync_error', `Availability push failed: ${err.message}`);
        }
      }
    }

    // ── 4. Process RATE items ───────────────────────────────────
    if (rateItems.length > 0) {
      const values: object[] = [];

      for (const item of rateItems) {
        try {
          const channexRatePlanId = await resolve(item.entity_id, "rate_plan");
          if (!channexRatePlanId) {
            await markFailed(supabase, item.id, "Rate plan not mapped to Channex");
            continue;
          }

          // Look up the rate plan's property_id to scope property resolution
          const { data: ratePlanData } = await supabase
            .from("rate_plans")
            .select("property_id, valid_from, valid_to")
            .eq("id", item.entity_id)
            .maybeSingle();

          if (!ratePlanData?.property_id) {
            await markFailed(supabase, item.id, "Rate plan has no property_id");
            continue;
          }

          // Get property mapping scoped to the correct property
          const channexPropertyId = await resolve(ratePlanData.property_id, "property");
          if (!channexPropertyId) {
            await markFailed(supabase, item.id, "Property not mapped to Channex");
            continue;
          }

          const payload = item.payload || {};
          const weekdayRate = payload.weekday_rate;
          const weekendRate = payload.weekend_rate;

          if (weekdayRate && weekdayRate > 0) {
            const today = new Date().toISOString().split("T")[0];
            const dateFrom = ratePlanData.valid_from || today;
            const dateTo = ratePlanData.valid_to || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
            const weekdayRateCents = Math.round(weekdayRate * 100);
            const weekendRateCents = weekendRate ? Math.round(weekendRate * 100) : weekdayRateCents;
            const hasDifferentWeekendRate = weekendRateCents !== weekdayRateCents;

            // Chunk into 30-day windows to avoid Channex 500 errors
            const CHUNK_DAYS = 30;
            let chunkStart = new Date(dateFrom);
            const rangeEnd = new Date(dateTo);
            rangeEnd.setDate(rangeEnd.getDate() + 1); // Make date_to inclusive

            while (chunkStart < rangeEnd) {
              const chunkEnd = new Date(Math.min(
                new Date(chunkStart.getTime() + CHUNK_DAYS * 86400000).getTime(),
                rangeEnd.getTime()
              ));
              const chunkFromStr = chunkStart.toISOString().split("T")[0];
              const chunkToStr = chunkEnd.toISOString().split("T")[0];

              // Skip chunks entirely in the past
              if (chunkToStr <= today) {
                chunkStart = chunkEnd;
                continue;
              }

              const effectiveFrom = chunkFromStr < today ? today : chunkFromStr;

              if (!hasDifferentWeekendRate) {
                // Same rate every day — single push for the chunk
                values.push({
                  property_id: channexPropertyId,
                  rate_plan_id: channexRatePlanId,
                  date_from: effectiveFrom,
                  date_to: chunkToStr,
                  rate: weekdayRateCents,
                });
              } else {
                // Split into weekday (Sun-Wed) and weekend (Thu-Sat) date ranges
                const cursor = new Date(effectiveFrom);
                const end = new Date(chunkToStr);
                let weekdayStart: string | null = null;
                let weekendStart: string | null = null;

                const flushWeekday = (beforeDate: string) => {
                  if (weekdayStart) {
                    values.push({
                      property_id: channexPropertyId,
                      rate_plan_id: channexRatePlanId,
                      date_from: weekdayStart,
                      date_to: beforeDate,
                      rate: weekdayRateCents,
                    });
                    weekdayStart = null;
                  }
                };
                const flushWeekend = (beforeDate: string) => {
                  if (weekendStart) {
                    values.push({
                      property_id: channexPropertyId,
                      rate_plan_id: channexRatePlanId,
                      date_from: weekendStart,
                      date_to: beforeDate,
                      rate: weekendRateCents,
                    });
                    weekendStart = null;
                  }
                };

                while (cursor < end) {
                  const dateStr = cursor.toISOString().split("T")[0];
                  const dow = cursor.getDay(); // 0=Sun
                  // Weekend = Thu(4), Fri(5), Sat(6)
                  const isWeekend = dow === 4 || dow === 5 || dow === 6;

                  if (isWeekend) {
                    flushWeekday(dateStr);
                    if (!weekendStart) weekendStart = dateStr;
                  } else {
                    flushWeekend(dateStr);
                    if (!weekdayStart) weekdayStart = dateStr;
                  }
                  cursor.setDate(cursor.getDate() + 1);
                }

                const endStr = end.toISOString().split("T")[0];
                flushWeekday(endStr);
                flushWeekend(endStr);
              }

              chunkStart = chunkEnd;
            }

            console.log(`[process-sync-queue] Chunked rate plan ${item.entity_id}: ${values.length} chunks, weekday=${weekdayRateCents} weekend=${weekendRateCents} cents`);
          }

          await markCompleted(supabase, item.id);
        } catch (err: any) {
          await markFailed(supabase, item.id, err.message);
        }
      }

      if (values.length > 0) {
        try {
          const channexPayload = { values };
          console.log(`[process-sync-queue] Pushing ${values.length} rate values`);
          const response = await channexRequest<object>("POST", "/api/v1/restrictions", channexPayload);
          // Resolve local property ID from first rate item for logging
          const firstRateItem = rateItems[0];
          let ratePropertyId: string | null = null;
          if (firstRateItem?.entity_id) {
            const { data: rpData } = await supabase.from("rate_plans").select("property_id").eq("id", firstRateItem.entity_id).maybeSingle();
            ratePropertyId = rpData?.property_id || null;
          }
          await logSync("channex-process-sync-queue", "/api/v1/restrictions", channexPayload, response, 200, true, null, ratePropertyId);
        } catch (err: any) {
          console.error("[process-sync-queue] Rate push failed:", err.message);
          await logSync("channex-process-sync-queue", "/api/v1/restrictions", null, null, null, false, err.message, null);
          await createAlert('sync_error', `Rate push failed: ${err.message}`);
        }
    }

    // ── 5. Process RESTRICTION items ───────────────────────────────
    if (restrictionItems.length > 0) {
      const values: object[] = [];

      for (const item of restrictionItems) {
        try {
          const channexRatePlanId = await resolve(item.entity_id, "rate_plan");
          if (!channexRatePlanId) {
            await markFailed(supabase, item.id, "Rate plan not mapped to Channex");
            continue;
          }

          // Look up the rate plan's property_id to scope property resolution
          const { data: restrRatePlan } = await supabase
            .from("rate_plans")
            .select("property_id")
            .eq("id", item.entity_id)
            .maybeSingle();

          const restrPropId = restrRatePlan?.property_id;
          const channexPropId = restrPropId ? await resolve(restrPropId, "property") : null;

          if (!channexPropId) {
            // Fallback to any property mapping
            const { data: propMapping } = await supabase
              .from("channex_mappings")
              .select("channex_id")
              .eq("entity_type", "property")
              .maybeSingle();
            if (!propMapping) {
              await markFailed(supabase, item.id, "No property mapped to Channex");
              continue;
            }
            // Use fallback
            const payload2 = item.payload || {};
            const dateFrom2 = item.date_from || payload2.date_from;
            const dateTo2 = item.date_to || payload2.date_to;
            if (!dateFrom2 || !dateTo2) {
              await markFailed(supabase, item.id, "Missing date_from or date_to");
              continue;
            }
            const value2: Record<string, any> = {
              property_id: propMapping.channex_id,
              rate_plan_id: channexRatePlanId,
              date_from: dateFrom2,
              date_to: dateTo2,
            };
            if (payload2.min_stay != null) value2.min_stay_arrival = payload2.min_stay;
            if (payload2.max_stay != null) value2.max_stay = payload2.max_stay;
            if (payload2.stop_sell != null) value2.stop_sell = payload2.stop_sell;
            if (payload2.closed_to_arrival != null) value2.closed_to_arrival = payload2.closed_to_arrival;
            if (payload2.closed_to_departure != null) value2.closed_to_departure = payload2.closed_to_departure;
            values.push(value2);
            await markCompleted(supabase, item.id);
            continue;
          }

          const payload = item.payload || {};
          const dateFrom = item.date_from || payload.date_from;
          const dateTo = item.date_to || payload.date_to;

          if (!dateFrom || !dateTo) {
            await markFailed(supabase, item.id, "Missing date_from or date_to");
            continue;
          }

          const value: Record<string, any> = {
            property_id: channexPropId,
            rate_plan_id: channexRatePlanId,
            date_from: dateFrom,
            date_to: dateTo,
          };

          if (payload.min_stay != null) value.min_stay_arrival = payload.min_stay;
          if (payload.max_stay != null) value.max_stay = payload.max_stay;
          if (payload.stop_sell != null) value.stop_sell = payload.stop_sell;
          if (payload.closed_to_arrival != null) value.closed_to_arrival = payload.closed_to_arrival;
          if (payload.closed_to_departure != null) value.closed_to_departure = payload.closed_to_departure;

          values.push(value);
          await markCompleted(supabase, item.id);
        } catch (err: any) {
          await markFailed(supabase, item.id, err.message);
        }
      }

      if (values.length > 0) {
        try {
          const channexPayload = { values };
          console.log(`[process-sync-queue] Pushing ${values.length} restriction values`);
          const response = await channexRequest<object>("POST", "/api/v1/restrictions", channexPayload);
          // Resolve local property ID from first restriction item for logging
          const firstRestrItem = restrictionItems[0];
          let restrPropertyId: string | null = null;
          if (firstRestrItem?.entity_id) {
            const { data: rpData2 } = await supabase.from("rate_plans").select("property_id").eq("id", firstRestrItem.entity_id).maybeSingle();
            restrPropertyId = rpData2?.property_id || null;
          }
          await logSync("channex-process-sync-queue", "/api/v1/restrictions", channexPayload, response, 200, true, null, restrPropertyId);
        } catch (err: any) {
          console.error("[process-sync-queue] Restriction push failed:", err.message);
          await logSync("channex-process-sync-queue", "/api/v1/restrictions", null, null, null, false, err.message, null);
          await createAlert('sync_error', `Restriction push failed: ${err.message}`);
        }
      }
    }
    }

    return new Response(
      JSON.stringify({ success: true, processed: pending.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("[process-sync-queue] Fatal error:", err);
    try {
      await logSync("channex-process-sync-queue", "process-queue", null, null, null, false, err.message, null);
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});

// ── Helpers ──────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

async function calculateAvailabilityRanges(
  supabase: any,
  roomTypeName: string,
  dateFrom: string,
  dateTo: string,
  propertyId?: string
): Promise<{ date_from: string; date_to: string; availability: number }[]> {
  // Get all units of this room type for the property
  let unitIdQuery = supabase
    .from("units")
    .select("id")
    .eq("booking_com_name", roomTypeName)
    .neq("status", "maintenance");
  if (propertyId) unitIdQuery = unitIdQuery.eq("property_id", propertyId);
  const { data: unitRows } = await unitIdQuery;
  const unitIds = (unitRows || []).map((u: any) => u.id);
  const totalUnits = unitIds.length;

  if (totalUnits === 0) {
    console.log(`[process-sync-queue] No units found for ${roomTypeName} @ property ${propertyId || 'all'}`);
    return [{ date_from: dateFrom, date_to: dateTo, availability: 0 }];
  }

  // Fetch all overlapping reservations (check_in <= last_day AND check_out > first_day)
  const { data: reservations } = await supabase
    .from("reservations")
    .select("unit_id, check_in_date, check_out_date")
    .in("status", ["confirmed", "checked-in"])
    .not("unit_id", "is", null)
    .in("unit_id", unitIds)
    .lt("check_in_date", dateTo)
    .gt("check_out_date", dateFrom);

  // Fetch all blocked dates in range
  const { data: blockedDates } = await supabase
    .from("blocked_dates")
    .select("unit_id, blocked_date")
    .in("unit_id", unitIds)
    .gte("blocked_date", dateFrom)
    .lt("blocked_date", dateTo);

  // Day-by-day calculation
  const startDate = new Date(dateFrom);
  const endDate = new Date(dateTo);
  const dailyAvail: { date: string; avail: number }[] = [];

  for (let d = new Date(startDate); d < endDate; d = addDays(d, 1)) {
    const ds = formatDate(d);
    const occupiedUnits = new Set<string>();

    // A reservation occupies a day if check_in_date <= day AND check_out_date > day
    // This correctly excludes the checkout date
    if (reservations) {
      for (const r of reservations) {
        if (r.check_in_date <= ds && r.check_out_date > ds && r.unit_id) {
          occupiedUnits.add(r.unit_id);
        }
      }
    }

    const blockedUnits = new Set<string>();
    if (blockedDates) {
      for (const b of blockedDates) {
        if (b.blocked_date === ds && b.unit_id && !occupiedUnits.has(b.unit_id)) {
          blockedUnits.add(b.unit_id);
        }
      }
    }

    dailyAvail.push({ date: ds, avail: Math.max(0, totalUnits - occupiedUnits.size - blockedUnits.size) });
  }

  if (dailyAvail.length === 0) {
    return [{ date_from: dateFrom, date_to: dateTo, availability: totalUnits }];
  }

  // Collapse consecutive days with same availability into ranges
  const ranges: { date_from: string; date_to: string; availability: number }[] = [];
  let rangeStart = dailyAvail[0];
  let currentAvail = rangeStart.avail;
  let lastDate = rangeStart.date;

  for (let i = 1; i < dailyAvail.length; i++) {
    if (dailyAvail[i].avail === currentAvail) {
      lastDate = dailyAvail[i].date;
    } else {
      ranges.push({ date_from: rangeStart.date, date_to: formatDate(addDays(new Date(lastDate), 1)), availability: currentAvail });
      rangeStart = dailyAvail[i];
      currentAvail = rangeStart.avail;
      lastDate = rangeStart.date;
    }
  }
  ranges.push({ date_from: rangeStart.date, date_to: formatDate(addDays(new Date(lastDate), 1)), availability: currentAvail });

  console.log(`[process-sync-queue] Availability for ${roomTypeName} @ property ${propertyId || 'all'} (${dateFrom}-${dateTo}): ${ranges.length} ranges`);
  return ranges;
}

async function markCompleted(supabase: any, id: string) {
  await supabase
    .from("channex_sync_queue")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("id", id);
}

async function markFailed(supabase: any, id: string, error: string) {
  await supabase
    .from("channex_sync_queue")
    .update({ status: "failed", error_message: error, processed_at: new Date().toISOString() })
    .eq("id", id);
}

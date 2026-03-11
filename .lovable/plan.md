

## Fix: Only Send Changed Fields to Channex

### Problem
Both the frontend (BulkRestrictionEditor) and the edge function (channex-push-restrictions) add default values for fields the user didn't change, causing full-snapshot pushes to Channex instead of delta-only updates.

### Changes

**File 1: `src/components/pms/BulkRestrictionEditor.tsx` (lines 228-240)**

Replace the row-building logic in `handleSaveAllChanges` to only include fields the user explicitly enabled:

```typescript
const rows = pendingRestrictions.map((p) => {
  const row: any = {
    rate_plan_id: p.ratePlanId,
    date_from: p.dateFrom,
    date_to: format(addDays(new Date(p.dateTo), 1), 'yyyy-MM-dd'),
    synced_to_channex: false,
  };
  if (p.restrictions.rate !== undefined) row.rate = Math.round(p.restrictions.rate * 100);
  if (p.restrictions.minStayArrival !== undefined) row.min_stay_arrival = p.restrictions.minStayArrival;
  if (p.restrictions.minStayThrough !== undefined) row.min_stay_through = p.restrictions.minStayThrough;
  if (p.restrictions.maxStay !== undefined) row.max_stay = p.restrictions.maxStay;
  if (p.restrictions.stopSell !== undefined) row.stop_sell = p.restrictions.stopSell;
  if (p.restrictions.closedToArrival !== undefined) row.closed_to_arrival = p.restrictions.closedToArrival;
  if (p.restrictions.closedToDeparture !== undefined) row.closed_to_departure = p.restrictions.closedToDeparture;
  return row;
});
```

The `PendingRestriction.restrictions` object already only contains enabled fields (lines 195-202 use conditionals). The problem is the `?? defaultValue` fallbacks on lines 233-238 that re-add defaults. Removing those is the fix.

**File 2: `supabase/functions/channex-push-restrictions/index.ts` (lines 88-100)**

Replace the value-building block to only pass through fields that are non-null in the DB row:

```typescript
const value: any = {
  property_id: propMapping.channex_id,
  rate_plan_id: channexRpId,
  date_from: r.date_from,
  date_to: inclusiveDateTo,
};
if (r.rate != null) value.rate = r.rate;
if (r.min_stay_arrival != null) value.min_stay_arrival = r.min_stay_arrival;
if (r.min_stay_through != null) value.min_stay_through = r.min_stay_through;
if (r.max_stay != null) value.max_stay = r.max_stay;
if (r.stop_sell != null) value.stop_sell = r.stop_sell;
if (r.closed_to_arrival != null) value.closed_to_arrival = r.closed_to_arrival;
if (r.closed_to_departure != null) value.closed_to_departure = r.closed_to_departure;
values.push(value);
```

Two edits, two files. No data/logic changes — just stops injecting defaults for unchanged fields.


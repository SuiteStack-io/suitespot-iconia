

## Fix Price per Night Flickering & Rate-Plan-Based Recalculation

### Problem
Two `useEffect` hooks at lines 412-416 and 419-432 create a circular loop: changing `price_per_night` triggers `calculateTotals()` which sets `total_price`, which triggers the second effect that sets `price_per_night`, ad infinitum.

### Solution — Single file change: `src/pages/ReservationDetail.tsx`

**1. Remove both circular useEffects (lines 412-432)**

Delete:
- The effect that calls `calculateTotals()` on `price_per_night` change (lines 412-416)
- The effect that derives `price_per_night` from `total_price` (lines 419-432)

**2. Add a single date-change effect that fetches rates from the rate plan**

When `check_in_date` or `check_out_date` changes in edit mode:
- Get the unit's `unit_type` from the `units` array using `formData.unit_id`
- Call `getActiveRate()` (from `src/lib/rateResolver.ts`) for the room type to get `weekdayRate` and `weekendRate`
- Loop through each night in the range, classify as weekday or weekend using the property's `weekend_days` (default `[4, 5]`), sum up the total
- Set `total_price`, `price_per_night` (total / nights, rounded to 2dp), `commission_amount`, and `net_revenue` in ONE `setFormData` call — no cascading
- Track a breakdown string like `"5 weekday × $100 + 2 weekend × $120 = $740"` in new state `priceBreakdown`

**3. Make Price per Night and Total Price display-only in edit mode (lines 1371-1392)**

Replace both `<Input>` elements with read-only styled divs:
```tsx
<div className="mt-2 h-10 flex items-center px-3 bg-muted/50 rounded-md text-sm font-medium">
  ${(formData.total_price / calculateNights()).toFixed(2)}
</div>
```
Same pattern for Total Price.

**4. Show price breakdown below Total Price**

Display the `priceBreakdown` string as a small muted text line:
```tsx
{priceBreakdown && (
  <p className="text-xs text-muted-foreground mt-1">{priceBreakdown}</p>
)}
```

**5. Update `handleSave` (lines 526-529)**

Use `formData.total_price` directly instead of recalculating `total = price_per_night * nights`. Derive `price_per_night` for DB storage as `formData.total_price / nights` rounded to 2dp.

**6. Import `getActiveRate` from `@/lib/rateResolver`**

### No changes to edge functions or rate plan logic.


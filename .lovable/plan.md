

## Fix: Correct Pricing & Commission for Channex/OTA Reservations

### Problem
1. `price_per_night` is never set in the webhook → shows USD 0.00
2. `commission_amount`, `commission_rate`, `net_revenue` are never set → show N/A or incorrect defaults
3. The UI defaults null values to 0 or 10%, showing misleading data

### Changes

#### 1. Edge Function: `supabase/functions/channex-booking-webhook/index.ts`

**Extract ota_commission** (after line ~139, where `amount` and `currency` are extracted):
```ts
const otaCommission = parseFloat(enrichedData.ota_commission || enrichedData.commission || bookingData.ota_commission || '0') || null;
```

**Calculate pricing fields** — add before the `reservationRecord` object (line ~378):
```ts
const totalAmount = parseFloat(amount) || null;
const nightCount = (() => {
  if (!arrival_date || !departure_date) return 0;
  const d1 = new Date(arrival_date);
  const d2 = new Date(departure_date);
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
})();
const calcPricePerNight = totalAmount && nightCount > 0 ? Number((totalAmount / nightCount).toFixed(2)) : null;
const calcCommissionAmount = otaCommission && otaCommission > 0 ? otaCommission : null;
const calcCommissionRate = calcCommissionAmount && totalAmount && totalAmount > 0 
  ? Number(((calcCommissionAmount / totalAmount) * 100).toFixed(2)) : null;
const calcNetRevenue = totalAmount && calcCommissionAmount 
  ? Number((totalAmount - calcCommissionAmount).toFixed(2)) : null;
```

**Add to INSERT record** (line ~378 `reservationRecord`):
```ts
price_per_night: calcPricePerNight,
commission_amount: calcCommissionAmount,
commission_rate: calcCommissionRate,
net_revenue: calcNetRevenue,
```

**Add to UPDATE** (line ~304 update call): same 4 fields

#### 2. UI: `src/pages/ReservationDetail.tsx`

**Read-only display** (lines 1655-1750):
- Line 1657: Change `const pricePerNight = reservation?.price_per_night || 0;` to use the actual value, and when it's null/0 for OTA, calculate from `total_price / nights`
- Lines 1731-1735 (Commission Rate): Change to show "N/A" when `commission_rate` is null, without appending `%` sign
- Lines 1739-1742 (Commission Amount): Already shows "N/A" but prefixes with `$` — remove the `$` prefix when value is N/A
- Lines 1744-1750 (Net Revenue): Already shows "N/A" but prefixes with `$` — remove the `$` prefix when value is N/A

**Form data loading** (lines 286-290):
- Change `commission_rate: data.commission_rate || 10` to `commission_rate: data.commission_rate ?? (data.channel === 'Channex' ? null : 10)` — preserve null for OTA
- Change `commission_amount: data.commission_amount || 0` to `data.commission_amount ?? null`
- Change `net_revenue: data.net_revenue || 0` to `data.net_revenue ?? null`

**Price per night calculation fix** (line 1657):
```ts
const pricePerNight = reservation?.price_per_night || 
  (reservation?.total_price && reservation?.nights ? Number((reservation.total_price / reservation.nights).toFixed(2)) : 0);
```

### Summary
- 2 files edited
- No database migrations needed (columns already exist)
- OTA reservations get correct pricing from webhook data
- Manual reservation commission logic unchanged
- UI shows "N/A" cleanly when commission data is unavailable


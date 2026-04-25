# Fix: Late checkout fee should have zero commission

## Why

Late checkouts are an internal property fee, not OTA-mediated revenue. There is no third party owed commission, so the entire fee should be net revenue. Currently the row is created with the property default commission rate (10%) and the dialog explicitly promises "Commission (10%) will be credited to you", which is wrong.

## Changes

### 1. `src/components/LateCheckoutDialog.tsx`
- Delete only the `<p>` line: `"This creates a linked reservation. Commission (10%) will be credited to you."` (around line 222–224).
- Keep the wrapping div, the User icon, and the "Late checkout attributed to: [name]" line.
- Remove `const commissionRate = activeProperty?.default_commission_rate ?? 10;` (line 68).
- Remove `commissionRate` from the `useLateCheckout({ ... })` call (line 76).
- Leave `vatRate` and `activeProperty` alone — they are still used for the VAT breakdown.

### 2. `src/hooks/useLateCheckout.ts`
- Remove `commissionRate?: number` from `UseLateCheckoutParams`.
- Remove `commissionRate = 10` from the hook's destructured params.
- In the fee-reservation block (around lines 112–144):
  - Remove the `baseAmount` and `commissionAmount` / `netRevenue` calculations (no longer needed — VAT split lives in the dialog).
  - Set `commission_rate: 0`, `commission_amount: 0`, `net_revenue: feeAmt` on the inserted row.
- Verify no other reference to `commissionRate` remains in the file.

### 3. Database backfill migration
Single UPDATE to fix existing late-checkout fee rows:

```sql
UPDATE public.reservations
SET commission_rate  = 0,
    commission_amount = 0,
    net_revenue      = total_price
WHERE (notes ILIKE 'Late checkout fee for booking%' OR booking_reference ILIKE '%-LC')
  AND (commission_rate <> 0 OR commission_amount <> 0 OR net_revenue <> total_price);
```

Identifiers come straight from the existing insert in `useLateCheckout.ts` (`booking_reference: \`${bookingRef}-LC\`` and `notes: \`Late checkout fee for booking ${bookingRef}\``).

## Audit findings (analytics — no changes proposed, reporting only)

Searched: `Analytics.tsx`, `Dashboard.tsx`, `Commissions.tsx`, `RevenueBySource.tsx`, `RevenueByRoom.tsx`, `RevenueByGuests.tsx`, `RevenueByNationality.tsx`, `CashSettlement.tsx`.

All commission/net-revenue math is derived from each row's stored `commission_amount` (e.g. `total_price - commission_amount` for net, `sum(commission_amount)` for totals). No file hardcodes a commission rate when aggregating. Once late-checkout rows are stored with `commission_amount = 0`:

- **Analytics.tsx, Dashboard.tsx, RevenueBySource/Room.tsx** — late-checkout fees count as 100% net revenue, contribute $0 to commission totals. Correct.
- **Commissions.tsx** — already filters with `.not('commission_amount', 'is', null).gt('commission_amount', 0)` (lines 90–91), so zero-commission late-checkout rows are excluded from the commission tracker. Correct.
- No double-counting risk found.

No analytics code changes proposed.

## Not changing

- Same-day fee row shape (`check_in_date = check_out_date = checkoutDate`).
- `valid_dates` constraint (already relaxed in prior migration).
- `blocked_dates` insert.
- Channex availability sync.
- "Late checkout attributed to: [name]" line.
- Commission logic for any other reservation type.

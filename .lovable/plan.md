

## Replace Hardcoded VAT (14%) and Commission (10%) with Per-Property Settings

### Source of truth
The `properties` table already has `vat_rate` (default 14) and `default_commission_rate` (default 10). The `Property` interface in `src/lib/propertyContext.tsx` will be extended to expose them.

### Helper convention (inlined per file)
```ts
const vatRate = activeProperty?.vat_rate ?? 0;
const commissionRate = activeProperty?.default_commission_rate ?? 10;
const vatDivisor = 1 + vatRate / 100;
```
When `vat_rate = 0`, `vatDivisor = 1` so calculations gracefully no-op for VAT-disabled properties.

### Files & changes

**1. `src/lib/propertyContext.tsx`**
Add to `Property` interface:
```ts
vat_rate: number | null;
default_commission_rate: number | null;
```

**2. `src/pages/MyReservations.tsx`**
- Import `useProperty`; move `calculateVAT` / `calculateCommission` inside the component to capture rates.
- `totalPrice / 1.14` → `totalPrice / vatDivisor`.
- `netRevenue * 0.10` → `netRevenue * (commissionRate / 100)`.
- `'VAT (14%)'` (line 435) → `` `VAT (${vatRate}%)` ``.

**3. `src/pages/Commissions.tsx`**
- Import `useProperty`. Replace all `/ 1.14` with `/ vatDivisor`, all `* 0.10` with `* (commissionRate / 100)`, all `'VAT (14%)'` literals (lines 269, 289, 312, 335, 639, 787) with dynamic template.

**4. `src/hooks/useLateCheckout.ts`**
- Add optional `vatRate?: number` (default 0) and `commissionRate?: number` (default 10) to `UseLateCheckoutParams`.
- Replace `feeAmt / 1.14` with `feeAmt / (1 + vatRate / 100)` and `const commissionRate = 10` with the parameter.
- Update all callers to pass values from `useProperty()`.

**5. `src/components/ReservationQuickActions.tsx`**
- Import `useProperty`. Replace `* 0.14` (line 541) with `* (vatRate / 100)`, `/ 1.14` (lines 658, 732) with `/ (1 + vatRate / 100)`, and hardcoded `commissionRate = 10` (lines 543, 659, 733) with the property value.
- Pass `vatRate` and `commissionRate` to `useLateCheckout`.

**6. `src/components/ReservationsList.tsx`**
- Import `useProperty`. Replace `/ 1.14` (lines 671–677, 1508, 1516) with `/ vatDivisor`. Replace `'VAT (14%)'` (lines 693, 1303) with dynamic template.

**7. `src/components/analytics/RevenueByNationality.tsx`** (added per request)
- Import `useProperty`. Replace any hardcoded `/ 1.14` with `/ vatDivisor` and `'VAT (14%)'` labels with dynamic template.

**8. `src/components/LateCheckoutDialog.tsx`** (added per request)
- Import `useProperty`. Replace `feeAmount / 1.14` (and the `feeBase`/`feeVAT` derivation) with the dynamic divisor.
- Replace the `'VAT (14%)'` label in the fee breakdown with `` `VAT (${vatRate}%)` ``.
- Pass `vatRate` and `commissionRate` to `useLateCheckout` (since this dialog also instantiates the hook).

### Out of scope
- OTA-derived commission (Channex backend).
- Stored `commission_amount` on already-paid rows (continue using stored value).
- Database schema, Edge Functions, email templates.

### Verification
1. ICONIA Zamalek (vat 14, commission 10) → numbers and labels unchanged.
2. Property with `vat_rate = 0` → "VAT (0%)" header, VAT column shows `$0.00`, net = total.
3. Property with `vat_rate = 8`, `commission = 12` → headers read "VAT (8%)", commissions recompute at 12%.
4. Late-checkout dialog and stay extension reflect active property's rates in real time.


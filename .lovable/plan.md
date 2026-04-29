## Update promotion tie-breaker to "most recently created wins"

Edit `supabase/functions/calculate-dynamic-price/index.ts` (lines 443-465 only).

### Change 1: Add `created_at` to the select
```ts
.select("id, discount_type, discount_value, room_types, created_at")
```

### Change 2: Replace the sort comparator
Current secondary sort uses `discount_value` (arbitrary across percent/fixed). Replace with `created_at DESC`:
```ts
.sort((a, b) =>
  b.savings - a.savings ||
  new Date(b.promo.created_at).getTime() - new Date(a.promo.created_at).getTime()
);
```

### Untouched
- Savings calculation (percentage vs fixed) — unchanged.
- Manual override precedence — unchanged.
- Winner application logic (lines 467+) — unchanged.
- No DB schema, frontend, or other edge function changes.
- Note: `promotional_periods.created_at` already exists (added by default `timestamptz default now()` in the table migration), and `min_stay` is intentionally not added since it isn't used in this function today (out of scope).

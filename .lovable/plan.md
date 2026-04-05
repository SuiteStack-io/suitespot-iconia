

## Fix: withPropertyFilter Before .select() — 5 Broken Instances

### The Bug
`withPropertyFilter(supabase.from('table'), propertyId).select(...)` calls `.eq()` on a `PostgrestQueryBuilder` (which doesn't have `.eq()`). The `.select()` must come BEFORE `withPropertyFilter` so `.eq()` is called on a `PostgrestFilterBuilder`.

### Files to Fix (5 total)

**1. `src/pages/CashSettlement.tsx` — Line 74-76**
```typescript
// Before:
withPropertyFilter(supabase.from('reservations'), propertyId)
  .select('*, units!unit_id(...)')
// After:
withPropertyFilter(supabase.from('reservations')
  .select('*, units!unit_id(...)'), propertyId)
```

**2. `src/pages/Commissions.tsx` — Line 78-80**
```typescript
// Before:
withPropertyFilter(supabase.from('reservations'), propertyId)
  .select('id, booking_reference, ...')
// After:
withPropertyFilter(supabase.from('reservations')
  .select('id, booking_reference, ...'), propertyId)
```

**3. `src/pages/GuestAccounts.tsx` — Line 114-116**
```typescript
// Before:
withPropertyFilter(supabase.from("reservations"), propertyId)
  .select("id, booking_reference, ...")
// After:
withPropertyFilter(supabase.from("reservations")
  .select("id, booking_reference, ..."), propertyId)
```

**4. `src/pages/Guests.tsx` — Line 151-156**
```typescript
// Before:
withPropertyFilter(supabase.from("reservations"), propertyId)
  .select(`*, units!unit_id (name)`)
// After:
withPropertyFilter(supabase.from("reservations")
  .select(`*, units!unit_id (name)`), propertyId)
```

**5. `src/components/analytics/CancellationAnalytics.tsx` — Line 95-100**
```typescript
// Before:
withPropertyFilter(supabase.from('reservations'), propertyId)
  .select('*, units!unit_id(name, unit_number)')
// After:
withPropertyFilter(supabase.from('reservations')
  .select('*, units!unit_id(name, unit_number)'), propertyId)
```

### What Does NOT Change
- All other `withPropertyFilter` usages (52 instances) already have `.select()` inside and are correct
- No layout, design, or logic changes
- No database changes


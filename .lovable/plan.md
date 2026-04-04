

## Fix: Add Summary Sync Log to channex-sync-property

### Problem
The "Sync to Channex" button works correctly but produces no sync log entry when all entities are already synced, making it appear broken.

### Changes

**File: `supabase/functions/channex-sync-property/index.ts`** — Lines 405-406

Replace:
```typescript
// SUMMARY
console.log(`[Sync] Done. RT: ${roomTypeResults.length}, RP: ${ratePlanResults.length}, Errors: ${errors.length}`);
```

With:
```typescript
// SUMMARY — always log so every button click produces a visible sync log entry
console.log(`[Sync] Done. RT: ${roomTypeResults.length}, RP: ${ratePlanResults.length}, Errors: ${errors.length}`);

await logSync(
  'channex-sync-property',
  'sync-summary',
  { propertyId: propConfig.id, propertyName: propConfig.property_name },
  {
    property_status: propertyStatus,
    room_types_count: roomTypeResults.length,
    rate_plans_count: ratePlanResults.length,
    errors_count: errors.length,
    room_types: roomTypeResults.map(r => ({ name: r.name, status: r.status })),
    rate_plans: ratePlanResults.map(r => ({ name: r.name, status: r.status })),
  },
  200,
  errors.length === 0,
  errors.length > 0 ? JSON.stringify(errors) : null,
  propConfig.id
);
```

**File: `src/components/channex/PropertySync.tsx`** — Line 103 (inside `syncProperty`)

Add before the invoke call:
```typescript
console.log('[sync] Sync to Channex clicked for property:', propertyId);
```

### Summary
- 1 edge function: add `logSync()` call after summary so every sync produces a visible log entry
- 1 frontend file: add diagnostic console.log
- No other changes


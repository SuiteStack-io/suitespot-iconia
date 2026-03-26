

## Fix: Booking Page "Loading Available Suites" Never Resolves

### Root Cause
The `useEffect` that fetches available units (line 274) has a guard `if (!defaultPropertyId) return;` — but `defaultPropertyId` is **missing from the dependency array** (line 440). The default property is fetched asynchronously in a separate `useEffect`, so when it resolves and sets `defaultPropertyId`, the units fetch never re-triggers.

### Fix
**File: `src/pages/BookingFlow.tsx`** — single-line change at line 440:

Add `defaultPropertyId` to the dependency array:

```ts
}, [toast, dateRange, preSelectedUnitId, preSelectedUnitType, defaultPropertyId]);
```

This ensures the fetch re-runs once the default property ID is available.

### What stays the same
- Booking flow steps, design, and submission logic
- Property switcher and admin pages
- How bookings are saved




## Fix: Prices Page Shows All Rate Plans on Refresh

### Problem
The `useEffect` on line 144-146 has an empty dependency array `[]`, so `fetchData()` only runs once on mount — before `propertyId` may be resolved from the property context. It also never re-runs when the user switches properties.

### Fix in `src/pages/pms/Prices.tsx`

**Change line 144-146:**
```typescript
useEffect(() => {
  fetchData();
}, []);
```
To:
```typescript
useEffect(() => {
  if (propertyId) {
    fetchData();
  }
}, [propertyId]);
```

This ensures:
1. Data is not fetched until the active property is resolved (preventing "show all" on refresh)
2. Data re-fetches when the user switches properties

Single line change in one file.




## Fix: "Failed to load guest forms data" Error

### Analysis

Without console logs available, I traced the error to the `fetchData` function in `src/pages/GuestForms.tsx` (line 167). The most likely causes:

1. **Race condition**: `fetchData` fires before auth is fully loaded — `user` object exists but session token may not be ready yet, causing RLS to reject queries
2. **Missing `authLoading` guard**: The data-fetching `useEffect` (line 126) checks `user` but not `authLoading`, so it can fire prematurely during auth initialization

### Fix — `src/pages/GuestForms.tsx`

**1. Add `authLoading` guard to the fetch effect** (line 126-130):
```typescript
useEffect(() => {
  if (user && !authLoading) {
    fetchData();
  }
}, [user, authLoading, propertyId]);
```

**2. Add specific error logging** in the catch block (line 165-168) to surface the actual error message in the toast so it's easier to debug if it recurs:
```typescript
} catch (error: any) {
  console.error('Error fetching data:', error);
  toast.error('Failed to load guest forms data: ' + (error?.message || 'Unknown error'));
}
```

This ensures the query only runs after the auth session is fully established, preventing RLS rejection errors.




## Add "Sync to Channex" button in BulkAvailabilityEditor

### Change: `src/components/pms/BulkAvailabilityEditor.tsx`

1. Add `RefreshCw` to lucide imports, add `cn` import
2. Add `isSyncing` state
3. Add `handleFullSync` async function:
   - Calls `supabase.functions.invoke('channex-full-sync', { body: { propertyId } })`
   - Success toast: "Availability synced to Channex" with room type count from response
   - Error toast with error message
4. Place the button at the top of the component (above the editor card), right-aligned:

```tsx
<div className="flex justify-end">
  <Button variant="outline" onClick={handleFullSync} disabled={isSyncing}>
    <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
    {isSyncing ? "Syncing..." : "Sync to Channex"}
  </Button>
</div>
```

No edge function or other file changes.


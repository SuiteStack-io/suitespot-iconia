

## Add progress bar to "Sync to Channex" button in BulkAvailabilityEditor

### What changes

**File: `src/components/pms/BulkAvailabilityEditor.tsx`**

1. **New state**: `syncProgress` (number 0-100), `syncStep` (string), `syncStatus` ('idle' | 'syncing' | 'success' | 'error'), `syncError` (string)

2. **Update `handleFullSync`** to simulate stepped progress since the edge function is a single call:
   - Set status to `'syncing'`, step to `"Pushing availability..."`, animate progress 0→45% over ~2s using `setInterval`
   - After the function returns, jump to `"Pushing rates & restrictions..."` 50→85%, then `"Finalizing..."` 90→100%
   - On success: set status `'success'`, progress 100%, green bar, fade out after 2s, show toast with room type count
   - On error: set status `'error'`, bar turns red, show error text, stays visible

3. **Progress bar UI** — placed directly below the Sync button row:
   ```tsx
   {syncStatus !== 'idle' && (
     <div className="space-y-1">
       <div className="flex justify-between text-xs text-muted-foreground">
         <span>{syncStep}</span>
         <span>{syncProgress}%</span>
       </div>
       <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
         <div
           className={cn(
             "h-full rounded-full transition-all duration-500",
             syncStatus === 'error' ? 'bg-red-500' :
             syncStatus === 'success' ? 'bg-green-500' : 'bg-blue-600'
           )}
           style={{ width: `${syncProgress}%` }}
         />
       </div>
       {syncStatus === 'error' && (
         <p className="text-xs text-red-500">{syncError}</p>
       )}
     </div>
   )}
   ```

4. **Button disabled** when `syncStatus === 'syncing'` (already covered by existing `isSyncing` — will unify with `syncStatus`)

5. **Cleanup**: remove separate `isSyncing` state, derive disabled from `syncStatus === 'syncing'`

### Import addition
- `Progress` component is NOT used — using a custom thin div-based bar for the 1.5px height and color control

### No edge function or sync logic changes.


## Goal

In the `PromotionDialog` edit branch (where `editing != null`), collapse the `pending → syncing → synced/failed` sequence into `syncing → synced/failed` with a single combined initial UPDATE.

## Change site

`src/pages/Promotions.tsx`, the `editing` branch of the dialog save handler (currently lines 782–786, the `.update(payload).eq('id', editing.id)` call) and the code that follows it.

## Implementation

Replace the edit branch with:

1. **Single combined UPDATE** — merge the edited fields with the sync-state reset:
   ```ts
   const { error: updateErr } = await supabase
     .from('promotional_periods' as any)
     .update({
       ...payload,
       last_sync_status: 'syncing',
       last_synced_at: null,
       last_sync_error: null,
     })
     .eq('id', editing.id);
   if (updateErr) {
     setSaving(false);
     toast.error('Failed to save: ' + updateErr.message);
     return;
   }
   ```

2. **Invoke `channex-full-sync`** with `{ propertyId }` (matches `saveAllPending` lines 235–237 exactly).

3. **Final UPDATE** to `'synced'` or `'failed'` on the same row (`.eq('id', editing.id)`):
   - On success: `last_sync_status: 'synced'`, `last_synced_at: new Date().toISOString()`, `last_sync_error: null`. Toast `'Promotion updated and synced'`.
   - On failure: `last_sync_status: 'failed'`, `last_sync_error: syncErr.message`. Toast warning `'Promotion updated. Channex sync failed — please retry sync.'`.

4. `setSaving(false)` then `onSaved()` (which closes the dialog and refreshes the list) regardless of sync outcome — the row is saved either way; the badge communicates sync state.

The `else` branch (insert-from-dialog fallback) stays as previously planned: insert with default `last_sync_status` and no inline sync.

## Variable hygiene

- The existing `let error;` declaration at line 781 is removed; the new code uses scoped names `updateErr` and `syncErr` to avoid any chance of shadowing or duplicate declaration.
- No other variables in this function are renamed.

## Out of scope (per spec)

- `saveAllPending` — unchanged (keeps `pending → syncing → synced` because of the toast/progress UI gap).
- `retrySync` — unchanged.
- `PromotionRow` badge logic — unchanged (still handles `'pending'` for queued/legacy rows).
- Database schema, edge functions, other pages — unchanged.

## Verification

- Edit a promotion → row badge goes straight to "Syncing…" then "Synced X seconds ago" (or "Sync failed" with retry).
- The row never shows "Pending sync" during an edit.
- No duplicate variable declarations in the dialog save handler.

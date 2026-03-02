

## Add Progress Bar to Full Sync

**File:** `src/components/channex/ConnectionStatus.tsx`

- Import the `Progress` component from `@/components/ui/progress`
- Track sync progress as a percentage: `(completedCount / totalProperties) * 100`
- Add a `Progress` bar below the sync progress text, visible only during sync
- The bar fills as each property completes


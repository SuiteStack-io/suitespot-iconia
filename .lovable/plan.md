

## Add Progress Bar During Channex Sync

### Changes in `src/pages/pms/Prices.tsx`

**1. Add `syncProgress` state** (0-100)
- Set to 0 initially, then simulate progress: 10% after inserting to queue, 30% → 60% → 90% during edge function invocation, 100% on completion
- Reset to 0 after a short delay when done

**2. Show a blue `Progress` bar**
- Import the existing `Progress` component from `@/components/ui/progress`
- Render it below the header row (between the heading and the room type cards) when `syncing` is true or progress > 0
- Animate it smoothly with intermediate steps using `setTimeout`

**3. Update `syncRatesToChannex`**
- `setSyncProgress(10)` after filtering plans
- `setSyncProgress(40)` after inserting to queue
- `setSyncProgress(70)` after invoking the edge function
- `setSyncProgress(100)` on success
- After 1.5s delay, reset progress to 0

### Single file: `src/pages/pms/Prices.tsx`


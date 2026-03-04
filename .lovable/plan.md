

## Improve Bulk Editor with Room Type → Rate Plan Hierarchy

### What's changing
1. Add a **Room Type** dropdown to the Bulk Editor that filters the Rate Plan dropdown
2. Make the Bulk Editor fully self-contained (independent from the page-level dropdown)
3. Rename the page-level dropdown label to "View Calendar for Rate Plan" for clarity
4. After applying restrictions, auto-switch the calendar view to show the affected rate plan

### Files to edit

**`src/components/pms/BulkRestrictionEditor.tsx`**
- Add `selectedRoomType` state (default `'all'`)
- Derive unique room types from `ratePlans` prop: `const roomTypes = useMemo(() => [...new Set(ratePlans.map(p => p.room_type).filter(Boolean))], [ratePlans])`
- Filter rate plans based on selected room type
- Reset `selectedPlanId` to `'all'` when room type changes
- Replace the single "Rate Plan" dropdown with a 2-column grid: Room Type + Rate Plan (filtered)
- When `selectedRoomType === 'all'`, show room type suffix in rate plan options
- Add optional `onRatePlanFocused?: (id: string) => void` prop — call after successful apply if a specific plan is selected
- No other logic changes needed (validation, apply, clear, sync all stay the same)

**`src/pages/pms/Restrictions.tsx`**
- Rename the page-level dropdown label from "Select Rate Plan" to "View Calendar for Rate Plan"
- Pass `onRatePlanFocused` callback to `BulkRestrictionEditor` that sets `selectedPlanId` (page-level) and switches tab to calendar

### No database changes needed




## Fix: Replace inline "Add Room" row with a modal dialog

### Problem
Currently, clicking "Add Room" inserts an inline row at the top of the table. Since the table has 18+ columns, users must scroll horizontally to fill in all fields — poor UX.

### Solution
Replace the inline row with a dialog modal containing a clean form layout with all the same fields organized in a grid.

### Changes (single file: `src/pages/Rooms.tsx`)

1. **Remove the inline `isAdding` table row** (lines 922-1100) — the entire `{isAdding && (<TableRow>...)}` block

2. **Replace the "Add Room" button** to open a dialog instead of setting `isAdding(true)`
   - Change `onClick={() => setIsAdding(true)}` to `onClick={() => setAddDialogOpen(true)}`
   - Add new state: `const [addDialogOpen, setAddDialogOpen] = useState(false)`

3. **Add a new `<Dialog>` component** with a structured form containing all fields in a responsive grid layout:
   - Row 1: Room Name*, Room #, Type
   - Row 2: Booking.com Name, Room View, Size
   - Row 3: Beds, Baths, Max Guests, Sofa Bed
   - Row 4: Weekday Rate, Weekend Rate (auto-calculated), Tax %
   - Row 5: Status, Booking.com Room ID
   - Row 6: Comments (full width textarea)
   - Footer: Cancel + Add Room buttons

4. **Update `handleAddRoom`** to close dialog and also include `property_id: propertyId` instead of hardcoded `location: 'ICONIA'`

5. **Clean up** the `isAdding` state variable since it's no longer needed

### Technical details
- The modal reuses the existing `newUnit` state and `handleAddRoom` function
- Weekend rate auto-calculation via `calculateWeekendRate` is preserved
- The `property_id` will be set from the active property context instead of hardcoding location
- Form uses 2-3 column grid on desktop, single column on mobile




## Improve Clone Room Modal — Multi-Room Cloning

### Changes in `src/pages/Rooms.tsx`

**1. Replace state variables** (lines 109-111)
- Replace `cloneRoomNumber: string` with `cloneCount: number` (default 1) and `cloneRoomNumbers: string[]` (default `['']`)

**2. Update `handleCloneClick`** (lines 619-623)
- Auto-calculate next available room numbers based on existing units
- Set `cloneCount` to 1 and `cloneRoomNumbers` to `[nextAvailableNumber]`

**3. Add helper function `getNextAvailableNumbers`**
- Takes a starting number, count, and list of existing unit numbers
- Returns an array of sequential numbers that don't conflict with existing ones

**4. Update `handleConfirmClone`** (lines 625-711)
- Loop through `cloneRoomNumbers` array
- Validate: all filled, no duplicates within form, no conflicts with existing units
- Batch insert all cloned units in a single `.insert()` call
- Toast: "Created X room(s) successfully"

**5. Replace the clone dialog UI** (lines 1195-1242)
- Remove Price line from the summary
- Add "Number of Rooms to Clone" number input that controls `cloneCount`
- When `cloneCount` changes, dynamically grow/shrink `cloneRoomNumbers` array with auto-suggested sequential numbers
- Render labeled room number inputs in a scrollable container (`max-h-48 overflow-y-auto`)
- Add "Auto-Fill" ghost button (using `Wand2` icon) that recalculates all numbers sequentially
- Button text: `Clone {cloneCount} Room{cloneCount > 1 ? 's' : ''}`

### No new files or database changes needed


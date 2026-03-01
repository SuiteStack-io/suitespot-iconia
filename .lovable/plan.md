

## Add "Count" and "Default Occupancy" fields to Add Room modal

### Changes (single file: `src/pages/Rooms.tsx`)

1. **Add to initial state** (line 93-111): Add `count_of_rooms: 1` and `default_occupancy: 2` to the `newUnit` initial state

2. **Add to insert query** (lines 535-553): Include `count_of_rooms` and `default_occupancy` in the Supabase insert

3. **Add to reset states** (lines 570+ and 1448+): Include the two new fields in both reset blocks

4. **Add form fields in the dialog** (after Max Guests field, around line 1497): Add two new input fields:
   - **Count** (number input, default 1) — "How many rooms of this type"
   - **Default Occupancy** (number input, default 2) — placed in the same row as Sofa Bed

The fields will be inserted between the Max Guests and Sofa Bed rows in the 3-column grid layout. Both fields already exist in the `units` table (`count_of_rooms` default 1, `default_occupancy` default 2) and in the `Unit` type, so no database or type changes are needed.


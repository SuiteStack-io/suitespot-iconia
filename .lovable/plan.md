

## Add Arrival Time field to Booking.com screenshot confirmation dialog

### Problem
When creating reservations from Booking.com screenshots, there's no way to set the arrival time before confirming. Users must manually edit each reservation afterward.

### Plan

**1. Add `arrivalTime` state to `BookingComReservations.tsx`**
- Add a new `arrivalTime` state variable (string, default empty)
- Reset it when the dialog closes or a new screenshot is uploaded

**2. Add editable Arrival Time input field in the confirmation dialog**
- Location: right after the Notes section (line 2347), before the DialogFooter
- Input type: text with placeholder "HH:MM (e.g., 14:00)"
- Include a label "Arrival Time"
- Allow the user to type or edit the time before confirming

**3. Parse arrival time from AI-extracted notes automatically**
- When `parsedData` is set, check if the notes contain arrival time patterns (e.g., "arrive between 14:00 - 15:00", "ETA 15:30")
- Pre-fill the `arrivalTime` field with the extracted time so the user can review/edit it

**4. Include `arrival_time` in all reservation insert/update calls**
- Single room creation (line ~903-931): add `arrival_time: arrivalTime || null`
- Multi-room creation (line ~735-745): add `arrival_time: arrivalTime || null`
- Split-stay creation (line ~1060-1070): add `arrival_time: arrivalTime || null`
- Modification/update path (line ~1394): add `arrival_time: arrivalTime || null`

This touches only `src/pages/BookingComReservations.tsx`. No database changes needed since `arrival_time` column already exists on the `reservations` table.


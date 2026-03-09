

## Remove Weekday Rate, Weekend Rate, Tax %, and Booking.com Room ID from Table

### Changes in `src/pages/Rooms.tsx`

**1. Remove 4 column headers** (lines 929–931, 934):
- Line 929: `Weekday Rate` header
- Line 930: `Weekend Rate` header  
- Line 931: `Tax %` header
- Line 934: `Booking.com Room ID` header

**2. Remove 4 table cell blocks** in the row rendering:
- Lines 1156–1181: Weekday Rate cell (price_per_night input/display)
- Lines 1182–1203: Weekend Rate cell (weekend_rate input/display)
- Lines 1204–1223: Tax % cell (tax_percentage input/display)
- Lines 1300–1315: Booking.com Room ID cell (booking_com_id input/display)

**3. Optionally remove** the `calculateWeekendRate` helper function (lines 75–80) since it's no longer used in the table. However, it may still be used elsewhere — will check during implementation.

### No database changes needed
The columns remain in the database; we're only removing them from the table UI, consistent with having already removed them from the Add Room modal.

### Files
- `src/pages/Rooms.tsx`: Remove 4 `<th>` elements and 4 `<TableCell>` blocks


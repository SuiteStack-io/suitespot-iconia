

## Rename "Suite Name" to "Room Name" Across the Entire Project

### Problem
The codebase still has remnants of "Suite" terminology in labels, variable names, export headers, and email templates. The standard should be **"Room Name"** for the internal `name` field and **"Booking.com Name"** for the `booking_com_name` field, used consistently everywhere.

### Changes Summary

#### Frontend Components & Pages

| File | What Changes |
|------|-------------|
| `src/components/RevenueByRoom.tsx` | Rename `suiteName` property in `GroupedRoomRevenue` interface to `roomTypeName` (internal variable cleanup) |
| `src/pages/ReservationDetail.tsx` | Rename `suiteName` variable to `roomName`; change WhatsApp message from `*Suite:*` to `*Room:*`; change email body from `Suite:` to `Room:` |
| `src/pages/Commissions.tsx` | Change export column header from `'Suite'` to `'Room Name'` in all Excel export mappings |
| `src/pages/CashSettlement.tsx` | Change export column header from `'Suite'` to `'Room Name'` in all Excel export mappings |
| `src/components/AvailabilityCalendar.tsx` | Popover tooltip already says "Room Name" -- but display value uses `unit.name` instead of `booking_com_name || name`. Fix the value to use `unit.booking_com_name || unit.name` |
| `src/components/RoomCalendar.tsx` | Same fix: popover tooltip value should use `unit.booking_com_name || unit.name` |

#### Edge Functions

| File | What Changes |
|------|-------------|
| `supabase/functions/send-reservation-notification/index.ts` | Rename `matchedSuiteName` variable to `matchedRoomName`; change label from `"Suite:"` to `"Room:"` in HTML; fetch `booking_com_name` alongside `name` and prefer it |
| `supabase/functions/send-cancellation-notification/index.ts` | Change label from `"Suite:"` to `"Room:"` in HTML email |

### What Will NOT Change
- The `name` database column stays as-is (it is the "Room Name" field)
- The `booking_com_name` database column stays as-is (it is the "Booking.com Name" field)
- "SuiteSpot" brand references (company name, not a room label)
- The public-facing "Suites" navigation page (marketing page, not a field label)
- UI labels that already say "Room Name" correctly

### Technical Details

**ReservationDetail.tsx:**
- `const suiteName = ...` becomes `const roomName = ...`
- WhatsApp: `*Suite:* ${suiteName}` becomes `*Room:* ${roomName}`
- Email: `Suite: ${suiteName}` becomes `Room: ${roomName}`

**Commissions.tsx / CashSettlement.tsx:**
- All Excel export objects: `'Suite': r.units?.booking_com_name || ...` becomes `'Room Name': r.units?.booking_com_name || ...`

**send-reservation-notification/index.ts:**
- Query changed from `.select('name, unit_number')` to `.select('name, booking_com_name, unit_number')`
- `matchedSuiteName = unitData.name` becomes `matchedRoomName = unitData.booking_com_name || unitData.name`
- HTML label: `"Suite:"` becomes `"Room:"`

**send-cancellation-notification/index.ts:**
- HTML label: `"Suite:"` becomes `"Room:"`

**AvailabilityCalendar.tsx & RoomCalendar.tsx:**
- Popover value: `{unit.name}` becomes `{unit.booking_com_name || unit.name}` to show the Booking.com name consistently


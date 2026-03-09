

## Auto-Fetch Current Availability in Bulk Editor

### Approach

No new tables needed. The current availability = total units with that `booking_com_name` (excluding maintenance) minus reservations/blocked dates overlapping the selected date. For simplicity and accuracy, we'll count total units for the room type (the baseline) since that's what Channex availability represents — the number of rooms to sell.

### Changes — `src/components/pms/BulkAvailabilityEditor.tsx`

**1. New state variables:**
- `currentAvailability: number | null` — fetched baseline
- `isLoadingAvailability: boolean`

**2. Auto-fetch effect** triggered by `selectedRoomType` + `dateFrom` + `propertyId`:
- Query `units` table: count rows matching `property_id`, `booking_com_name`, and `status != 'maintenance'`
- Set `currentAvailability` to the count
- Auto-fill `availability` input with the fetched value
- Show loading skeleton while fetching

**3. UI enhancements to "Available Rooms" section:**
- Add "Current: X rooms" hint next to the label (or skeleton while loading)
- When user changes the value and it differs from `currentAvailability`, show a change indicator: `11 → 7 (-4)` with color coding (orange for decrease, green for increase)
- Import `ArrowRight` from lucide-react and `Skeleton` from UI components

**4. Reset `currentAvailability` to `null` when room type is cleared or on form reset.**

### Key detail
We use total unit count (not dynamic per-date availability) because that's what gets pushed to Channex as the base availability. The edge function and `calculateAvailability` in the sync queue handle per-date adjustments for reservations/blocked dates.


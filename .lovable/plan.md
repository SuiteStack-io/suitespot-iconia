

## Add "Show on Website" Toggle to Control Public Suite Visibility

### Problem
"Double Room with Terrace" appears on the public Suites page but should be hidden. "Suite with Terrace" should appear instead. Need a per-unit toggle to control public visibility without affecting PMS.

### Changes

#### 1. Database Migration
Add `show_on_website` boolean column to the `units` table:
```sql
ALTER TABLE public.units ADD COLUMN show_on_website boolean NOT NULL DEFAULT true;
```

#### 2. Set Initial Visibility
Use the insert tool to hide "Double Room with Terrace" units:
```sql
UPDATE public.units SET show_on_website = false WHERE booking_com_name = 'Double Room with Terrace';
```

#### 3. Update Public Suites Page (`src/pages/Suites.tsx`)
Add `.eq("show_on_website", true)` to the query filter (line 85 area) so hidden room types don't appear on the public website.

#### 4. Add Toggle to Room Types Admin (`src/pages/RoomTypes.tsx`)
- Add `show_on_website` to the `RoomTypeData`, `GroupedRoomType`, and `EditedGroupData` interfaces
- Add a "Website" column to the table with a Switch toggle per room type
- Include `show_on_website` in the fetch query and update mutation
- When grouping, take the first unit's `show_on_website` value

#### 5. What stays the same
- All PMS pages (calendar, reservations, rooms, Channex) are unaffected
- No room types are renamed, merged, or deleted
- Bookings and rate plans continue working normally


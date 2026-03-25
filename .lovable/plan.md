

## Reorder Suite Cards on /suites Page

### Problem
Suite cards display in alphabetical order by `name`. Need custom ordering: Suite with Terrace first, then Deluxe Suite, Family Suite, Junior Suite.

### Approach
Add a `room_type_display_order` integer column to the `units` table, set values per room type, and sort by it on the Suites page.

### 1. Database Migration
Add column:
```sql
ALTER TABLE public.units ADD COLUMN room_type_display_order integer NOT NULL DEFAULT 99;
```

### 2. Data Update (via insert tool)
Set display order values for existing units by `booking_com_name`:
```sql
UPDATE units SET room_type_display_order = 1 WHERE booking_com_name ILIKE '%terrace%';
UPDATE units SET room_type_display_order = 2 WHERE booking_com_name ILIKE '%deluxe%';
UPDATE units SET room_type_display_order = 3 WHERE booking_com_name ILIKE '%family%';
UPDATE units SET room_type_display_order = 4 WHERE booking_com_name ILIKE '%junior%';
```

### 3. Update `src/pages/Suites.tsx`
- Add `room_type_display_order` to the select fields (line 91)
- Change `.order("name")` to `.order("room_type_display_order")` (line 96)
- Add `room_type_display_order` to the Unit interface

### Files to Modify
- `src/pages/Suites.tsx` — select + order by new field
- Database migration for column
- Data update for existing values


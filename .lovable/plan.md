

## Add In-House Guests Section to Daily Summary Email

### What Changes

**File:** `supabase/functions/generate-daily-summary/index.ts`

### 1. New Data Query (in handler, after check-outs query)

Fetch in-house guests who checked in BEFORE today and check out AFTER today (status = "checked-in"):

```sql
reservations
  .select("guest_names, source, channel, check_out_date, guest_nationality, units!unit_id(name, booking_com_name, unit_number)")
  .lt("check_in_date", todayStr)       -- checked in before today
  .gt("check_out_date", todayStr)      -- checking out after today
  .eq("status", "checked-in")
  .eq("property_id", property.id)
```

Calculate `nights_remaining` as `check_out_date - today` for each row. Sort by nights remaining ascending, then guest name alphabetically.

### 2. Update `generateEmailHTML` Function

- Add `inHouseGuests` parameter (array with guest_names, room, source, nights_remaining, nationality)
- Insert a new table section between Check-ins and Check-outs:
  - Header: `🏨 In-House Guests (X)`
  - 5 columns: Guest Name, Room, Source, Nights Remaining, Nationality
  - Same table/th/td styling as existing tables
  - Empty state: "No in-house guests currently"

### 3. No Other Changes

- Check-ins, Check-outs, Occupancy, Blocked Rooms sections untouched
- Weekly/monthly summaries untouched
- Recipient logic, email styling, header design untouched
- No PDF changes (the user mentioned PDF but daily summaries currently have no PDF attachment per the memory note — PDF attachments are excluded from all summaries)


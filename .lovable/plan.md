

## Update Daily Summary Email

Four changes to `supabase/functions/generate-daily-summary/index.ts`:

### 1. Change blue color to dark navy
Replace all instances of `#0EA5E9` (sky blue) with the brand dark navy colors used in other notification emails:
- Header background: `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)` (matching reservation notification emails)
- Table headers: `#1e293b`
- Section headings: `#1e293b`
- Occupancy accent: `#1e293b`
- PDF colors: RGB `(15, 23, 42)` instead of `(14, 165, 233)`

### 2. Room column: show "Room Name (#Number)"
Currently the check-in/check-out queries only select `units!unit_id(name)`. Update the select to include `booking_com_name` and `unit_number`:
```
units!unit_id(name, booking_com_name, unit_number)
```
Then format the Room column as `${booking_com_name || name} (#${unit_number})` in both the HTML email and PDF.

### 3. Fix total rooms count — exclude blocked units
Currently counts ALL units for the property. Instead, query `blocked_dates` for today's date to find units that are fully blocked today. Subtract those from the total to get the "available pool" of 12 rooms instead of 13.

Query blocked units for today:
```sql
SELECT DISTINCT unit_id FROM blocked_dates WHERE blocked_date = todayStr AND property_id = property.id
```
Then: `totalRooms = allUnits.length - blockedUnitIds.length`

### 4. Add "Blocked Rooms" section
Add a new section in both HTML email and PDF showing which rooms are blocked today and their reason:
- Query: `blocked_dates` for today, joined with `units` to get room name/number
- Display as a small table: Room | Reason
- Section header: "🚫 Blocked Rooms (N)"

### Files changed
- `supabase/functions/generate-daily-summary/index.ts` — all four changes
- Redeploy the edge function after changes


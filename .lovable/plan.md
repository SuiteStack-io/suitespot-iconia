

## Show Full IDs in Channex Integration Pages

The IDs are truncated in three files. The fix is to show full IDs with horizontal scroll or text wrapping, and add a click-to-copy feature for convenience.

### Files to Update

1. **`src/components/channex/PropertySync.tsx`** (lines 181-182, 216-217, 252-253)
   - Replace `m.local_id.slice(0, 8)...` and `m.channex_id.slice(0, 8)...` with the full ID
   - Make cells use `break-all` or `select-all` for easy copying

2. **`src/components/channex/PropertySettings.tsx`** (line 249, used at lines 433-434)
   - Remove the `truncateId` helper or make it show the full ID
   - Show full IDs in the mappings table

3. **`src/pages/pms/ChannelMarkup.tsx`** (line 467)
   - Replace `dm.channex_derived_rate_plan_id.slice(0, 12)...` with the full ID

4. **`src/components/channex/RecentBookings.tsx`** (line 161)
   - Replace `b.channex_booking_id.slice(0, 12)...` with the full ID

### Approach
- Show full UUIDs in `text-xs font-mono break-all` styled cells
- Add click-to-copy (toast "Copied!") on each ID for usability
- Ensure table columns don't break layout by using appropriate min-widths


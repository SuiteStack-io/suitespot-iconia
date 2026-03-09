

## Remove Weekday Rate, Weekend Rate, Tax % from Add Room Modal

### Change
Delete lines 1532–1546 in `src/pages/Rooms.tsx` — the three input blocks for Weekday Rate, Weekend Rate, and Tax %.

Default values in `newUnit` state will still apply (`price_per_night: null`, `weekend_rate: null`, `tax_percentage: 14.00`), so database defaults are preserved. These fields remain editable via the inline table.

### Files
- `src/pages/Rooms.tsx`: Remove lines 1532–1546


## Rename Tab Label

Change the visible label only — keep the `value="rate-calendar"` and all tab content intact.

### Edits

1. `src/pages/pms/Prices.tsx` line 417
   - `<TabsTrigger value="rate-calendar">Rate Calendar</TabsTrigger>` → `<TabsTrigger value="rate-calendar">Rates List View</TabsTrigger>`

2. `src/pages/front-desk/RoomRates.tsx` line 241
   - `<TabsTrigger value="rate-calendar">Rate Calendar</TabsTrigger>` → `<TabsTrigger value="rate-calendar">Rates List View</TabsTrigger>`

No other changes.
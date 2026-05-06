# Remove pricing rows from Room Cards on /front-desk/room-rates

In `src/pages/front-desk/RoomRates.tsx`, delete lines 279–315 inside the room card's `<CardContent>`:

- The base-rate block with `DollarSign` icon + `weekdayRate`/`weekendRate` (lines 279–300)
- The `channelRates` (Booking.com etc.) block (lines 302–315)

Everything else in the card stays: photo, title, area, capacity, amenities, rate plan name. Data fetching and the `weekdayRate / weekendRate / channelRates` fields on the room object are left untouched (just unused for now) to avoid touching queries — pricing remains available via the List View / Calendar View tabs.

The unused `DollarSign` import will be removed if it has no other usage in the file.

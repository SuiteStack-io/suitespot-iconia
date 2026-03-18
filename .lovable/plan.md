

## Change Room Shuffle Email Sender to Front Desk

### Change

**File: `supabase/functions/auto-shuffle-rooms/index.ts`** (line 568)

Update the `from` field:
```
// Before
from: 'SuiteSpot Reservations <reservations@bookings.suitespoteg.com>'

// After
from: 'SuiteSpot Front Desk <frontdesk@bookings.suitespoteg.com>'
```

Then redeploy the `auto-shuffle-rooms` edge function.


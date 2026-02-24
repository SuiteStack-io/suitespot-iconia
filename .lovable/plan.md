

## Clickable Stats Cards with Modal Breakdowns

### Changes to `src/pages/Guests.tsx`

**1. Add state for modals**
- `showGuestsModal` and `showEmailsModal` boolean states

**2. Make cards clickable**
- Add `cursor-pointer hover:shadow-md transition-shadow` and `onClick` handlers

**3. Total Guests Modal** -- breakdown by:
- **Status distribution**: Colored progress bars showing counts per status (confirmed, pending, checked-in, checked-out, cancelled)
- **Source distribution**: Breakdown by booking source with counts and progress bars
- **Top nationalities**: Nationality counts with badges

**4. Emails Collected Modal** -- breakdown by:
- **Large progress bar**: Visual percentage of email coverage
- **Summary text**: "X of Y guests"
- **Missing Emails list**: Scrollable list of guest names + booking references who are missing emails (actionable for follow-up)
- **With Emails list**: Collapsible/scrollable list of guests who do have emails

No "Collection by Source" section -- since all email collection happens via check-in / guest forms, that breakdown is not meaningful.

### Modal Layouts

```text
Total Guests Modal:
+----------------------------------+
| Total Guests Breakdown     [X]   |
|----------------------------------|
| By Status                        |
| Confirmed  ████████░░  12 (40%) |
| Checked-in ██████░░░░   9 (30%) |
| Checked-out ████░░░░░░  6 (20%) |
| Pending     ██░░░░░░░░  3 (10%) |
|                                  |
| By Source                        |
| Booking.com ██████████  18 (60%)|
| Direct      ████░░░░░░   8 (27%)|
| Airbnb      ██░░░░░░░░   4 (13%)|
|                                  |
| Top Nationalities                |
| Egyptian 8 | British 5 | ...     |
+----------------------------------+

Emails Collected Modal:
+----------------------------------+
| Email Coverage             [X]   |
|----------------------------------|
| ██████████████░░░░░░  75%       |
| 45 of 60 guests                  |
|                                  |
| Missing Emails (15)              |
| - John Smith (BK-1234)          |
| - Jane Doe (BK-5678)            |
| ...scrollable list...            |
+----------------------------------+
```

### Technical Details
- Components: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` + `Progress` (all existing)
- Data: Computed from `filteredGuests` and `checkInAgreements` already in scope
- Only file changed: `src/pages/Guests.tsx`




## Add Nationality Badge to Reservation Quick Actions Modal

### Change — Single file: `src/components/ReservationQuickActions.tsx`

**Lines 988-998**: Update the guest info card to include a nationality badge after the status and source badges.

Current badge area:
```
<div className="flex items-center gap-2">
  <Badge>status</Badge>
  <Badge>source</Badge>
</div>
```

Updated structure:
- Change the layout so the guest name and badges wrap properly on mobile
- Add `flex-wrap` to the badges container
- After the source badge, conditionally render a nationality badge using `fullReservation?.guest_nationality`
- Style the nationality badge with a teal/cyan background: `bg-teal-100 text-teal-800 border-teal-300`
- Only show the badge when nationality is truthy (no "Unknown" or empty badge)

Badge order: Status, Source, Nationality — matching the requested sequence.

### What stays the same
- All existing badge colors for status and source
- All modal functionality (extend, move, checkout, swap, etc.)
- No data fetching changes needed — `fullReservation` already includes `guest_nationality` via `select("*")`


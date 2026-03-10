

## Change "Pending" to "Missing" for Completed Reservations

### Change — `src/pages/GuestForms.tsx`

**Logic**: When a reservation has no form (`!hasForm`) AND the reservation status is `checked-out` or `completed`, show a red "Missing" badge instead of the yellow "Pending" badge. "Pending" remains for `confirmed` and `checked-in` reservations without forms (they still have time to submit).

**1. Update the form status badge rendering** (~lines 796-810):

```tsx
{hasForm ? (
  <Badge variant="default" className="bg-green-600">Completed</Badge>
) : (reservation.status === 'checked-out' || reservation.status === 'completed') ? (
  <Badge variant="destructive" className="bg-red-600 text-white">Missing</Badge>
) : (
  <Badge 
    variant="outline"
    className="cursor-pointer bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200 transition-colors"
    onClick={() => window.open(`/guest-checkin/${reservation.id}`, '_blank')}
  >
    Pending
  </Badge>
)}
```

**2. Update CSV export** (~line 354): Change the export label from `'Pending'` to reflect the new logic:
- `Completed` if form exists
- `Missing` if no form and status is `checked-out`/`completed`
- `Pending` otherwise

### File
- `src/pages/GuestForms.tsx`


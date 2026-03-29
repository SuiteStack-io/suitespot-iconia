

## Add Booking Reference to Guest Information Card

### Change
**File**: `src/pages/ReservationDetail.tsx`

**Edit mode** (after line 1184, before Guest Names at line 1187): Add a read-only Booking Reference field:
```tsx
<div>
  <Label className="text-muted-foreground">Booking Reference</Label>
  <p className="mt-1 font-medium">{reservation.booking_reference || 'N/A'}</p>
</div>
```

**View mode** (after line 1294, before Guest Names at line 1295): Add the same block:
```tsx
<div>
  <Label className="text-muted-foreground">Booking Reference</Label>
  <p className="mt-1 font-medium">{reservation.booking_reference || 'N/A'}</p>
</div>
```

The field is read-only in both modes (not editable). Two insertions, no other changes.


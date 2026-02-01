

## Enhance Room Swap Dialog with Room Numbers and Visual Summary

### Current Issues

Looking at the screenshot, the "Confirm Room Swap" modal shows:
- "Deluxe Suite → Deluxe Suite" without specific room numbers

This makes it unclear which physical rooms are being swapped.

---

### Technical Changes

#### File: `src/components/RoomSwapDialog.tsx`

**1. Update Swap Summary section (lines 309-322)**

Add room numbers to the swap summary in the main dialog:

```typescript
{/* Current - lines 309-314 */}
<div className="flex items-center gap-2">
  <span>{reservation.guest_names[0]}</span>
  <ArrowRight className="h-3 w-3" />
  <span className="text-primary font-medium">
    {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name}
  </span>
</div>

{/* After - with room number */}
<div className="flex items-center gap-2">
  <span>{reservation.guest_names[0]}</span>
  <ArrowRight className="h-3 w-3" />
  <span className="text-primary font-medium">
    {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name} #{selectedSwapReservation.units?.unit_number}
  </span>
</div>
```

Apply the same pattern for the second guest (lines 316-322).

**2. Update Confirmation Dialog - First Reservation (lines 372-378)**

Add room numbers with a clearer visual format:

```typescript
{/* Current */}
<div className="text-sm text-muted-foreground flex items-center gap-1">
  <span>{currentUnit?.booking_com_name || currentUnit?.name}</span>
  <ArrowRight className="h-3 w-3" />
  <span className="text-primary font-medium">
    {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name}
  </span>
</div>

{/* After - with room numbers */}
<div className="text-sm flex items-center gap-1">
  <span className="font-medium">{currentUnit?.booking_com_name || currentUnit?.name} #{currentUnit?.unit_number}</span>
  <ArrowRight className="h-3 w-3 text-muted-foreground" />
  <span className="text-primary font-medium">
    {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name} #{selectedSwapReservation.units?.unit_number}
  </span>
</div>
```

**3. Update Confirmation Dialog - Second Reservation (lines 386-392)**

Apply the same format:

```typescript
<div className="text-sm flex items-center gap-1">
  <span className="font-medium">{selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name} #{selectedSwapReservation.units?.unit_number}</span>
  <ArrowRight className="h-3 w-3 text-muted-foreground" />
  <span className="text-primary font-medium">
    {currentUnit?.booking_com_name || currentUnit?.name} #{currentUnit?.unit_number}
  </span>
</div>
```

**4. Add "Room Swap" label for clarity in confirmation modal**

Update each reservation card in the confirmation dialog to include a visual label:

```typescript
<div className="p-3 bg-muted rounded-lg">
  <div className="font-medium">{reservation.guest_names[0]}</div>
  <div className="text-xs text-muted-foreground mb-2">
    {format(new Date(reservation.check_in_date), "MMM d")} - {format(new Date(reservation.check_out_date), "MMM d, yyyy")}
  </div>
  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Room Swap</div>
  <div className="text-sm flex items-center gap-1">
    <span className="font-medium">{currentUnit?.booking_com_name || currentUnit?.name} #{currentUnit?.unit_number}</span>
    <ArrowRight className="h-3 w-3 text-muted-foreground" />
    <span className="text-primary font-medium">
      {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name} #{selectedSwapReservation.units?.unit_number}
    </span>
  </div>
</div>
```

---

### Visual Result

**Before:**
```
Yazeed Almuqrin
Feb 8 - Feb 11, 2026
Deluxe Suite → Deluxe Suite
```

**After:**
```
Yazeed Almuqrin
Feb 8 - Feb 11, 2026
ROOM SWAP
Deluxe Suite #505 → Deluxe Suite #509
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/RoomSwapDialog.tsx` | Add room numbers to swap summary and confirmation dialog |


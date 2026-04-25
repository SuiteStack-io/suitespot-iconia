## Goal

Rename and restyle the two action buttons at the bottom of the Reservation Quick Actions modal so the labels are short, never overflow, and the layout works on mobile.

## File

`src/components/ReservationQuickActions.tsx` — only lines 1712–1732 (the `{/* Swap Room + Move Guest Buttons */}` block). No other files, handlers, or logic change.

## Changes

### Button labels
- "Swap Rooms with Another Reservation" → **Exchange Room**
- "Move Guest to New Room" → **Reassign Room**

### Icon position
- Move the icon to AFTER the text on both buttons (currently it's before, with `mr-2`).
- Use `gap-2` on the button (Button component already supports `gap-2` via base classes, but we'll add `gap-2` explicitly for clarity) and switch the icon class from `mr-2` to `ml-2` if needed — actually since we'll rely on flex `gap-2` and reorder children, drop the margin utilities entirely.

### Overflow protection
Add to both buttons:
- `whitespace-nowrap overflow-hidden text-ellipsis`
- `px-4` for horizontal breathing room
- `min-h-11` (44px tap target on mobile) — or `h-11` to match Button `default` size (already 40px; bump to `h-11`)

### Responsive layout
The wrapper is already `grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t` — keep as-is. Each button stays `w-full`.

### Final markup (replacement for lines 1712–1732)

```tsx
<div className="pt-2 border-t grid grid-cols-1 sm:grid-cols-2 gap-2">
  <Button
    variant="outline"
    className="w-full h-11 px-4 gap-2 whitespace-nowrap overflow-hidden text-ellipsis"
    onClick={() => setSwapDialogOpen(true)}
  >
    Exchange Room
    <ArrowLeftRight className="h-4 w-4" />
  </Button>
  {(reservation.status === "checked-in" ||
    reservation.status === "confirmed") && (
    <Button
      variant="outline"
      className="w-full h-11 px-4 gap-2 whitespace-nowrap overflow-hidden text-ellipsis"
      onClick={() => setSplitDialogOpen(true)}
    >
      Reassign Room
      <ArrowRight className="h-4 w-4" />
    </Button>
  )}
</div>
```

## Out of scope (unchanged)

- `handleViewDetails`, `handleMoveReservation`, `setSwapDialogOpen`, `setSplitDialogOpen` handlers
- View Details / Move Room row above
- Move-to-Room dropdown, Update Status buttons, Extend Stay mode, modal header, guest info card
- Any other component or file

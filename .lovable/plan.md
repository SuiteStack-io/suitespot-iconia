

## Plan: Make Pending Status Clickable to Open Guest Form

### Goal
Make the "Pending" status badge in the Guest Forms table clickable so it opens the guest check-in form in a new tab for completion.

---

### Technical Changes

#### File: `src/pages/GuestForms.tsx`

**Update the Form Status cell (lines 699-707)**

Currently, the Pending badge is not interactive:
```tsx
<TableCell>
  {hasForm ? (
    <Badge variant="default" className="bg-green-600">
      Completed
    </Badge>
  ) : (
    <Badge variant="destructive">Pending</Badge>
  )}
</TableCell>
```

Change the Pending badge to be clickable and open the guest form in a new tab:

```tsx
<TableCell>
  {hasForm ? (
    <Badge variant="default" className="bg-green-600">
      Completed
    </Badge>
  ) : (
    <Badge 
      variant="destructive"
      className="cursor-pointer hover:bg-destructive/80 transition-colors"
      onClick={() => window.open(`/guest-checkin/${reservation.id}`, '_blank')}
    >
      Pending
    </Badge>
  )}
</TableCell>
```

---

### Behavior

| Status | Behavior |
|--------|----------|
| **Completed** | Green badge, not clickable |
| **Pending** | Red badge, clickable - opens `/guest-checkin/{reservationId}` in new tab |

---

### Visual Feedback
- Add `cursor-pointer` to show clickability
- Add `hover:bg-destructive/80` for hover state
- Add `transition-colors` for smooth hover effect

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/GuestForms.tsx` | Make Pending badge clickable with onClick handler to open guest form in new tab |


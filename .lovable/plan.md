

## Hide Cancelled Guests by Default (Keep Accessible via Filter)

### Change

**File: `src/pages/Guests.tsx`**

1. **Default filter excludes cancelled**: Change the initial `statusFilter` state from `"all"` to a new value `"active"` (line 66)
2. **Add "Active" filter option**: Add an "Active (excl. Cancelled)" option to the status dropdown and keep the "All Statuses" option to include cancelled guests for retargeting
3. **Update filter logic** (line 211): When `statusFilter` is `"active"`, filter out guests where `status === "cancelled"`; when `"all"`, show everything including cancelled

This way the default view hides cancelled guests, but you can switch to "All Statuses" or specifically "Cancelled" to see them for retargeting.

### Dropdown Options (new order)
- **Active (default)** -- everything except cancelled
- All Statuses -- includes cancelled
- Confirmed
- Pending
- Cancelled
- Checked-in
- Checked-out


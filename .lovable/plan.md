

## Fix: Show Booking.com ID for Default Rate Plans

### Overview

Update the RatePlanCard component to display the Booking.com ID alongside "Always active (default rate)" when both conditions are true.

---

### Technical Change

**File: `src/components/pms/RatePlanCard.tsx`**

Update lines 118-124 to show both status and ID for default plans:

```typescript
// Current (hides ID for default plans):
<p className="text-xs text-muted-foreground mt-0.5">
  {ratePlan.is_default 
    ? 'Always active (default rate)' 
    : ratePlan.booking_com_id 
      ? `ID ${ratePlan.booking_com_id}` 
      : null}
</p>

// New (shows both for default plans with ID):
<p className="text-xs text-muted-foreground mt-0.5">
  {ratePlan.is_default 
    ? 'Always active (default rate)' 
    : ratePlan.booking_com_id 
      ? `ID ${ratePlan.booking_com_id}` 
      : null}
  {ratePlan.is_default && ratePlan.booking_com_id && (
    <span className="ml-2">• ID {ratePlan.booking_com_id}</span>
  )}
</p>
```

---

### After Code Change

1. Click the edit button (pencil icon) on the rate plan card
2. Enter "59882860" in the Booking.com ID field
3. Save the changes
4. The display will show: "Always active (default rate) • ID 59882860"

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/pms/RatePlanCard.tsx` | Modify | Show Booking.com ID alongside default status |




## Replace ID with "Always active (default rate)" for Default Rate Plans

### Overview

Modify the RatePlanCard component to display "Always active (default rate)" in place of the Booking.com ID for default rate plans. Non-default rate plans will continue to show their Booking.com ID.

---

### Current vs. New Layout

**Current:**
```text
Standard Rate                    [Default Badge]
ID 59882860
[Flexible]  Always active (default rate)
```

**New:**
```text
Standard Rate                    [Default Badge]
Always active (default rate)
[Flexible]  MMM d, yyyy - MMM d, yyyy  (or removed for default)
```

---

### Technical Changes

**File: `src/components/pms/RatePlanCard.tsx`**

Update lines 120-124 to conditionally show:
- For default rate plans: "Always active (default rate)"
- For non-default rate plans: "ID {booking_com_id}" (only if ID exists)

```typescript
// Change from:
{ratePlan.booking_com_id && (
  <p className="text-xs text-muted-foreground mt-0.5">
    ID {ratePlan.booking_com_id}
  </p>
)}

// To:
<p className="text-xs text-muted-foreground mt-0.5">
  {ratePlan.is_default 
    ? 'Always active (default rate)' 
    : ratePlan.booking_com_id 
      ? `ID ${ratePlan.booking_com_id}` 
      : null}
</p>
```

Also remove the duplicate "Always active (default rate)" from the validity text section (line 132-134) since it will now appear in the ID line.

---

### File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/pms/RatePlanCard.tsx` | Modify | Show "Always active (default rate)" for default plans, ID for others |


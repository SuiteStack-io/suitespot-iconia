

## Plan: Add Room Nights Subheading to Occupancy Rate Card

### Summary

Add a subheading to the Occupancy Rate card in Analytics showing the breakdown format "X of Y room nights" (e.g., "223 of 326 room nights").

---

### Technical Change

#### File: `src/pages/Analytics.tsx`

**Lines 1064-1070** - Add the room nights subheading below the percentage:

```tsx
// Before
<CardContent>
  <div className="text-2xl font-bold">
    {occupancyRate.toFixed(1)}%
  </div>
  <p className="text-xs text-muted-foreground mt-1">
    Last {timePeriod}
  </p>
</CardContent>

// After
<CardContent>
  <div className="text-2xl font-bold">
    {occupancyRate.toFixed(1)}%
  </div>
  <p className="text-xs text-muted-foreground mt-1">
    {totalNights} of {totalAvailableRooms} room nights
  </p>
</CardContent>
```

---

### State Variables Used

Both values are already available in state:
- `totalNights` - Number of booked room nights in the period
- `totalAvailableRooms` - Total available room nights (units × days - blocked nights)

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Analytics.tsx` | Update occupancy card subheading to show room nights breakdown |


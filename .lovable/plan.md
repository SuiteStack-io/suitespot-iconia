
## Fix Date Number Visibility Behind Continuation Badge

### Issue
The date number "1" for April 1st is hidden behind the "← cont." (continuation from previous month) badge. This occurs because the badge uses `absolute top-1 left-1` positioning which overlaps the date number that doesn't have any z-index positioning.

**Note:** The calendar day alignment fix from the previous change IS working correctly. April 4th is correctly in the Saturday column. The issue is purely a visual overlap problem.

---

### Technical Changes

**File:** `src/components/RoomCalendar.tsx`

#### Update day number div to have relative positioning and z-index (Line 472)

```typescript
// Change from:
<div className="text-sm font-semibold mb-1">{format(date, 'd')}</div>

// To:
<div className="text-sm font-semibold mb-1 relative z-10">{format(date, 'd')}</div>
```

This ensures the date number appears above any absolutely positioned badges like the continuation indicator.

---

### Alternative Solution (Better UX)

If the date should be visible alongside the badge rather than overlapping, we could also adjust the badge position:

#### Move the continuation badge to avoid overlapping the date (Line 479)

```typescript
// Change from:
<div className="absolute top-1 left-1 cursor-help">

// To:
<div className="absolute top-1 right-1 cursor-help">
```

This moves the continuation badge to the top-right corner of the cell, keeping the date number in its normal position at top-left.

---

### Recommended Approach

Both fixes can be applied together for maximum visibility:
1. Add `relative z-10` to date number (ensures date is always visible)
2. Move badge to `right-1` instead of `left-1` (prevents overlap entirely)

---

### Result

| Before | After |
|--------|-------|
| April 1st date "1" hidden behind "← cont." badge | April 1st shows both "1" and "← cont." badge clearly |



## Plan: Fix "In House" Card to Exclude Past Checkout Dates

### Problem Analysis
The "In House" card shows outdated guests because:

1. **Room 518**: Nouf Alothman (checkout Jan 22) still shows status `checked-in`, but Mounira Elbalawy (check-in Jan 23 - Jan 31) is the current occupant
2. **Room 505**: Santiago Zaratiegui (checkout Jan 22) still shows status `checked-in`, but Ehoud Almohannadi (check-in Jan 22 - Jan 30) is the current occupant

**Root Cause**: Staff didn't check out the old guests, so their status remains `checked-in`. The current code only filters by `status = 'checked-in'` without verifying the checkout date hasn't passed.

---

### Solution

Add an additional filter to the "In House" queries to exclude reservations where `check_out_date < today`. This ensures that even if staff forget to check out a guest, they won't appear in "In House" after their checkout date.

---

### Technical Changes

#### File: `src/pages/Dashboard.tsx`

**1. Update the stats count query (lines 218-222)**

| Current | Updated |
|---------|---------|
| `eq('status', 'checked-in')` | `eq('status', 'checked-in').gte('check_out_date', today)` |

```typescript
// In-house count (reservations that are currently checked-in AND checkout date hasn't passed)
const { data: inHouse } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .eq('status', 'checked-in')
  .gte('check_out_date', today)  // Only include if checkout date is today or future
  .is('cancelled_at', null);
```

**2. Update the dialog query for "In House" card click (lines 407-409)**

```typescript
case 'inhouse':
  setDialogTitle('In-House Now');
  query = query
    .eq('status', 'checked-in')
    .gte('check_out_date', today)  // Only include if checkout date is today or future
    .is('cancelled_at', null);
  break;
```

---

### Why This Works

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| Guest checked in, checkout is tomorrow | ✓ Shown | ✓ Shown |
| Guest checked in, checkout is today | ✓ Shown | ✓ Shown |
| Guest checked in, checkout was 3 days ago (forgot to check out) | ❌ Shown incorrectly | ✓ Not shown |

---

### Expected Result

After this fix:
- **Room 518** will no longer show Nouf Alothman (checkout was Jan 22)
- **Room 505** will no longer show Santiago Zaratiegui (checkout was Jan 22)

**Note**: The new guests (Mounira Elbalawy and Ehoud Almohannadi) won't appear in "In House" until staff checks them in - this is correct behavior per the existing workflow.

---

### Additional Recommendation

To fully resolve the data issue, staff should:
1. Check out the stale reservations (Nouf Alothman and Santiago Zaratiegui)
2. Check in the current guests (Mounira Elbalawy and Ehoud Almohannadi)

The code fix prevents future occurrences of this display issue, but a one-time data cleanup is also needed.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add `gte('check_out_date', today)` filter to both the stats query (line 218-222) and the dialog query (line 407-409) |


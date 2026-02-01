
## Fix Calendar Week Starting Day Mismatch

### Issue
The calendar displays day headers starting with Monday (`['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']`), but the `startOfWeek()` and `endOfWeek()` functions from date-fns default to Sunday as the first day of the week. This causes dates to appear in the wrong column - e.g., April 4th, 2026 (Saturday) appears in the Sunday column.

---

### Technical Changes

**Files to Update:**

#### 1. `src/components/RoomCalendar.tsx` (Lines 418-419)

```typescript
// Change from:
const calendarStart = startOfWeek(monthStart);
const calendarEnd = endOfWeek(monthEnd);

// To:
const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
```

#### 2. `src/components/MobileCalendarView.tsx` (Lines 290-291)

```typescript
// Change from:
const calendarStart = startOfWeek(monthStart);
const calendarEnd = endOfWeek(monthEnd);

// To:
const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
```

---

### Root Cause

| Function | Default Behavior | Required Behavior |
|----------|-----------------|-------------------|
| `startOfWeek()` | Sunday (0) | Monday (1) |
| `endOfWeek()` | Saturday (6) | Sunday (0) |

The `{ weekStartsOn: 1 }` option tells date-fns to use Monday (ISO 8601 standard) as the first day of the week.

---

### Result

| Date | Before (Wrong Column) | After (Correct Column) |
|------|----------------------|------------------------|
| April 4, 2026 (Saturday) | Sun | Sat |
| April 5, 2026 (Sunday) | Mon | Sun |

The calendar dates will align correctly with their respective day headers.

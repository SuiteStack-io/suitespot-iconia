

## Improve Restrictions Log Table: Readable Labels and Date Display

### File: `src/components/pms/RestrictionsLogTable.tsx`

**Two changes:**

#### 1. Readable restriction badges (lines 144-153)

Replace abbreviated codes with full labels:

| Current | New |
|---------|-----|
| `A:5` | `Min Stay Arrival: 5 nights` |
| `T:3` | `Min Stay Through: 3 nights` |
| `Max:14` | `Max Stay: 14 nights` |
| `CTA` | `Closed to Arrival` |
| `CTD` | `Closed to Departure` |
| `Stop Sell` | (already readable, keep as-is) |

Badge variants stay the same (destructive for Stop Sell, secondary for stay rules, outline for CTA/CTD). Remove the `text-[10px]` class since labels are now full words.

#### 2. Fix date range display (lines 136-141)

The DB stores exclusive `date_to`. Convert for display:

```typescript
import { subDays } from 'date-fns';

const displayDateTo = subDays(new Date(r.date_to + 'T00:00:00'), 1);
const isSingleDay = r.date_from === format(displayDateTo, 'yyyy-MM-dd');

// Render:
isSingleDay ? "Nov 15, 2026" : "Nov 15 → Nov 17, 2026"
```

Add `subDays` to the existing `date-fns` import.

### Summary

Single file change. Two sections updated: badges (lines 144-153) and date display (lines 136-141).


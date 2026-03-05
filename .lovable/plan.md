

## Fix: Use date-fns for Channex Restriction Date Conversion

### Change

In `supabase/functions/channex-push-restrictions/index.ts`, convert the exclusive `date_to` from the database to an inclusive date for Channex using `subDays` and `format` from `date-fns`.

**File:** `supabase/functions/channex-push-restrictions/index.ts`

Add import at top:
```typescript
import { subDays, format } from "https://esm.sh/date-fns@3.6.0";
```

Update the values loop (line 85-96) to convert `date_to`:
```typescript
const inclusiveDateTo = format(subDays(new Date(r.date_to), 1), 'yyyy-MM-dd');

values.push({
  ...
  date_from: r.date_from,
  date_to: inclusiveDateTo,  // was: r.date_to
  ...
});
```

Single file, two-line change.


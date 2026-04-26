# Plan: Add Automatic / Manual filter toggle to Shuffle History

Touches one file only: `src/pages/ShuffleHistory.tsx`. Adds a Tabs toggle, filters the existing query by `change_type`, makes the subtitle and empty state dynamic, swaps the row icon for manual entries, and persists the selection in the URL via `?type=...`.

## 1. State + URL sync

Use `useSearchParams` from `react-router-dom` (the codebase already uses `react-router-dom` heavily; pattern matches `BookingFlow.tsx`).

```ts
import { useNavigate, useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();
const filter: 'automatic' | 'manual' =
  searchParams.get('type') === 'manual' ? 'manual' : 'automatic';

const handleFilterChange = (value: string) => {
  if (value !== 'automatic' && value !== 'manual') return;
  const next = new URLSearchParams(searchParams);
  if (value === 'automatic') next.delete('type'); // default → no param
  else next.set('type', 'manual');
  setSearchParams(next, { replace: true });
};
```

No separate `useState` for `filter` — derived from the URL so refresh / share works for free.

## 2. Header toggle

Place the `Tabs` component beside the title block in the header (same row at `sm`, stacked on mobile). Match the Analytics.tsx pattern exactly:

```tsx
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

<Tabs value={filter} onValueChange={handleFilterChange}>
  <TabsList>
    <TabsTrigger value="automatic">Automatic</TabsTrigger>
    <TabsTrigger value="manual">Manual</TabsTrigger>
  </TabsList>
</Tabs>
```

Wrap the existing title/subtitle and the new Tabs in a `flex items-center justify-between flex-wrap gap-3` container so the toggle floats right on desktop and wraps under the title on narrow viewports.

## 3. Dynamic subtitle

```tsx
<p className="text-sm text-muted-foreground">
  {filter === 'manual' ? 'Manual room change log' : 'Auto-shuffle room rearrangement log'}
</p>
```

## 4. Query update

Modify the existing `fetchLogs` (~L43). Add `.eq('change_type', filter)` and include `filter` in the `useEffect` dependency array. Keep `withPropertyFilter` and the `.order('shuffle_date', { ascending: false }).limit(100)` exactly as today.

```ts
useEffect(() => {
  if (user) fetchLogs();
}, [user, propertyId, filter]);

const fetchLogs = async () => {
  setFetching(true);
  let query = supabase
    .from('room_shuffle_log')
    .select('*')
    .eq('change_type', filter)
    .order('shuffle_date', { ascending: false })
    .limit(100);
  query = withPropertyFilter(query, propertyId) as any;
  const { data, error } = await query;
  if (error) console.error('Error fetching shuffle logs:', error);
  else setLogs((data as any) || []);
  setFetching(false);
};
```

## 5. Dynamic empty state

The current empty state shows the Shuffle icon and `No room shuffles have occurred yet.` Make the message conditional; keep the icon block as today (Shuffle icon is fine for the empty state — only the row-level icon swaps).

```tsx
<p>{filter === 'manual' ? 'No manual room changes yet.' : 'No room shuffles have occurred yet.'}</p>
```

## 6. Row-level icon swap (visual differentiation)

Inside the `logs.map(log => ...)` card header, replace the hard-coded `<Shuffle className="h-5 w-5 text-amber-500" />` with a conditional based on `filter` (the data is already filtered, so all rows in view share one type — no need to read `log.change_type`):

```tsx
import { Shuffle, User } from 'lucide-react';

{filter === 'manual'
  ? <User className="h-5 w-5 text-stone-600" />
  : <Shuffle className="h-5 w-5 text-amber-500" />}
```

Card title text (`Shuffle for booking …`), the room-type badge, the move-count badge, the timestamp, and the per-move row layout all stay byte-for-byte identical.

## 7. Out of scope (untouched)

- `room_shuffle_log` schema and the `change_type` default
- Auto-shuffle / auto-assign Edge Functions
- Manual logging logic added in Prompt 3
- Undo button + queue (Prompt 5)
- Card layout, badges, timestamp, and per-move row styling
- The `shuffle_date desc` sort and the 100-row limit
- Any other page in the app

## Verification

- Default load (`/shuffle-history`): Automatic tab selected, URL has no `?type`, query returns rows where `change_type = 'automatic'`, amber Shuffle icon shows.
- Click Manual: URL becomes `?type=manual`, query refetches with `change_type = 'manual'`, rows show stone-colored User icon, subtitle reads "Manual room change log".
- Refresh on `?type=manual`: page loads with Manual selected.
- Empty state text matches the active tab.
- Mobile (~375px): title wraps cleanly, Tabs remain tappable.

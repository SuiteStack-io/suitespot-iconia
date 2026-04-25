## Add persistent Revenue Share to Analytics page

Make the Landlord/Suitespot revenue split persist to the database via a Save button next to the slider. Reuse the existing `PropertyContext` (already fetches `select('*')` from `properties`) — no extra query.

### 1. Database migration

Add `landlord_share_percentage` to `properties` (column does not currently exist):

```sql
ALTER TABLE public.properties
  ADD COLUMN landlord_share_percentage numeric NOT NULL DEFAULT 70;

UPDATE public.properties
  SET landlord_share_percentage = 70
  WHERE landlord_share_percentage IS NULL;
```

`DEFAULT 70 NOT NULL` covers existing rows automatically; the UPDATE is a defensive backfill.

### 2. Edit `src/pages/Analytics.tsx`

**Read saved value from existing context**

`src/lib/propertyContext.tsx` already does `.from('properties').select('*')` and exposes `activeProperty` via `useProperty()`. The new column will ride along on that object. No new fetch needed.

```ts
import { useProperty } from '@/lib/propertyContext';
import { toast } from 'sonner';

const { activeProperty, refreshProperties } = useProperty();
const propertyId = usePropertyId(); // already in file

// derive saved value from context (cast: types.ts not yet regenerated for new column)
const savedLandlordPercentage =
  Number((activeProperty as any)?.landlord_share_percentage ?? 70);

const [landlordPercentage, setLandlordPercentage] = useState(savedLandlordPercentage);
const [savingShare, setSavingShare] = useState(false);

// Sync slider when active property changes (switch property, or after refresh)
useEffect(() => {
  setLandlordPercentage(savedLandlordPercentage);
}, [savedLandlordPercentage]);
```

Replace the existing `useState(70)` on line 65 — do **not** declare `landlordPercentage` twice.

**Save handler**

```ts
const handleSaveShare = async () => {
  if (!propertyId) return;
  setSavingShare(true);
  const { error } = await (supabase.from('properties') as any)
    .update({ landlord_share_percentage: landlordPercentage })
    .eq('id', propertyId);
  setSavingShare(false);
  if (error) {
    toast.error('Could not save revenue share. Please try again.');
  } else {
    toast.success('Revenue share saved');
    await refreshProperties(); // updates context → savedLandlordPercentage → button disables
  }
};
```

**Save button** — placed immediately after the Suitespot label (line 954), inside the same flex row:

```tsx
<Button
  size="sm"
  onClick={handleSaveShare}
  disabled={savingShare || landlordPercentage === savedLandlordPercentage}
>
  {savingShare ? 'Saving…' : 'Save'}
</Button>
```

(`Button` already imported in the file.)

### 3. Behavior preserved

- Slider keeps `min=0 max=100 step=5` and label format
- All cards / tables / Export keep using live `landlordPercentage` — math untouched
- Reload restores last saved value (comes from context, which loads on mount)
- Switching active property re-syncs the slider to that property's saved value
- Unsaved changes silently discarded on navigate/reload — no confirm dialog

### 4. Out of scope

Date range pills, custom range picker, Export button/dialog, KPI cards, tables, slider visuals.

### Variable-collision check

- `landlordPercentage` / `setLandlordPercentage` — existing line 65, will be reused (initial value changes from `70` to `savedLandlordPercentage`); not redeclared.
- New identifiers only: `savedLandlordPercentage`, `savingShare`, `setSavingShare`, `handleSaveShare`, `activeProperty`, `refreshProperties` (destructured from `useProperty()`).
- `useProperty` and `toast` imports added if not already present.
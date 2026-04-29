# Promotions: queued save + OTA preview

All changes confined to `src/pages/Promotions.tsx`. No DB schema, edge function, or other component changes.

## New state in `Promotions()`

```ts
type PendingPromo = {
  tempId: string;
  payload: {
    property_id: string;
    name: string;
    description: string | null;
    booking_window_start: string;
    booking_window_end: string;
    stay_start: string;
    stay_end: string;
    discount_type: 'percentage' | 'fixed_amount';
    discount_value: number;
    min_stay: number | null;
    room_types: string[] | null;
    is_active: boolean;
  };
  rateSnapshots: Array<{ room_type: string; weekday_rate: number; weekend_rate: number }>;
};

const [pendingPromotions, setPendingPromotions] = useState<PendingPromo[]>([]);
const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');
const [saveProgress, setSaveProgress] = useState(0);
const [saveStep, setSaveStep] = useState('');
const [channelMarkups, setChannelMarkups] =
  useState<Array<{ channel_name: string; markup_percentage: number }>>([]);
```

## Imports to add

`Progress` from `@/components/ui/progress`; `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `@/components/ui/table`; `X` icon from `lucide-react`.

## Effects

1. Load active channel markups for the property:
```ts
useEffect(() => {
  if (!propertyId) return;
  (async () => {
    const { data } = await supabase
      .from('channel_markup_settings')
      .select('channel_name, markup_percentage')
      .eq('property_id', propertyId)
      .eq('is_active', true);
    setChannelMarkups((data ?? []).map((r: any) => ({
      channel_name: r.channel_name,
      markup_percentage: Number(r.markup_percentage),
    })));
  })();
}, [propertyId]);
```

2. `beforeunload` warning while `pendingPromotions.length > 0`.

## Dialog: "Add to Pending"

- Add optional prop `onAddPending?: (payload, rateSnapshots) => void` to `PromotionDialog`.
- Extract validation + payload-building from `handleSave` into a local helper `buildPayload()` returning the same `payload` object (or `null` after toasting). Both the edit branch and the new add-to-pending branch call it.
- When `editing == null` and `onAddPending` is provided:
  - Call `buildPayload()`; if valid, fetch rate snapshots (see below) then call `onAddPending(payload, snapshots)` and `onOpenChange(false)`. No DB write here.
- When `editing != null`: existing direct update path is preserved (button label stays "Save Changes").
- Primary button label: `editing ? 'Save Changes' : 'Add to Pending'`.

## Rate snapshot fetch (inside dialog when adding to pending)

```ts
const affected = payload.room_types && payload.room_types.length > 0
  ? payload.room_types
  : availableRoomTypes; // already loaded from units table

const { data: priceRows } = await supabase
  .from('rate_plan_prices')
  .select('room_type, weekday_rate, weekend_rate, rate_plans!inner(property_id)')
  .eq('rate_plans.property_id', propertyId)
  .in('room_type', affected)
  .is('unit_id', null);

const seen = new Set<string>();
const rateSnapshots = (priceRows ?? [])
  .filter((r: any) => r.room_type && !seen.has(r.room_type) && (seen.add(r.room_type), true))
  .map((r: any) => ({
    room_type: r.room_type,
    weekday_rate: Number(r.weekday_rate),
    weekend_rate: Number(r.weekend_rate ?? r.weekday_rate),
  }));
```

## `addToPending` in `Promotions`

```ts
const addToPending = (payload: PendingPromo['payload'], rateSnapshots: PendingPromo['rateSnapshots']) => {
  setPendingPromotions(prev => [...prev, { tempId: crypto.randomUUID(), payload, rateSnapshots }]);
  toast.success('Added to pending');
};
const removePending = (tempId: string) =>
  setPendingPromotions(prev => prev.filter(p => p.tempId !== tempId));
```

## Pending Promotions card (rendered between Active card and Past card, only when `pendingPromotions.length > 0`)

- Header: title "Pending Promotions", description `${pendingPromotions.length} promotion(s) ready to save`, right-aligned **Save Changes** button (disabled while saving).
- When `saveStatus !== 'idle'`: `<Progress value={saveProgress} />` + small `saveStep` text.
- For each pending row:
  - Header line: bold name; discount badge (`-X% off` or `-$Y off`); `Bookable: …`; `For stays: …`; optional min stay; optional room-types list; `X` button (calls `removePending`).
  - Compact `Table`:
    - Columns: `Room Type | Day | PMS Before → After` followed by one column per channel (`{channel} Before → After`). If `channelMarkups.length === 0`, omit channel columns.
    - Two rows per snapshot: `Wkd` (weekday_rate) and `Wkn` (weekend_rate).
    - Computation:
      ```ts
      const after = (base: number) =>
        payload.discount_type === 'percentage'
          ? base * (1 - payload.discount_value / 100)
          : Math.max(0, base - payload.discount_value);
      const channel = (v: number, pct: number) => v * (1 + pct / 100);
      ```
    - Cell format: `${symbol}${Math.round(before)} → ${symbol}${Math.round(after)}`, after styled `text-emerald-600`.
  - Footer note (muted): "Preview based on current base rates. Actual rates will reflect dynamic pricing adjustments at the time of stay."

## `saveAllPending` (corrected per feedback)

```ts
async function saveAllPending() {
  if (pendingPromotions.length === 0) return;
  setSaveStatus('saving');
  setSaveProgress(15);
  setSaveStep('Creating promotions...');
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const rows = pendingPromotions.map(p => ({
      ...p.payload,
      created_by: userRes.user?.id ?? null,
    })); // flat array of row objects, NOT wrapped in extra brackets

    const { error: insertErr } = await supabase
      .from('promotional_periods' as any)
      .insert(rows);
    if (insertErr) throw insertErr;

    setSaveProgress(60);
    setSaveStep('Syncing to Channex...');

    // channex-full-sync only accepts { propertyId } (verified in
    // supabase/functions/channex-full-sync/index.ts) — runs full 500-day sync.
    // calculate-dynamic-price will apply the new promotions on top of the
    // dynamic rate per day, so we do NOT compute or push static discounted rates.
    const { error: syncErr } = await supabase.functions.invoke('channex-full-sync', {
      body: { propertyId },
    });

    setSaveProgress(100);
    if (syncErr) {
      console.warn('channex-full-sync failed', syncErr);
      toast.warning('Promotions saved. Channex sync failed — please retry sync.');
    } else {
      toast.success('Promotions saved and synced to Channex');
    }
    setSaveStatus('success');
    setPendingPromotions([]);
    await fetchPromotions();
    setTimeout(() => { setSaveStatus('idle'); setSaveProgress(0); setSaveStep(''); }, 2000);
  } catch (err: any) {
    console.error('Failed to save pending promotions', err);
    setSaveStatus('error');
    toast.error(err.message || 'Failed to save promotions');
    setTimeout(() => { setSaveStatus('idle'); setSaveProgress(0); setSaveStep(''); }, 3000);
  }
}
```

The `.map()` produces a flat `Array<row>`, passed directly to `.insert(rows)` — no extra brackets, no nested arrays.

## Wiring

```tsx
<PromotionDialog
  ...
  onAddPending={addToPending}
/>
```

## Out of scope

- `promotional_periods` schema, `calculate-dynamic-price`, `channex-full-sync`
- Existing edit/delete/toggle paths
- OTA notice card, page header, Past Promotions section
- Any other page or component

## Duplicate-declaration check

New identifiers (`PendingPromo`, `pendingPromotions`, `saveStatus`, `saveProgress`, `saveStep`, `channelMarkups`, `addToPending`, `removePending`, `saveAllPending`, `buildPayload`, `PendingPromotionsCard`) do not collide with existing names in the file. Existing `today`, `saving`, `editing`, etc. are untouched.

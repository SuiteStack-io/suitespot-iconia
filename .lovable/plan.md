## Add Manual Overrides to Dynamic Pricing

All work in `src/pages/DynamicPricing.tsx`. No DB, edge function, or other page changes.

### 1. New `OverrideDialog` component (module-scope, below `PricingDashboard`)

Shared dialog for create/edit/quick-override. Props:
```ts
{
  open, onOpenChange, propertyId,
  roomTypes: string[],          // distinct booking_com_name from units
  initial?: {
    id?: string;                // present => edit mode
    override_date?: string;
    room_type?: string | null;
    override_type?: 'fixed_rate'|'percentage_adjustment'|'multiplier';
    value?: number;
    reason?: string;
  };
  allowDateRange?: boolean;     // false in edit/quick mode
  onSaved: () => void;
}
```

Body:
- **Date**: two `<Input type="date">` (Start/End). Single date when editing or `allowDateRange===false`.
- **Room Type**: `<Select>` with `__all__`→null + `roomTypes`. Disabled in edit mode.
- **Override Type**: `<RadioGroup>` Fixed Rate / Percentage Adjustment / Multiplier.
- **Value**: `<Input type="number">` with prefix/suffix + helper that swaps with type:
  - fixed_rate: "$" prefix, "Set rate to exactly this amount"
  - percentage_adjustment: "%" suffix, "Adjust calculated rate by this percentage (use negative for discount)"
  - multiplier: "x" suffix, "Multiply calculated rate by this factor"
- **Reason**: optional `<Input>`.
- Save button = "Update" if edit else "Save".

Save:
- Build inclusive date list (single in edit/quick).
- Edit: `update pricing_overrides set override_type, value, reason where id`.
- Create: `insert` array of rows `{ property_id, override_date, room_type: roomType||null, override_type, value, reason, created_by: user.id }`.
- Postgres `23505` → toast `"An override already exists for this date and room type"`.
- Success → toast (`"Override added for {date}"` or `"Added {n} overrides"`), `onSaved()`, close.

### 2. New `OverridesSection` component (module-scope)

Props: `{ propertyId, refreshKey, onChanged }`.

State:
- `rows`: `pricing_overrides` where `property_id = propertyId` and `override_date >= today` (today = `new Date().toISOString().slice(0,10)`), order asc.
- `roomTypes`: distinct `booking_com_name` from `units` where `property_id = propertyId` and `booking_com_name is not null` (mirrors `src/pages/pms/Prices.tsx:186,246`).
- `creators`: `profiles.full_name` map for displayed `created_by`.
- `dialogOpen`, `editing`, `confirmDeleteId`.

Render:
- `<Card>` "Manual Overrides" + description + `Add Override` button in header.
- Table: Date | Room Type | Type | Value | Reason | Created By | Actions.
  - Type label: `fixed_rate→"Fixed Rate"`, `percentage_adjustment→"% Adjustment"`, `multiplier→"Multiplier"`.
  - Value: fixed `$X`, pct `+X%`/`X%`, mult `X.Xx`.
  - Room Type: `room_type ?? "All"`.
  - Created By: full_name fallback `—`.
  - Actions: Pencil opens edit dialog; Trash opens AlertDialog → delete → toast `"Override removed"` → reload + `onChanged()`.
- Empty state row when none.

Refetch deps: `[propertyId, refreshKey]`.

### 3. Wire into page

In parent `DynamicPricing`:
```ts
const [overridesRefreshKey, setOverridesRefreshKey] = useState(0);
```
After `<PricingDashboard ... />` (lines 992-995):
```tsx
<OverridesSection
  propertyId={propertyId}
  refreshKey={overridesRefreshKey}
  onChanged={() => setOverridesRefreshKey(k => k + 1)}
/>
```
Pass `overridesRefreshKey` and `onOverridesChanged` into `PricingDashboard`. When `overridesRefreshKey` changes, dashboard clears `previewByMonth` (set to `{}`) so preview reloads.

### 4. Quick override from preview table

Inside `PricingDashboard`'s Override cell (1523-1525):

- Add state `quickDialog: { open, initial, allowDateRange:false }`.
- Fetch `roomTypes` for the dialog: extend the existing units query (line 1184) from `select('id')` → `select('id, booking_com_name')`, derive distinct list, store in state.
- Cell:
  - If `isOverride`: render existing `<Badge>` as a clickable button. On click, look up the existing override with **explicit precedence** (specific room_type wins over wildcard):
    ```ts
    const { data: matches } = await supabase
      .from('pricing_overrides')
      .select('*')
      .eq('property_id', propertyId)
      .eq('override_date', row.target_date)
      .or(`room_type.eq.${selectedRatePlan.room_type},room_type.is.null`);
    const specific = matches?.find(m => m.room_type === selectedRatePlan.room_type);
    const wildcard = matches?.find(m => m.room_type === null);
    const existingOverride = specific ?? wildcard;
    ```
    Open dialog with `initial = existingOverride` mapped to dialog shape.
  - Else: small ghost `Button` with `+` → opens dialog with `initial = { override_date: row.target_date, room_type: selectedRatePlan.room_type, override_type: 'fixed_rate', value: Math.round(row.final_rate) }`.
- Render `<OverrideDialog>` inside dashboard. `onSaved` clears `previewByMonth` for the current `${selectedMonth}_${selectedRatePlan.id}` key, calls parent `onOverridesChanged`.

### 5. Imports to add

```ts
import { Plus, Pencil, Trash2 } from 'lucide-react';   // merge into existing lucide import
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```
Also pull `user` from `useAuth()` in OverridesSection / dialog (already imported at line 5).

### 6. Verified against schema

- `pricing_overrides` columns used: `id, property_id, override_date, override_type, value, reason, room_type, created_by, created_at` — all present.
- Unique constraint `(property_id, override_date, room_type)` + partial unique index for null `room_type` → conflict caught via `23505`.
- `units.booking_com_name` confirmed (src/types/unit.ts; usage pattern matches src/pages/pms/Prices.tsx).
- No duplicate identifiers introduced (`OverrideDialog`, `OverridesSection`, `overridesRefreshKey`, `quickDialog`, `roomTypes` are new in their scopes).

### Out of scope
Settings card, dashboard month-card aggregation, edge functions, DB schema, other pages.

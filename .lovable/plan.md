## Add Read-Only Revenue Recognition Method label to Analytics page

Adds a small read-only label showing the property's configured Revenue Recognition Method on the Analytics page, placed in the same vertical slot as the Revenue Share Card so layout stays consistent regardless of `has_landlord`.

### Verified existing state in `src/pages/Analytics.tsx`

- Line 56: `hasLandlord` already derived from `activeProperty.has_landlord` — reuse, do not redeclare.
- Lines 57–58: `method` already derived from `activeProperty.revenue_recognition_method` — reuse, do not redeclare.
- Lines 982–1011: Revenue Share Card is wrapped in `{hasLandlord && (<Card>…</Card>)}`. Outer flex row at line 985 is `flex items-center gap-4 flex-wrap`. Save button is inside an inner `flex items-center gap-4 text-sm` div (lines 997–1007).

### Changes

**1. Add display-label derivation (after line 58)**

```ts
const methodDisplayLabel =
  method === 'check_in' ? 'Upon check-in' :
  method === 'check_out' ? 'Upon check-out' :
  'Pro-rata nights';
```

(Strings match Step 4 dropdown labels exactly.)

**2. Replace lines 982–1011 with an `if/else` ternary so something is always rendered in this slot**

- Case A (`hasLandlord === true`): keep the existing Card content unchanged. Append a new label span as the LAST child of the outer `flex flex-wrap` row (after the inner div that holds the Save button, i.e. after line 1007's `</div>`):

```tsx
<span className="text-sm text-muted-foreground">
  Revenue Recognition Method:{' '}
  <span className="font-medium text-foreground">{methodDisplayLabel}</span>
</span>
```

Because the outer row is `flex-wrap`, the label naturally wraps below the Save button on narrow viewports.

- Case B (`hasLandlord === false`): render a new standalone Card with identical wrapper classes (`bg-gradient-to-r from-card to-card/80` + `CardContent className="py-4"`) containing only the same label span, left-aligned.

### Out of scope (unchanged)

- Slider, Landlord/Suitespot percentage labels, Save button behavior
- Date range pills, Custom Range picker, KPI cards, detail dialogs, Excel export
- No new state, fetch, useEffect, DB column, or query
- No redeclaration of `method` or `hasLandlord`

### Sync

`method` and `hasLandlord` come from `activeProperty`. After the user saves Step 4 of the Edit Property modal, `refreshProperties()` updates `activeProperty` and the label re-renders automatically.

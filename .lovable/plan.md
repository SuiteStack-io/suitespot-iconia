

## Dynamic Property Slug for Photo Filenames

### Problem
The SEO prefix `"iconia-zamalek"` is hardcoded in `src/pages/Rooms.tsx` (line 1812). It should dynamically use the active property name from the property context.

### Change

**File: `src/pages/Rooms.tsx`** — single-line change:

Replace the hardcoded `seoPrefix="iconia-zamalek"` with a dynamic slug derived from `activeProperty.name`:

```tsx
seoPrefix={activeProperty?.name?.toLowerCase().replace(/\s+/g, '-') || 'property'}
```

The `activeProperty` is already available via the `useProperty()` hook which is already imported and used in this file. No new imports or logic needed.

### Result
- "Iconia Zamalek" → `iconia-zamalek-family-suite-1.webp`
- "Almaza Bay Resort" → `almaza-bay-resort-deluxe-suite-1.webp`
- Any future property works automatically




## Plan: Hide Export CSV Button on Mobile

### Change Summary

Hide the "Export CSV" button on mobile devices for the Analytics page, keeping only "Export Excel" visible on smaller screens.

---

### Technical Change

#### File: `src/pages/Analytics.tsx`

**Line 966-969** - Add responsive class to hide button on mobile:

```tsx
// Before
<Button variant="outline" size="sm" onClick={handleExportCSV}>
  <Download className="h-4 w-4 mr-2" />
  Export CSV
</Button>

// After
<Button variant="outline" size="sm" onClick={handleExportCSV} className="hidden md:flex">
  <Download className="h-4 w-4 mr-2" />
  Export CSV
</Button>
```

---

### How It Works

- `hidden` - Hides the button by default (mobile)
- `md:flex` - Shows the button with flex display on screens 768px and wider (desktop/tablet)

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Analytics.tsx` | Add `hidden md:flex` class to Export CSV button |


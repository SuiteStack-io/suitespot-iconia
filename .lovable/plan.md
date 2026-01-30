

## Plan: Make Date Range and Filters Header Sticky

### Summary

Move the date range controls (Week/Month/Quarter/YTD tabs, calendar picker, and quick month buttons) into the sticky header section so they remain visible when scrolling.

---

### Current Structure

```
<header> - sticky (breadcrumb, title, export buttons)
<main>
  └─ Date range controls (tabs, calendar, month buttons) - scrolls away
  └─ Analytics cards and tables
```

### Target Structure

```
<header> - sticky (breadcrumb, title, export buttons, date controls)
  └─ Date range controls (tabs, calendar, month buttons)
<main>
  └─ Analytics cards and tables
```

---

### Technical Change

#### File: `src/pages/Analytics.tsx`

**Lines 930-1056** - Move the date filter section inside the sticky header

Move the entire `<div className="space-y-2">` block containing:
- Time period tabs (Week/Month/Quarter/YTD)
- Calendar date picker with formatted date range
- Quick month filter buttons (December/January/February)

From inside `<main>` to inside the `<header>` section, after the title row.

**Code Structure After Change:**

```tsx
<header className="border-b bg-card sticky top-0 z-10">
  <div className="container mx-auto px-4 py-4">
    {/* Breadcrumb */}
    <AdminBreadcrumb section="ICONIA" currentPage="Revenue Analytics" />
    
    {/* Title row with export buttons */}
    <div className="flex items-center gap-4 mt-4 justify-between">
      {/* ... existing content ... */}
    </div>
    
    {/* Date range controls - NEW LOCATION */}
    <div className="space-y-2 pt-4 pb-2">
      {/* Time period tabs */}
      <div className="flex justify-center">
        <Tabs value={...}>...</Tabs>
      </div>
      
      {/* Calendar picker */}
      <div className="flex justify-center">
        <Popover>...</Popover>
      </div>
      
      {/* Quick month buttons */}
      <div className="flex justify-center gap-2">
        <Button>December</Button>
        <Button>January</Button>
        <Button>February</Button>
      </div>
    </div>
  </div>
</header>

<main className="container mx-auto px-4 py-8 space-y-8">
  {/* Cards and tables start immediately */}
  <div className="grid gap-4 md:grid-cols-4">
    ...
  </div>
</main>
```

---

### Visual Result

When scrolling down the Analytics page:
- The header with breadcrumb, title, and export buttons stays fixed at top
- The date range tabs (Week/Month/Quarter/YTD) stay fixed below the title
- The calendar picker and quick month buttons also stay visible
- Only the metric cards and data tables scroll

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Analytics.tsx` | Move date filter block from `<main>` into `<header>` |


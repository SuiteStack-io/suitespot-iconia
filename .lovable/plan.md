

## Plan: Mobile 2-Column Grid Layout for Analytics Cards

### Summary

Update the Analytics page metric cards to display in a 2-column grid on mobile (like the admin home page), allowing users to scroll through data faster. This applies Dashboard-style responsive design patterns to the Analytics cards.

---

### Reference Pattern

The Dashboard uses this pattern at line 790:
```tsx
<div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
```

With compact card styling:
- `p-3 sm:p-6` for responsive padding
- `text-xs sm:text-sm` for responsive text sizes
- `h-3 w-3 sm:h-4 sm:w-4` for responsive icon sizes

---

### Technical Changes

#### File: `src/pages/Analytics.tsx`

**Change 1: First card grid (lines 1060)**

Update from:
```tsx
<div className="grid gap-4 md:grid-cols-4">
```

To:
```tsx
<div className="grid gap-3 grid-cols-2 md:grid-cols-4">
```

Also update each card in this section to use compact mobile styling:
- Reduce `CardHeader` padding on mobile: `p-3 sm:p-6`
- Reduce `CardContent` padding: `p-3 pt-0 sm:p-6 sm:pt-0`
- Smaller text on mobile: `text-xl sm:text-2xl font-bold`

**Change 2: Second card grid (lines 1138)**

Update from:
```tsx
<div className="grid gap-4 md:grid-cols-3">
```

To:
```tsx
<div className="grid gap-3 grid-cols-2 md:grid-cols-3">
```

Apply same compact card styling pattern.

**Change 3: Third card grid (lines 1189)**

Update from:
```tsx
<div className="grid gap-4 md:grid-cols-3">
```

To:
```tsx
<div className="grid gap-3 grid-cols-2 md:grid-cols-3">
```

Apply same compact card styling pattern. For the revenue cards with detailed breakdowns, ensure the extra content still fits by using smaller text on mobile.

---

### Card Styling Pattern to Apply

For each card in all three grids:

```tsx
<Card className="cursor-pointer hover:shadow-lg transition-shadow">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
    <CardTitle className="text-xs sm:text-sm font-medium">Title</CardTitle>
    <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-color" />
  </CardHeader>
  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
    <div className="text-xl sm:text-2xl font-bold">Value</div>
    <p className="text-xs text-muted-foreground mt-1">Subtitle</p>
  </CardContent>
</Card>
```

---

### Visual Result

| Screen Size | Before | After |
|-------------|--------|-------|
| Mobile | 1 card per row (stacked) | 2 cards per row |
| Desktop | 4 cards first row, 3+3 second rows | Same |

This matches the admin home page layout and reduces vertical scrolling on mobile by ~50% for the metrics section.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Analytics.tsx` | Update 3 grid containers and ~10 cards with responsive mobile styling |


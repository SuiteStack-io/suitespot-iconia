

## Plan: Make Dialog Headers Sticky in Dashboard Cards

### Goal
When scrolling through reservation cards in the dashboard modals (Today's Departures, Today's Arrivals, In-House Now, etc.), keep the dialog title and close "X" button visible at the top of the modal.

---

### Technical Approach

The current dialog structure places `overflow-y-auto` on the entire `DialogContent`, which means the header scrolls away with the content. To fix this:

1. Restructure the dialog so the `DialogHeader` stays fixed
2. Move scrolling to only the content area
3. Add proper z-index and background to the sticky header

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Update DialogContent to use flex layout instead of overflow (line 830)**

From:
```tsx
<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
```

To:
```tsx
<DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
```

**2. Make DialogHeader sticky with proper styling (line 831)**

From:
```tsx
<DialogHeader>
```

To:
```tsx
<DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0">
```

**3. Make the content area scrollable (line 873)**

From:
```tsx
<div className="space-y-2">
```

To:
```tsx
<div className="space-y-2 overflow-y-auto flex-1 pt-4">
```

---

### Visual Result

| Scroll Position | Header Behavior |
|-----------------|-----------------|
| Top of modal | Header visible normally |
| Middle of list | Header stays fixed at top, content scrolls behind it |
| Bottom of list | Header still visible, close X accessible |

---

### Layout Structure After Changes

```text
+----------------------------------+
|  DialogContent (flex, no scroll) |
|  +----------------------------+  |
|  | DialogHeader (sticky, z-10)|  | <-- Stays fixed
|  | Title + Select All + Close |  |
|  +----------------------------+  |
|  | Content Area (scrollable)  |  | <-- Only this scrolls
|  | Room #417/418 card         |  |
|  | Room #503 card             |  |
|  | Room #511 card             |  |
|  | ...more cards...           |  |
|  +----------------------------+  |
+----------------------------------+
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Update dialog structure with sticky header and scrollable content area (3 line changes) |


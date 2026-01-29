

## Plan: Fix Cropped Close Button in Dashboard Dialogs

### Problem
The close "X" button appears cropped/hidden because:
1. The close button is absolutely positioned at `right-4 top-4` inside `DialogContent`
2. The sticky `DialogHeader` has `bg-background` which creates an opaque layer at the top
3. The sticky header's background is covering the close button

### Solution
Add padding-right to the `DialogHeader` to ensure the close button area remains clear, and ensure the sticky header doesn't visually conflict with the close button position.

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**Update DialogHeader to add right padding for the close button (line 831)**

From:
```tsx
<DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0">
```

To:
```tsx
<DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0 pr-8">
```

This adds 32px (pr-8) of right padding to the header content, ensuring the title and buttons don't extend into the close button's space.

---

### Why This Works

| Component | Position | Fix |
|-----------|----------|-----|
| Close button | Absolute at `right-4 top-4` (16px from right) | Unchanged |
| DialogHeader | Sticky with bg-background | Add `pr-8` (32px padding) to clear close button area |

The `pr-8` gives enough room for the close button (16px from edge + 16px button width = 32px = 8 × 4px).

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add `pr-8` to DialogHeader className on line 831 |


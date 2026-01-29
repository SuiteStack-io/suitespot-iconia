

## Plan: Adjust Select All Button Position for Close Button Visibility

### Goal
Move the "Select All" button and associated controls slightly to the left so the dialog's close "X" button is fully visible without overlap.

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**Update the button container to add right margin (line 835)**

From:
```tsx
<div className="flex items-center gap-2">
```

To:
```tsx
<div className="flex items-center gap-2 mr-6">
```

---

### Visual Result

| Before | After |
|--------|-------|
| Buttons crowding the close X | 24px (mr-6) gap between buttons and X |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add `mr-6` to the button container on line 835 |


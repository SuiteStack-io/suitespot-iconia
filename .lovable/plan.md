

## Plan: Reduce Mobile Padding on Reservations List Page

### Goal
Reduce the horizontal padding before and after the table on mobile to allow more display space.

---

### Technical Change

#### File: `src/pages/ReservationsListPage.tsx`

**Update page padding to be responsive (line 31)**

From:
```tsx
<div className="min-h-screen bg-background p-6">
```

To:
```tsx
<div className="min-h-screen bg-background p-2 md:p-6">
```

This changes padding from a fixed 24px (`p-6`) to:
- **Mobile**: 8px (`p-2`)
- **Desktop**: 24px (`md:p-6`)

---

### Expected Result

| Device | Before | After |
|--------|--------|-------|
| Mobile | 24px padding all sides | 8px padding all sides |
| Desktop | 24px padding all sides | 24px padding all sides (unchanged) |

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/ReservationsListPage.tsx` | Change `p-6` to `p-2 md:p-6` on line 31 |


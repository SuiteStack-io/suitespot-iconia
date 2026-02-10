

## Optimize In-House Now Dashboard Cards for Mobile

### Problem Summary

From the screenshot, two main issues need fixing:
1. The close (X) button on the dialog is small (16x16px), too close to the edge, and hard to tap on mobile
2. The reservation cards in the dialog render all at once, causing slow loading on mobile

---

### Fix 1: Close Button on Mobile

**File:** `src/components/ui/dialog.tsx`

The current close button (line 45) uses `right-4 top-4` positioning with a tiny `h-4 w-4` (16px) icon and no visible background. Changes:

- Increase icon size to `h-5 w-5` on mobile
- Add `min-w-[44px] min-h-[44px]` for Apple's recommended 44x44px tap target
- Add `flex items-center justify-center` for proper centering
- Add a visible background: `bg-muted/80 hover:bg-muted` with rounded corners
- Adjust positioning to `right-3 top-3` to ensure full visibility with adequate padding from screen edge

**Before:**
```tsx
<DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ...">
  <X className="h-4 w-4" />
</DialogPrimitive.Close>
```

**After:**
```tsx
<DialogPrimitive.Close className="absolute right-3 top-3 rounded-full opacity-70 ... min-w-[44px] min-h-[44px] flex items-center justify-center bg-muted/80 hover:bg-muted">
  <X className="h-5 w-5" />
</DialogPrimitive.Close>
```

---

### Fix 2: Dialog Header Spacing

**File:** `src/components/Dashboard.tsx`

The `DialogHeader` currently has `pr-8` which may not leave enough room for the larger close button. Update to `pr-14` to prevent the title from overlapping the new 44px close button.

---

### Fix 3: Card Loading Performance

**File:** `src/components/Dashboard.tsx`

Currently all reservation cards render at once in the dialog. For the In-House panel which can have many cards, this causes jank on mobile.

**Approach: Progressive rendering with a simple virtualization strategy**

- Show only the first 10 cards initially
- Add a "Show more" button or use IntersectionObserver to load more cards as the user scrolls
- This avoids adding a heavy virtualization library

**Implementation:**
1. Add a `visibleCount` state initialized to 10
2. Slice `dialogReservations` to only render `visibleCount` items
3. Add a sentinel div at the bottom with IntersectionObserver to auto-load 10 more
4. Reset `visibleCount` when dialog opens or card type changes

---

### Fix 4: Skeleton Loaders for Dialog

**File:** `src/components/Dashboard.tsx`

Add a loading state for when the dialog data is being fetched:

1. Add `dialogLoading` state (boolean)
2. Set it to `true` at the start of `handleCardClick`, `false` when data arrives
3. Show 3 skeleton card placeholders while loading

```tsx
{dialogLoading ? (
  Array.from({ length: 3 }).map((_, i) => (
    <Card key={i}>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-24" />
      </CardContent>
    </Card>
  ))
) : (
  // existing card rendering
)}
```

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/dialog.tsx` | Enlarge close button tap target, add visible background, adjust position |
| `src/components/Dashboard.tsx` | Add skeleton loaders, progressive card rendering, adjust header padding |

---

### Technical Notes

- The close button fix is in the shared `dialog.tsx` component, so it will improve all dialogs across the app -- this is intentional since the current button is too small for mobile everywhere
- Progressive rendering uses a simple state-based approach (no new dependencies) with IntersectionObserver for auto-loading
- Data fetching is already batched (single query per card click), so no query optimization needed
- The skeleton loader provides immediate visual feedback while the database query runs

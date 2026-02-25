

# Fix: Hamburger menu missing accessibility components

## Root Cause

The `SheetContent` in `SlideMenu.tsx` is missing the required `SheetTitle` and `SheetDescription` components. Radix UI's Dialog (which Sheet is built on) requires these for accessibility. Without them, the component throws errors and behaves unpredictably — in the preview environment, this manifests as opening a new tab instead of the slide-out panel.

The routing and auth setup (`ProtectedRoute` + `AdminRoute` wrapping both `/message-templates` and `/message-log`) are correct. This is not an auth issue — it is a UI component issue preventing the menu from opening at all.

## Fix

**File: `src/components/SlideMenu.tsx`**

1. Import `SheetTitle` and `SheetDescription` from `@/components/ui/sheet`
2. Add visually-hidden `SheetTitle` and `SheetDescription` inside `SheetContent` to satisfy Radix UI requirements
3. Add `type="button"` to the hamburger trigger `Button` to prevent default submit behavior

These are 3 small, targeted changes — no structural or logic changes.

### Change 1: Update imports (line 4-7)
```tsx
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
```

### Change 2: Add `type="button"` to trigger (line 178)
```tsx
<Button variant="ghost" size="icon" className="h-10 w-10" type="button">
```

### Change 3: Add hidden title/description inside SheetContent (after line 182)
```tsx
<SheetContent side="left" className="w-72 bg-[hsl(30,5%,20%)] border-[hsl(30,8%,30%)] p-0">
  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
  <SheetDescription className="sr-only">Admin navigation menu</SheetDescription>
  <div className="flex flex-col h-full py-6">
```


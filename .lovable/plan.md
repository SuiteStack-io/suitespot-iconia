

## Fix Mobile Dialog Close Button

### Problem

On mobile, the close (X) button on dashboard modals appears as empty brackets instead of a proper styled button matching the desktop version. The desktop version shows a rounded button with a visible background and clear X icon.

### Root Cause

The `DialogContent` component in `src/components/ui/dialog.tsx` has a close button with minimal styling (`rounded-sm p-1`) that doesn't render well on mobile -- the icon appears too small and lacks a visible background, making it look like broken brackets.

### Fix

**File: `src/components/ui/dialog.tsx` (line 43-46)**

Update the `DialogPrimitive.Close` button styling to:
- Add a visible background (`bg-muted`) so it's always visible, not just on hover
- Increase padding and use `rounded-full` for a circular button matching desktop
- Ensure a minimum 44x44px tap target for mobile accessibility
- Keep the same position (`absolute right-4 top-4`)

Change:
```
className="absolute right-4 top-4 z-10 rounded-sm p-1 text-muted-foreground/60 ..."
```

To:
```
className="absolute right-4 top-4 z-10 rounded-full p-2 bg-muted text-muted-foreground ..."
```

### Scope

- Single styling change in `src/components/ui/dialog.tsx`
- Affects all dialogs consistently (mobile and desktop)
- No behavioral changes, only visual fix

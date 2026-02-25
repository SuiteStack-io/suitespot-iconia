

## Fix: Message Log New Tab / 404 Bug

### Root Cause Analysis
After reviewing all relevant files, there is no explicit `window.open()` or `target="_blank"` in the code. The likely culprit is a subtle interaction between Radix UI's `SheetTrigger asChild` wrapping and the `Button onClick={() => navigate()}` pattern. When the Sheet is already open on the `/message-log` page and the user clicks the hamburger icon (which is itself a `SheetTrigger`), Radix may be propagating events incorrectly, causing the browser to interpret the click as a navigation to an undefined href.

### Fix Approach
Refactor the `SlideMenu` component to use controlled Sheet state with explicit `onOpenChange` and replace `SheetTrigger asChild` wrappers on menu items with direct button clicks that both navigate AND close the sheet. This eliminates the Radix trigger-within-trigger nesting that can cause event propagation issues.

### Changes

**File: `src/components/SlideMenu.tsx`**
1. Add `open` / `setOpen` state to control the Sheet explicitly
2. Replace `<Sheet>` with `<Sheet open={open} onOpenChange={setOpen}>`
3. Remove `SheetTrigger asChild` wrapper from every menu item button — instead, have each button's `onClick` call both `navigate(item.url)` and `setOpen(false)`
4. Remove `SheetTrigger asChild` from the "Admin" header link — same pattern: `onClick` navigates and closes
5. Keep only the single top-level `SheetTrigger` for the hamburger button

This is a targeted refactor of the existing pattern. No new files, no route changes, no other files affected.

### Technical Detail
```text
BEFORE (per menu item):
  <SheetTrigger asChild>
    <Button onClick={() => navigate(url)}>...</Button>
  </SheetTrigger>

AFTER (per menu item):
  <Button onClick={() => { navigate(url); setOpen(false); }}>...</Button>
```

The Radix `SheetTrigger` with `asChild` merges its click handler into the child. When nested inside `SheetContent`, this creates an implicit close-on-click behavior. But combined with `navigate()`, event timing can cause the browser to process a stale or bubbled event as a new navigation. Using explicit state control avoids this entirely.

### Files to Modify
| File | Change |
|------|--------|
| `src/components/SlideMenu.tsx` | Add controlled open state, remove SheetTrigger wrappers from menu items |

No other files need changes — the route, page component, and sidebar section config are all correct.


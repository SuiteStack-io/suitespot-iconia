
Goal: Stop the sidebar from opening `/auth?...` in a new tab when selecting menu items, and restore same-tab internal navigation behavior.

What I found from code inspection:
1. The route wiring is already correct for internal navigation (`/message-log` and other routes use router paths in `App.tsx`).
2. In `src/components/SlideMenu.tsx`, there is a critical variable shadowing bug:
   - Global sheet state setter: `const [open, setOpen] = useState(false);`
   - Inside `filteredSections.map(...)`, another `const setOpen = ...` is declared.
   - Menu item click uses `setOpen(false)` at line ~211, which now points to the inner variable (often `undefined`), not the sheet setter.
3. This can throw runtime errors during click handling and break normal event flow, which matches the “weird navigation/new-tab auth” behavior users are seeing.
4. The sidebar buttons also don’t explicitly set `type="button"`, which can cause accidental form submission behavior in some page layouts.

Implementation plan (targeted fix):
1. Refactor `src/components/SlideMenu.tsx` to remove setter shadowing:
   - Rename sheet state to explicit names: `isSheetOpen`, `setIsSheetOpen`.
   - Rename collapsible section setter to `setSectionOpen` (or similar) so it never conflicts.
2. Introduce one safe navigation helper in `SlideMenu`:
   - `handleMenuNavigation(url)` that:
     - prevents default and stops propagation,
     - calls `navigate(url)`,
     - closes sheet with `setIsSheetOpen(false)`.
   - Use it for every sidebar item and the “Admin” header button.
3. Make all sidebar clickable buttons explicit non-submit buttons:
   - Add `type="button"` to:
     - hamburger trigger button,
     - Admin header button,
     - all menu item buttons.
4. Keep routing unchanged:
   - No route-path changes needed unless we detect mismatch during verification.
   - Current route declarations already look valid for internal routing.
5. Verify no lingering new-tab behavior:
   - Confirm there is no `window.open` / `target="_blank"` inside `SlideMenu` (already true).
   - Validate repeated open/close of the sheet does not trigger any navigation.

Files to update:
- `src/components/SlideMenu.tsx` (only)

Validation checklist after fix:
1. From `/rooms`, open hamburger → click each menu item:
   - navigates in the same tab,
   - no new tab opens,
   - no redirect to `/auth` unless session is truly invalid.
2. Repeat from `/message-log` and one PMS page to confirm consistency.
3. Open/close sidebar multiple times without clicking items:
   - no navigation is triggered.
4. Browser console:
   - no click-time exceptions (especially no “setOpen is not a function”).
5. Confirm other existing protections still work:
   - logged-out users are still redirected by normal protected-route flow.

Technical details:
```text
Root bug pattern in SlideMenu:
- outer: const [open, setOpen] = useState(false)
- inner map: const setOpen = section.label === 'ALMAZA BAY' ? setAlmazaBayOpen : undefined
- click: onClick={() => { navigate(item.url); setOpen(false); }}

For most sections, inner setOpen is undefined -> runtime error.
For ALMAZA, it toggles collapsible instead of closing sheet.
Both are incorrect and can cause unstable navigation behavior.
```



## Fix: Widen and Reorganize Edit Permissions Modal

### Changes

**File: `src/components/EditPermissionsDialog.tsx`**

1. **Increase modal size**: Change `sm:max-w-md` to `sm:max-w-[700px]` on the DialogContent. Keep `max-h-[85vh] overflow-y-auto`.

2. **Two-column grid for permissions**: Wrap the permission toggles (lines 278-297) in a `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2` container. Move the "Select All" toggle into the grid as the last item (or keep it as a full-width header row with `col-span-2`).

3. **Two-column grid for notifications**: The `NotificationSettingsSection` renders its toggles in a single column. Either:
   - Pass a `columns={2}` prop and apply `grid grid-cols-1 md:grid-cols-2 gap-x-6` inside that component, OR
   - Wrap the toggle list in that component with the same grid classes.

4. **Section headers with dividers**: Add explicit section labels — "Permissions", "Property Access", "Email Notifications" — as `<h3>` elements before each section, with the existing `<Separator />` between them.

5. **Sticky header/footer on mobile**: Add `md:sticky md:top-0` to DialogHeader isn't needed since the modal itself scrolls. For mobile full-screen, the existing `max-h-[85vh] overflow-y-auto` handles this. Optionally add `max-h-[100dvh] sm:max-h-[85vh]` and remove rounded corners on mobile.

### File 2: `src/components/NotificationSettingsSection.tsx`

Add a `twoColumn?: boolean` prop (or just apply grid classes unconditionally for md+ breakpoints) to the toggle list rendering section, wrapping the notification toggles in `grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2`.

### Summary
- 2 files modified
- Modal width: `max-w-md` → `max-w-[700px]`
- Permissions and notifications: single-column → two-column grid on desktop
- Section headers added for visual separation
- Mobile remains single-column with full-width modal


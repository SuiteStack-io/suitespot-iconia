

## Fix: Replace all hardcoded breadcrumb sections with dynamic property name

### Approach
Instead of editing 17+ page files individually, modify the `AdminBreadcrumb` component itself to automatically pull the active property name from context. This eliminates all hardcoding in one change.

### Changes

**File: `src/components/AdminBreadcrumb.tsx`**
1. Import `useProperty` from `@/lib/propertyContext`
2. Call `const { activeProperty } = useProperty()` inside the component
3. Replace the rendered `section` text: if `section` matches a known hardcoded value (`"ICONIA"`, `"Almaza Bay"`, `"System"`, `"PMS"`), substitute it with `activeProperty?.name || section` for property-specific sections (`"ICONIA"`, `"Almaza Bay"`), and keep `"PMS"` / `"System"` as-is since those are functional categories, not property names

**Specifically:**
- The breadcrumb will compute: if the passed `section` is not `"PMS"` and not `"System"`, use `activeProperty?.name || section` instead
- This means all 6 pages with `section="ICONIA"`, all 3 pages with `section="Almaza Bay"`, and `RoomRates.tsx` (already dynamic) will all automatically show the correct property name
- PMS and System sections remain unchanged since they're functional groupings, not property labels

### Also update the `sectionPath` auto-detection
Update the `getSectionPath` switch to handle dynamic property names instead of only matching `"ICONIA"` / `"Almaza Bay"` literally. Use `activeProperty?.id` or a fallback default path.


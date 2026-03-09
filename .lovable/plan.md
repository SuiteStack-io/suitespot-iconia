

## Overhaul Rooms Management — Grouped by Room Type with Collapsible Cards

### Overview
Replace the flat table with collapsible cards grouped by `booking_com_name`. Each card shows room-type-level info (size, beds, baths, guests) in the header, and a compact unit table inside with only unit-specific columns.

### Changes in `src/pages/Rooms.tsx` (full rewrite of the render section)

**1. Group units by room type**
- Add a `useMemo` that groups `units` by `booking_com_name || name` into a `Map<string, { units: Unit[], representative: Unit }>` structure
- The representative unit provides type-level data (size, beds, baths, max_guests, unit_type)

**2. Replace header** (lines 796–854)
- Cleaner header with summary stats: `{roomTypes.length} room types · {units.length} total units`
- Keep Bulk Edit and Add Room buttons
- Add Expand All / Collapse All ghost buttons

**3. Replace main content** (lines 856–1189)
- Delete the entire flat table
- Replace with collapsible `Card` components per room type using `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent`
- Each card header: room type name, description line (`50 sqm · 1 bed · 1 bath · 2 guests max`), badges for unit count and type
- Each card content: compact table with columns: #, Unit Name, Room #, View, Status, Photos, Actions
- Room type footer actions: Add Units (clone), Edit Type, Delete Type

**4. State for expand/collapse**
- `expandedTypes: Set<string>` state to track which room types are expanded
- `setAllExpanded(true/false)` toggles all

**5. StatusBadge inline component**
- Colored dot + text, reusing existing color logic (green/orange/red/blue/gray)

**6. Mobile responsive**
- On `md:hidden`, render unit cards instead of table rows with `MoreVertical` dropdown for actions

**7. Empty state**
- When no units exist, show centered empty state with icon and "Add Room" CTA

**8. Keep all existing functionality**
- All dialogs (Add Room, Clone, Delete, Photo Gallery) remain unchanged
- Edit/clone/delete handlers stay the same
- Bulk edit mode works within each expanded card's table
- Photo upload inline stays in the unit rows

### Files Modified
- `src/pages/Rooms.tsx`: Complete rewrite of the render/layout section (~lines 794–1189), add grouping logic, expand/collapse state, and mobile cards

### No database changes needed


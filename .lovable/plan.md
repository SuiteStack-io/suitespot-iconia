

## Modernize Rooms Table — Compact, Data-Dense Design

### Changes in `src/pages/Rooms.tsx`

**1. Table container** (lines 870-872): Add `rounded-lg border overflow-hidden` wrapper, keep sticky header with max-height scroll. Remove `min-w-[1800px]` — aim for no horizontal scroll.

**2. Table headers** (lines 873-919): Restyle all `<th>` elements:
- Use `text-xs font-medium uppercase tracking-wider` instead of current style
- Reduce padding to `px-3 py-2`
- Remove all `min-w-` constraints, use tighter widths
- Right-align numeric columns (Size, Beds, Baths, Max Guests)
- Add subtle `bg-muted/50` background for header row
- Keep sticky behavior and sort functionality

**3. Table rows** (line 927+): Add compact styling:
- `h-11 hover:bg-muted/50 even:bg-muted/20` on each `<TableRow>`
- Reduce all `<TableCell>` padding to `px-3 py-2`
- Remove `min-w-` constraints from cells
- Add `text-sm` to all data cells

**4. Room View column** (lines 974-1033): Replace the full dropdown menu with plain text display:
- Show `unit.view` as `text-sm text-muted-foreground` or `—` if empty
- Keep the dropdown only in edit mode
- Remove the inline Supabase update calls from the dropdown (editing happens via the edit row flow)

**5. Status column** (lines 1189-1213): Replace plain text with colored dot + text:
- Green dot for "available"
- Orange dot for "maintenance"  
- Red dot for "blocked"
- Gray dot for other statuses

**6. Actions column** (lines 1214-1258): Make icon buttons smaller:
- Use `h-7 w-7` icon buttons with `h-3.5 w-3.5` icons
- Tighter `gap-1` spacing

**7. Numeric columns** (Size, Beds, Baths, Max Guests): Right-align with `text-right tabular-nums`

**8. Photos column** (lines 1138-1187): Compact — show just count and small icon buttons instead of full upload UI inline

**9. Nr and sticky columns** (lines 928-958): Reduce padding, keep sticky behavior

### Files
- `src/pages/Rooms.tsx`: Restyle table headers, cells, rows, view column, status column, actions, and photos display




## Plan: Fix Reservations List Table Mobile UI

### Goal
1. Make the table properly scrollable horizontally on mobile
2. Reduce column spacing/padding for better visibility on mobile

---

### Technical Changes

#### File 1: `src/components/ui/table.tsx`

**Update TableHead and TableCell padding for mobile (lines 44-62)**

Reduce default padding on mobile, keep desktop padding:

```tsx
// TableHead - line 49
"h-12 px-2 md:px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"

// TableCell - line 60  
"p-2 md:p-4 align-middle [&:has([role=checkbox])]:pr-0"
```

---

#### File 2: `src/components/ReservationsList.tsx`

**1. Update sticky column widths for mobile (lines 1072-1096, 1211-1250)**

Make the sticky columns narrower on mobile using responsive classes:

**Header cells:**
```tsx
// Checkbox column
className="w-[40px] md:w-[50px] min-w-[40px] md:min-w-[50px] max-w-[40px] md:max-w-[50px] sticky left-0 z-20 bg-background"

// Room Name column  
className="w-[100px] md:w-[180px] min-w-[100px] md:min-w-[180px] max-w-[100px] md:max-w-[180px] cursor-pointer hover:bg-muted/50 sticky left-[40px] md:left-[50px] z-20 bg-background"

// Room # column
className="w-[50px] md:w-[80px] min-w-[50px] md:min-w-[80px] max-w-[50px] md:max-w-[80px] sticky left-[140px] md:left-[230px] z-20 bg-background"

// Guest Names column - NOT sticky on mobile
className="w-[120px] md:w-[180px] min-w-[120px] md:min-w-[180px] max-w-[120px] md:max-w-[180px] cursor-pointer hover:bg-muted/50 md:sticky md:left-[310px] z-20 bg-background"
```

**Body cells with same responsive widths and left positions**

**2. Add truncation for text overflow on mobile**

Add `truncate` class to cells with long text content to prevent wrapping:
```tsx
<div className="flex items-center gap-2 truncate">
  {reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}
```

---

### Expected Result

**Before (mobile):**
- Columns too wide, can't see full table
- Hard to scroll horizontally

**After (mobile):**
- Checkbox: 40px (was 50px)
- Room Name: 100px (was 180px) 
- Room #: 50px (was 80px)
- Guest Names: 120px, not sticky (was 180px sticky)
- Cell padding: 8px (was 16px)
- Table scrolls smoothly right

**Desktop unchanged** - full column widths and sticky behavior preserved

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/ui/table.tsx` | Reduce padding on mobile with `px-2 md:px-4` and `p-2 md:p-4` |
| `src/components/ReservationsList.tsx` | Responsive column widths, remove Guest Names sticky on mobile, add truncation |


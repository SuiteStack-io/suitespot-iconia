

## Fix Total Row Alignment in Unpaid Commissions Table

### Root Cause

The Total row has **one extra empty cell** between the "Total" label and the Net Revenue value, shifting the totals one column to the right. Additionally, some empty cells have incorrect responsive visibility classes that don't match their corresponding header columns.

### Column Map (15 columns)

| # | Column | Visibility |
|---|--------|------------|
| 1 | Checkbox | always |
| 2 | Team Member | always |
| 3 | Booking Ref | always |
| 4 | Suite | hidden md:table-cell |
| 5 | Room # | always |
| 6 | Price/Night | always |
| 7 | Nights | always |
| 8 | Guest | hidden md:table-cell |
| 9 | Status | hidden md:table-cell |
| 10 | Check-in | hidden lg:table-cell |
| 11 | Check-out | hidden lg:table-cell |
| 12 | Net Revenue | always |
| 13 | VAT (14%) | hidden lg:table-cell |
| 14 | Commission | always |
| 15 | Action | always |

### Current Bug (lines 722-742)

After `colSpan={5}` covering cols 2-6, the code has **6 empty cells** (lines 726-731) for cols 7-11, which only need **5 cells**. Additionally:
- Col 8 (Guest, `hidden md`) is missing the `hidden md:table-cell` class
- Col 10 (Check-in, `hidden lg`) has `hidden md:table-cell` instead of `hidden lg:table-cell`

### Fix

**File: `src/pages/Commissions.tsx`** (lines 722-742)

Replace the `TableFooter` total row so each cell matches its column exactly:
- Remove the extra empty cell
- Fix visibility classes: col 8 gets `hidden md:table-cell`, col 10 gets `hidden lg:table-cell`
- Add `bg-muted/50` background to the footer row for visual separation
- Keep all totals bold, commission in `text-amber-600`

The corrected cells after `colSpan={5}`:

```
col 7  (Nights):    <TableCell></TableCell>
col 8  (Guest):     <TableCell className="hidden md:table-cell"></TableCell>
col 9  (Status):    <TableCell className="hidden md:table-cell"></TableCell>
col 10 (Check-in):  <TableCell className="hidden lg:table-cell"></TableCell>
col 11 (Check-out): <TableCell className="hidden lg:table-cell"></TableCell>
col 12 (Net Rev):   value cell
col 13 (VAT):       value cell (hidden lg)
col 14 (Commission): value cell
col 15 (Action):    empty cell
```

This removes the extra cell and corrects the visibility classes, aligning all three total values with their column headers.


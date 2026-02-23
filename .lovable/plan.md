

## Fix Total Row Alignment in Paid Commissions Table

### Root Cause

Same bug as the unpaid table: the paid commissions footer has **one extra empty cell** between the "Total" label and the Net Revenue value, shifting totals one column to the right.

### Column Map (15 columns, no checkbox)

| # | Column | Visibility |
|---|--------|------------|
| 1 | Team Member | always |
| 2 | Booking Ref | always |
| 3 | Suite | hidden md:table-cell |
| 4 | Room # | always |
| 5 | Price/Night | always |
| 6 | Nights | always |
| 7 | Guest | hidden md:table-cell |
| 8 | Status | hidden md:table-cell |
| 9 | Check-in | hidden lg:table-cell |
| 10 | Check-out | hidden lg:table-cell |
| 11 | Net Revenue | always |
| 12 | VAT (14%) | hidden lg:table-cell |
| 13 | Commission | always |
| 14 | Paid On | hidden md:table-cell |
| 15 | Action | always |

### Current Bug (lines 868-874)

After `colSpan={5}` covering cols 1-5, the code has **6 empty cells** (lines 869-874) for cols 6-11, but only **5 are needed**. The visibility classes on those 5 cells are already correct.

### Fix

**File: `src/pages/Commissions.tsx`** (line 870)

Remove the extra empty `<TableCell></TableCell>` at line 870. This single deletion aligns all three total values with their column headers.


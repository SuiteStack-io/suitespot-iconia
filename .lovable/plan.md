

## Plan: Add Revenue Percentage Column to Revenue by Nationality Table

### Summary

Add a new **"% Revenue"** column after **Total Nights** that displays what percentage of the total revenue each nationality contributes.

---

### Technical Changes

#### File: `src/components/RevenueByNationality.tsx`

**1. Update the interface** (line 9-16)

Add `revenuePercentage` field to `NationalityRevenue`:

```typescript
interface NationalityRevenue {
  nationality: string;
  totalNights: number;
  revenuePercentage: number;  // NEW
  avgPricePerNight: number;
  totalRevenue: number;
  source: string;
  payment: string;
}
```

**2. Update the SortField type** (line 18)

Add `revenuePercentage` as a sortable field:

```typescript
type SortField = 'nationality' | 'totalNights' | 'revenuePercentage' | 'avgPricePerNight' | 'totalRevenue' | 'source' | 'payment';
```

**3. Update the data processing** (lines 120-138)

Calculate total revenue across all nationalities first, then compute each nationality's percentage:

```typescript
// Calculate grand total revenue first
const grandTotalRevenue = Object.values(nationalityMap).reduce(
  (sum, data) => sum + data.totalRevenue, 0
);

// Convert to array with percentage
const revenues: NationalityRevenue[] = Object.entries(nationalityMap).map(([nationality, data]) => ({
  nationality,
  totalNights: data.totalNights,
  revenuePercentage: grandTotalRevenue > 0 ? (data.totalRevenue / grandTotalRevenue) * 100 : 0,
  avgPricePerNight: ...,
  totalRevenue: data.totalRevenue,
  source: ...,
  payment: ...,
}));
```

**4. Update the sortData function** (lines 141-158)

Add `revenuePercentage` to numeric sorting cases:

```typescript
case 'totalNights':
case 'revenuePercentage':  // NEW
case 'avgPricePerNight':
case 'totalRevenue':
  comparison = a[field] - b[field];
  break;
```

**5. Add table header column** (after Total Nights, line 199)

```tsx
<TableHead 
  className="text-right cursor-pointer hover:bg-muted/50"
  onClick={() => handleSort('revenuePercentage')}
>
  <div className="flex items-center justify-end">
    % Revenue
    {getSortIcon('revenuePercentage')}
  </div>
</TableHead>
```

**6. Add table body cell** (after Total Nights cell, line 249)

```tsx
<TableCell className="text-right">{item.revenuePercentage.toFixed(1)}%</TableCell>
```

**7. Update colSpan** (line 241)

Change from `colSpan={6}` to `colSpan={7}` for the empty state message.

---

### Result

| Nationality | Total Nights | % Revenue | Avg Price/Night | Total Revenue (ex. VAT) | Source | Payment |
|-------------|--------------|-----------|-----------------|-------------------------|--------|---------|
| Saudi Arabia | 106 | 48.5% | $126.41 | $11,973.25 | Booking.com | Unknown |
| United Arab Emirates | 25 | 10.5% | $111.65 | $2,601.76 | Booking.com | Cash |

The percentage column will show what proportion of total revenue each nationality contributes, sortable like other columns.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/components/RevenueByNationality.tsx` | Add percentage field, column header, and cell |


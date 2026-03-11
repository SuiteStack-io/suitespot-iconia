

## Fix Dashboard Summary Card Layout

### Problem
The card content uses `flex items-baseline justify-between` which places the subtitle text beside the number instead of below it. The "Recent Cancellations (24h)" title wraps due to length. No fixed min-height causes uneven card sizes.

### Changes

**File:** `src/components/Dashboard.tsx`

**1. Shorten "Recent Cancellations (24h)" title** (line 828):
Change to `"Cancellations (24h)"`

**2. Fix CardContent layout** (lines 861-871):
Replace the `flex items-baseline justify-between` wrapper with a stacked layout:

```tsx
<CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
  <div className="text-xl sm:text-2xl font-bold">
    {stat.isRevenue ? `$${stat.value.toFixed(2)}` : stat.value}
  </div>
  {stat.subtitle && (
    <p className="text-xs text-muted-foreground mt-1 truncate">
      {stat.subtitle}
    </p>
  )}
</CardContent>
```

**3. Add fixed min-height to Card** (line 852-854):
Add `min-h-[100px] sm:min-h-[120px]` to the Card className so all cards are equal height with content top-aligned.

Three small edits in one file. No data/logic changes.


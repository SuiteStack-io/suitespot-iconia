

## Plan: Inline Check-In/Check-Out Progress on Dashboard Cards

### Goal
1. Make Today's Arrivals card same height as other cards by moving "1/3 checked in" inline with the count
2. Add similar checkout progress to Today's Departures card

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Update DashboardStats interface (line 35-46)**

Add `departuresCheckedOut`:

```tsx
interface DashboardStats {
  todayArrivals: number;
  arrivalsCheckedIn: number;
  todayDepartures: number;
  departuresCheckedOut: number;  // NEW
  // ... rest unchanged
}
```

**2. Update initial state (line 94-105)**

Add default value:

```tsx
const [stats, setStats] = useState<DashboardStats>({
  todayArrivals: 0,
  arrivalsCheckedIn: 0,
  todayDepartures: 0,
  departuresCheckedOut: 0,  // NEW
  // ... rest unchanged
});
```

**3. Update departures query (lines 200-205)**

Add status to select:

```tsx
const { data: allDepartures } = await supabase
  .from('reservations')
  .select('id, group_id, status')  // Add status
  .eq('check_out_date', today)
  .neq('status', 'cancelled')
  .is('cancelled_at', null);
```

**4. Calculate checked-out count (after line 222)**

```tsx
// Count how many departures are already checked out
const departuresCheckedOut = filteredDepartures.filter(
  departure => departure.status === 'checked-out' || departure.status === 'completed'
).length;
```

**5. Update setStats (line 268-278)**

```tsx
setStats({
  todayArrivals: filteredArrivals.length,
  arrivalsCheckedIn,
  todayDepartures: filteredDepartures.length,
  departuresCheckedOut,  // NEW
  // ... rest unchanged
});
```

**6. Add subtitle to Departures card (lines 718-725)**

```tsx
{
  title: "Today's Departures",
  value: stats.todayDepartures,
  icon: LogOut,
  color: 'text-orange-600',
  isRevenue: false,
  type: 'departures',
  subtitle: stats.todayDepartures > 0 
    ? `${stats.departuresCheckedOut}/${stats.todayDepartures} checked out` 
    : undefined,
},
```

**7. Update CardContent to display subtitle inline (lines 776-784)**

Change from stacked layout to inline with flexbox:

```tsx
<CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
  <div className="flex items-baseline justify-between">
    <div className="text-xl sm:text-2xl font-bold">
      {stat.isRevenue ? `$${stat.value.toFixed(2)}` : stat.value}
    </div>
    {stat.subtitle && (
      <span className="text-xs text-muted-foreground">
        {stat.subtitle}
      </span>
    )}
  </div>
</CardContent>
```

---

### Expected Result

Cards will display progress inline:

```
┌────────────────────────────────────────┐
│ Today's Arrivals                    →] │
│                                        │
│ 3                        1/3 checked in│
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ Today's Departures                  ←] │
│                                        │
│ 2                      0/2 checked out │
└────────────────────────────────────────┘
```

- Count on left, progress on right (same line)
- Cards maintain consistent height
- Progress updates in real-time

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add `departuresCheckedOut` stat, update queries, display subtitles inline |


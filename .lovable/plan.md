

## Plan: Display Check-In Progress on Today's Arrivals Card

### Goal
Show how many of today's arrivals have checked in directly on the card (e.g., "1/3 checked in") without needing to click.

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Update DashboardStats interface (line 35-45)**

Add a new property to track arrivals that are checked in:

```tsx
interface DashboardStats {
  todayArrivals: number;
  arrivalsCheckedIn: number;  // NEW
  todayDepartures: number;
  // ... rest unchanged
}
```

**2. Update initial state (line 93-103)**

Add default value for the new stat:

```tsx
const [stats, setStats] = useState<DashboardStats>({
  todayArrivals: 0,
  arrivalsCheckedIn: 0,  // NEW
  todayDepartures: 0,
  // ... rest unchanged
});
```

**3. Update fetchStats query (lines 167-173)**

Modify the arrivals query to also fetch status:

```tsx
// Today's arrivals (with group_id and status for split-stay filtering)
const { data: allArrivals } = await supabase
  .from('reservations')
  .select('id, group_id, status')  // Add status
  .eq('check_in_date', today)
  .neq('status', 'cancelled')
  .is('cancelled_at', null);
```

**4. Calculate checked-in count (after line 190)**

After filtering arrivals, count how many are checked in:

```tsx
// Count how many arrivals are already checked in
const arrivalsCheckedIn = filteredArrivals.filter(
  arrival => arrival.status === 'checked-in'
).length;
```

**5. Update setStats (line 261-271)**

Include the new stat:

```tsx
setStats({
  todayArrivals: filteredArrivals.length,
  arrivalsCheckedIn,  // NEW
  todayDepartures: filteredDepartures.length,
  // ... rest unchanged
});
```

**6. Update statCards array to include subtitle (lines 698-706)**

Add a subtitle property to the arrivals card:

```tsx
{
  title: "Today's Arrivals",
  value: stats.todayArrivals,
  icon: LogIn,
  color: 'text-blue-600',
  isRevenue: false,
  type: 'arrivals',
  subtitle: stats.todayArrivals > 0 
    ? `${stats.arrivalsCheckedIn}/${stats.todayArrivals} checked in` 
    : undefined,
},
```

**7. Update Card rendering (lines 753-772)**

Add subtitle display to the card component:

```tsx
<CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
  <div className="text-xl sm:text-2xl font-bold">
    {stat.isRevenue ? `$${stat.value.toFixed(2)}` : stat.value}
  </div>
  {stat.subtitle && (
    <p className="text-xs text-muted-foreground mt-1">
      {stat.subtitle}
    </p>
  )}
</CardContent>
```

---

### Expected Result

The Today's Arrivals card will display:

```
┌─────────────────────────────────┐
│ Today's Arrivals           →]  │
│                                 │
│ 3                               │
│ 1/3 checked in                  │
└─────────────────────────────────┘
```

- Shows total arrivals count (3)
- Below it shows check-in progress (1/3 checked in)
- Updates in real-time as guests check in

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add `arrivalsCheckedIn` stat, update query, add subtitle to arrivals card |


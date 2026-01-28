

## Plan: Display Direct vs Booking.com Breakdown on New Bookings Card

### Goal
Show the split between Direct and Booking.com bookings on the "New Bookings (24h)" card with count and percentage, positioned on the right side inline with the value.

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Update DashboardStats interface (lines 35-47)**

Add properties for booking source breakdown:

```tsx
interface DashboardStats {
  todayArrivals: number;
  arrivalsCheckedIn: number;
  todayDepartures: number;
  departuresCheckedOut: number;
  inHouse: number;
  newBookings: number;
  newBookingsDirect: number;      // NEW
  newBookingsBookingCom: number;  // NEW
  recentCancellations: number;
  // ... rest unchanged
}
```

**2. Update initial state (lines 95-107)**

Add default values:

```tsx
const [stats, setStats] = useState<DashboardStats>({
  // ... existing
  newBookings: 0,
  newBookingsDirect: 0,      // NEW
  newBookingsBookingCom: 0,  // NEW
  // ... rest unchanged
});
```

**3. Update newBookings query (lines 240-244)**

Add channel to the select:

```tsx
// New bookings in last 24h
const { data: newBookings } = await supabase
  .from('reservations')
  .select('id, channel')  // Add channel
  .gte('created_at', yesterday)
  .is('cancelled_at', null);
```

**4. Calculate source breakdown (after line 244)**

```tsx
// Calculate booking source breakdown
const newBookingsBookingCom = (newBookings || []).filter(
  b => b.channel === 'Booking.com'
).length;
const newBookingsDirect = (newBookings?.length || 0) - newBookingsBookingCom;
```

**5. Update setStats (around line 281)**

Include the new stats:

```tsx
setStats({
  // ... existing
  newBookings: newBookings?.length || 0,
  newBookingsDirect,
  newBookingsBookingCom,
  // ... rest unchanged
});
```

**6. Add subtitle to New Bookings card (lines 746-752)**

```tsx
{
  title: 'New Bookings (24h)',
  value: stats.newBookings,
  icon: TrendingUp,
  color: 'text-purple-600',
  isRevenue: false,
  type: 'newbookings',
  subtitle: stats.newBookings > 0 
    ? `${stats.newBookingsDirect} Direct (${Math.round((stats.newBookingsDirect / stats.newBookings) * 100)}%) · ${stats.newBookingsBookingCom} B.com` 
    : undefined,
},
```

---

### Expected Result

```
┌──────────────────────────────────────────────────────────────┐
│ New Bookings (24h)                                        ↗] │
│                                                              │
│ 5                              3 Direct (60%) · 2 B.com      │
└──────────────────────────────────────────────────────────────┘
```

- Total count on left
- Breakdown with percentages on right
- Same inline layout as arrivals/departures cards
- Updates in real-time with new bookings

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Add booking source stats, update query to include channel, display breakdown subtitle |


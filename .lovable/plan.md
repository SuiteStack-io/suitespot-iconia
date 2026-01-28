
## Plan: Change Recent Cancellations from 7 Days to 24 Hours

### Overview
Update the "Recent Cancellations" card to show cancellations from the last 24 hours instead of the last 7 days, matching the behavior of the "New Bookings (24h)" card.

---

### Current Behavior
- Card title: "Recent Cancellations"
- Modal title: "Recent Cancellations (Last 7 Days)"
- Query filter: `cancelled_at >= sevenDaysAgo`

### Desired Behavior
- Card title: "Recent Cancellations (24h)"
- Modal title: "Recent Cancellations (Last 24h)"
- Query filter: `cancelled_at >= yesterday`

---

### Technical Changes

#### File: `src/components/Dashboard.tsx`

**1. Update fetchStats query (lines 232-237)**

Change from:
```typescript
// Recent cancellations (last 7 days)
const { data: cancellations } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .eq('status', 'cancelled')
  .gte('cancelled_at', sevenDaysAgo);
```

To:
```typescript
// Recent cancellations (last 24h)
const { data: cancellations } = await supabase
  .from('reservations')
  .select('id', { count: 'exact' })
  .eq('status', 'cancelled')
  .gte('cancelled_at', yesterday);
```

**2. Update handleCardClick case (lines 419-422)**

Change from:
```typescript
case 'cancellations':
  setDialogTitle('Recent Cancellations (Last 7 Days)');
  query = query.eq('status', 'cancelled').gte('cancelled_at', sevenDaysAgo);
  break;
```

To:
```typescript
case 'cancellations':
  setDialogTitle('Recent Cancellations (Last 24h)');
  query = query.eq('status', 'cancelled').gte('cancelled_at', yesterday);
  break;
```

**3. Update stat card title (line 732)**

Change from:
```typescript
{
  title: 'Recent Cancellations',
  ...
}
```

To:
```typescript
{
  title: 'Recent Cancellations (24h)',
  ...
}
```

---

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/components/Dashboard.tsx` | 232-237 | Change query from `sevenDaysAgo` to `yesterday` |
| `src/components/Dashboard.tsx` | 419-422 | Update modal title and query filter |
| `src/components/Dashboard.tsx` | 732 | Update card title to include "(24h)" |

---

### Expected Result
- Dashboard card will show "Recent Cancellations (24h)" with count of cancellations in last 24 hours
- Clicking the card opens a modal with title "Recent Cancellations (Last 24h)"
- Only cancellations from the last 24 hours will be displayed, matching the "New Bookings" card behavior

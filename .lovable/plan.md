

## Plan: Update New Bookings Subtitle Format

### Goal
Change "B.com" to "Booking.com" and add percentage for Booking.com count.

---

### Technical Change

#### File: `src/components/Dashboard.tsx`

**Update subtitle in New Bookings card (line 762-764)**

From:
```tsx
subtitle: stats.newBookings > 0 
  ? `${stats.newBookingsDirect} Direct (${Math.round((stats.newBookingsDirect / stats.newBookings) * 100)}%) · ${stats.newBookingsBookingCom} B.com` 
  : undefined,
```

To:
```tsx
subtitle: stats.newBookings > 0 
  ? `${stats.newBookingsDirect} Direct (${Math.round((stats.newBookingsDirect / stats.newBookings) * 100)}%) · ${stats.newBookingsBookingCom} Booking.com (${Math.round((stats.newBookingsBookingCom / stats.newBookings) * 100)}%)` 
  : undefined,
```

---

### Expected Result

```
┌──────────────────────────────────────────────────────────────────────────┐
│ New Bookings (24h)                                                    ↗] │
│                                                                          │
│ 5                    3 Direct (60%) · 2 Booking.com (40%)                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/Dashboard.tsx` | Update subtitle format on line 762-764 |


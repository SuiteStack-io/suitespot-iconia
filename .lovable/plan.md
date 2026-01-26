

## Plan: Update Reservation Email Subject Line Format

### Overview
Modify the internal team notification email subject line to show check-in/check-out dates instead of the suite/room type name.

---

### Current vs New Format

| Current Subject | New Subject |
|-----------------|-------------|
| New Reservation: Safiyah Alotaibi - One Bedroom Suite with Balcony - Room #504 | New Reservation: Safiyah Alotaibi - Feb 4 to Feb 9 - Room #504 |

---

### Visual Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  CURRENT EMAIL SUBJECT:                                                      │
│  ──────────────────────                                                      │
│  New Reservation: Safiyah Alotaibi - One Bedroom Suite with Balcony         │
│                                       - Room #504                            │
│                                                                              │
│  ↓ CHANGE TO ↓                                                              │
│                                                                              │
│  NEW EMAIL SUBJECT:                                                          │
│  ─────────────────                                                           │
│  New Reservation: Safiyah Alotaibi - Feb 4 to Feb 9 - Room #504             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Technical Changes

#### File: `supabase/functions/send-reservation-notification/index.ts`

**1. Add short date formatting (before the subject line logic, around line 136)**

Create short date format strings for the subject line:

```typescript
// Format short dates for subject line (e.g., "Feb 4")
const checkInShort = new Date(checkIn).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
});
const checkOutShort = new Date(checkOut).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
});
```

**2. Update subject line logic (lines 484-496)**

Replace the suite name with dates in the subject:

```typescript
// Build subject line with dates and room number
let subject = `New Reservation: ${guestNames.join(", ")}`;
if (isSplitStay && splitStaySegments && splitStaySegments.length > 1) {
  subject = `Split-Stay Reservation: ${guestNames.join(", ")} - ${checkInShort} to ${checkOutShort} - ${splitStaySegments.length} Rooms`;
} else if (isMultiRoom && rooms && rooms.length > 1) {
  subject = `New Multi-Room Reservation: ${guestNames.join(", ")} - ${checkInShort} to ${checkOutShort} - ${rooms.length} Rooms`;
} else if (matchedRoomNumber) {
  subject += ` - ${checkInShort} to ${checkOutShort} - Room #${matchedRoomNumber}`;
} else {
  subject += ` - ${checkInShort} to ${checkOutShort}`;
}
```

---

### Expected Results

| Scenario | Subject Line |
|----------|--------------|
| Standard reservation | `New Reservation: Safiyah Alotaibi - Feb 4 to Feb 9 - Room #504` |
| Multi-room booking | `New Multi-Room Reservation: John Doe - Jan 15 to Jan 20 - 2 Rooms` |
| Split-stay booking | `Split-Stay Reservation: Jane Smith - Feb 1 to Feb 10 - 3 Rooms` |
| No room assigned yet | `New Reservation: Guest Name - Mar 5 to Mar 8` |

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/send-reservation-notification/index.ts` | Add short date formatting, update subject line to use dates instead of suite name |


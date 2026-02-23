

## Upgrade Auto-Shuffle Email to Match Room Change Email Design

### Problem

The auto-shuffle notification currently goes through the generic `send-admin-notification` edge function, which renders the shuffle metadata as raw JSON in a `<pre>` block (second screenshot). It should instead use a polished HTML email template matching the Room Change email design (first screenshot).

### Approach

Instead of using the generic `send-admin-notification`, the `auto-shuffle-rooms` edge function will send its own styled email directly via Resend — the same pattern used by `send-room-change-notification`.

### Design

The email will follow the Room Change email template structure with these sections:

1. **Header**: Amber/orange gradient with shuffle icon, title "Room Shuffle", subtitle "Rooms were automatically rearranged to accommodate a new booking"
2. **Booking Reference**: The new booking reference that triggered the shuffle in a highlighted box
3. **Triggering Booking Info**: Guest name, check-in, check-out, duration, room type, booking source
4. **Moves Section**: For each move in the chain, a card showing:
   - Previous Room (name + number) with arrow to New Room (name + number)
   - Guest name and dates for that move
5. **Footer**: "All moves were within the same room type (Deluxe Suite)" notice, then standard SuiteSpot footer

Subject: `Room Shuffle Alert - [Guest Name] ([Booking Reference])`
Sender: `reservations@bookings.suitespoteg.com`

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/auto-shuffle-rooms/index.ts` | Replace the `send-admin-notification` call (lines 306-328) with direct Resend email sending using a styled HTML template matching the Room Change email design. Import Resend, fetch admin emails (same pattern as `send-room-change-notification`), and send the polished email. |

### Technical Details

The notification section (lines 305-328) in `auto-shuffle-rooms/index.ts` will be replaced with:

1. Add `Resend` import at the top (already imported in `send-room-change-notification`)
2. Fetch admin/front_desk user emails using the same pattern as `send-room-change-notification` (query `user_roles`, `profiles`, `auth.admin.listUsers()`)
3. Build a styled HTML email with:
   - Same CSS structure as the Room Change email (inline styles, table-based layout)
   - Amber gradient header with shuffle icon
   - Booking reference card
   - Each move rendered as a "Previous Room -> New Room" visual card (same style as the room change card)
   - Guest details, dates, room type info
   - "All moves within same room type" notice
4. Send via Resend with 600ms delay between emails for rate limiting


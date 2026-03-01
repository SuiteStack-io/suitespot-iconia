

## Update cancellation email subject to match reservation email format

### Change
In `supabase/functions/send-cancellation-notification/index.ts`, update the subject line from:

```
Cancelled Booking - Gail Robinson (5455363149)
```

To match the new reservation format:

```
Cancelled Booking - Gail Robinson - Mar 5 to Mar 10 - Room #504
```

### Implementation
**File:** `supabase/functions/send-cancellation-notification/index.ts`

1. Add short date formatting (same as reservation notification uses):
   ```typescript
   const checkInShort = new Date(check_in_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
   const checkOutShort = new Date(check_out_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
   ```

2. Update the subject line (line 299) to:
   ```typescript
   subject: `Cancelled Booking - ${guest_names?.[0] || "Guest"} - ${checkInShort} to ${checkOutShort}${unit_number ? ` - Room #${unit_number}` : ''}`,
   ```

Single file change, no database modifications needed.




## Fix: Sequential Email Sending with Rate Limiting for Check-In/Check-Out Notifications

### Problem Identified

Both `send-checkin-notification` and `send-checkout-notification` edge functions use `Promise.all()` to send emails in parallel. This can cause:
1. **Rate limiting issues** - Resend may throttle or fail requests when too many are sent simultaneously
2. **Missing emails** - Some recipients may not receive emails due to rate limits being exceeded
3. **Insufficient logging** - Current logging doesn't capture the full Resend API response including error details

The `send-room-change-notification` function already implements the correct pattern with sequential sending and 600ms delays.

---

### Solution

Update both functions to match the pattern from `send-room-change-notification`:
- Send emails **sequentially** using a `for...of` loop instead of `Promise.all()`
- Add **600ms delay** between each email for Resend rate limiting
- Log **full Resend API response** including `result.data?.id` and `result.error`
- Track success/failure counts properly

---

### Technical Changes

**File: `supabase/functions/send-checkin-notification/index.ts`**

Replace the parallel email sending (lines 110-184) with sequential sending:

```typescript
// Current (parallel - causes rate limiting):
const emailPromises = admins.map(async (admin: any) => {
  try {
    const emailResponse = await resend.emails.send({...});
    console.log(`Email sent to ${admin.email}:`, emailResponse);
    return { success: true, email: admin.email };
  } catch (error) {
    console.error(`Failed to send email to ${admin.email}:`, error);
    return { success: false, email: admin.email, error };
  }
});
const results = await Promise.all(emailPromises);

// New (sequential with delays and detailed logging):
const results: Array<{success: boolean; email: string; id?: string; error?: any}> = [];
let successCount = 0;
let failedCount = 0;

for (const admin of admins) {
  try {
    console.log(`Attempting to send check-in email to: ${admin.email}`);
    
    const result = await resend.emails.send({...});
    
    console.log(`Email result for ${admin.email}:`, JSON.stringify(result));
    
    if (result.error) {
      console.error(`Resend error for ${admin.email}:`, JSON.stringify(result.error));
      results.push({ success: false, email: admin.email, error: result.error });
      failedCount++;
    } else {
      console.log(`Email sent successfully to ${admin.email}, ID: ${result.data?.id}`);
      results.push({ success: true, email: admin.email, id: result.data?.id });
      successCount++;
    }
    
    // Add delay between emails (600ms) for rate limiting
    await new Promise(resolve => setTimeout(resolve, 600));
  } catch (error: any) {
    console.error(`Exception sending email to ${admin.email}:`, error.message || error);
    results.push({ success: false, email: admin.email, error: error.message });
    failedCount++;
  }
}
```

---

**File: `supabase/functions/send-checkout-notification/index.ts`**

Apply the same pattern - replace parallel sending (lines 135-214) with sequential:

```typescript
// Replace Promise.all pattern with sequential for loop
const results: Array<{success: boolean; email: string; id?: string; error?: any}> = [];
let successCount = 0;
let failedCount = 0;

for (const staff of allRecipients) {
  try {
    console.log(`Attempting to send check-out email to: ${staff.email}`);
    
    const result = await resend.emails.send({...});
    
    console.log(`Email result for ${staff.email}:`, JSON.stringify(result));
    
    if (result.error) {
      console.error(`Resend error for ${staff.email}:`, JSON.stringify(result.error));
      results.push({ success: false, email: staff.email, error: result.error });
      failedCount++;
    } else {
      console.log(`Email sent successfully to ${staff.email}, ID: ${result.data?.id}`);
      results.push({ success: true, email: staff.email, id: result.data?.id });
      successCount++;
    }
    
    // Add delay between emails (600ms) for rate limiting
    await new Promise(resolve => setTimeout(resolve, 600));
  } catch (error: any) {
    console.error(`Exception sending email to ${staff.email}:`, error.message || error);
    results.push({ success: false, email: staff.email, error: error.message });
    failedCount++;
  }
}
```

---

### Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Email sending | Parallel (`Promise.all`) | Sequential (`for...of` loop) |
| Rate limiting | None | 600ms delay between emails |
| Resend response logging | Basic | Full JSON response with ID and error |
| Error tracking | Combined in results | Separate success/failed counters with detailed logs |

---

### Files to Modify

| File | Action |
|------|--------|
| `supabase/functions/send-checkin-notification/index.ts` | Rewrite email sending to be sequential with delays |
| `supabase/functions/send-checkout-notification/index.ts` | Rewrite email sending to be sequential with delays |


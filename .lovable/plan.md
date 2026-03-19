

## Add Personalized Greeting to All Summary Emails

### Summary
Add a personalized greeting ("Hi [First Name], here's your [daily/weekly/monthly] summary...") right after the header in all three summary emails. Each recipient gets their own personalized email with their first name extracted from their profile.

### Approach
All three functions currently build one `emailHTML` string and send it identically to all recipients. The fix: split the email HTML into a "before greeting" (header) and "after greeting" (body content) portion, then in the send loop, construct the full HTML per recipient with their personalized greeting injected between the two.

### Helper Function (added to each file)
```typescript
function getFirstName(fullName: string): string {
  if (!fullName || fullName === "Team Member") return "there";
  return fullName.split(" ")[0];
}
```

### Changes per file

**1. `generate-daily-summary/index.ts`**
- Add `getFirstName` helper
- In `generateEmailHTML`, split the return so the greeting can be injected — or simpler: move the email HTML construction into the send loop, or build a function that accepts `firstName`
- Greeting text: `"Hi {firstName}, here's your daily summary for {propertyName} — {date}."`
- In the send loop, construct per-recipient HTML by inserting the greeting `<p>` right after the header `</div>` and before the first `<h2>`

**2. `generate-weekly-summary/index.ts`**
- Add `getFirstName` helper
- The email HTML is already built inline. Split it into `headerHTML` and `bodyHTML`, then in the send loop combine with greeting
- Greeting text: `"Hi {firstName}, here's your weekly summary for {propertyName} from Thursday, {startDate} to Wednesday, {endDate}."`

**3. `generate-monthly-summary/index.ts`**
- Add `getFirstName` helper
- Same split approach as weekly
- Greeting text: `"Hi {firstName}, here's your monthly summary for {propertyName} — {monthName}."`

### Greeting HTML Style
```html
<p style="font-size:15px;color:#333;margin:0 0 20px;line-height:1.5;">
  Hi Youssef, here's your weekly summary for ICONIA Zamalek from Thursday, Mar 12 to Wednesday, Mar 18, 2026.
</p>
```
Placed inside the white body `<div>`, before the first `<h2>` section.

### Implementation Detail
For each function, the simplest approach is to build the email body HTML without the greeting, then in the send loop, inject the greeting at the start of the body content. Concretely:
- Build `emailBodyContent` (everything inside the white `<div>` — sections, tables, footer)
- In the send loop, construct: `header + <div body>greeting + emailBodyContent</div>`

### No other changes
- No changes to recipient logic, header design, or any other sections
- No database changes needed


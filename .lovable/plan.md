

## Add UTC + Expanded Timezone List

### Files
- `src/components/settings/PropertyForm.tsx`
- `src/components/channex/PropertySettings.tsx`

### Change
Replace the existing `TIMEZONES` array in both files with the expanded list, in this exact order:

```ts
const TIMEZONES = [
  'UTC',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
];
```

UTC appears first so operators can select it from the dropdown. Default timezone for new properties remains `UTC` (unchanged). No other logic, validation, save behavior, or settings are touched.

### Verification
1. Edit Property → Step 3 → Timezone dropdown shows `UTC` as the first option followed by the expanded list.
2. Channex Property Settings → Timezone dropdown shows the same expanded list.
3. Selecting `UTC` (or any new entry) saves correctly and Dashboard timestamps render in the chosen zone.




## Move "View Calendar for Rate Plan" Dropdown Inside Tabs

### Problem
The rate plan dropdown sits above the tab bar and is always visible, but it's only contextually relevant per tab.

### Solution
Remove the top-level dropdown (lines 212-228) and add rate plan selectors inside each tab that needs one:

**`src/pages/pms/Restrictions.tsx`**

1. **Delete** the top-level dropdown block (lines 212-228)

2. **Settings tab**: Add a rate plan selector at the top of the settings tab content (before the Card). This tab needs it to choose which plan to configure. Label: "Select Rate Plan"

3. **Calendar tab**: Add the same dropdown inside the calendar tab content, before `RestrictionCalendarView`. Label: "Select Rate Plan"

4. **Bulk Editor tab**: No dropdown needed (it has its own Room Type / Rate Plan selectors)

The `selectedPlanId` state continues to drive both the Settings and Calendar tabs, so selecting a plan in one tab carries over when switching to the other.

### Layout After

```text
[Rate Plan Settings]  [Restrictions Calendar]  [Bulk Editor]
─────────────────────────────────────────────────────────────
(Settings tab active:)
  Select Rate Plan
  [Bed & Breakfast Rate (Twin Room) ▼]
  
  [Rate Plan Configuration card...]

(Calendar tab active:)
  Select Rate Plan
  [Bed & Breakfast Rate (Twin Room) ▼]
  
  [Calendar grid...]

(Bulk Editor tab active:)
  [Room Type ▼]  [Rate Plan ▼]   ← self-contained
  ...
```

### Single file edit, no database changes


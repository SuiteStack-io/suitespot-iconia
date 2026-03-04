

## Remove "Select Rate Plan" Dropdown from Restrictions Calendar Tab

### Change
Delete the dropdown block (lines 313-328) from the Calendar tab content in `src/pages/pms/Restrictions.tsx`, leaving only the `RestrictionCalendarView` component.

### File: `src/pages/pms/Restrictions.tsx`

**Before (lines 312-330):**
```tsx
<TabsContent value="calendar">
  <div className="mb-4 space-y-2">
    <label className="block text-sm font-medium">Select Rate Plan</label>
    <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
      ...
    </Select>
  </div>
  <RestrictionCalendarView key={calendarKey} ratePlans={ratePlans} />
</TabsContent>
```

**After:**
```tsx
<TabsContent value="calendar">
  <RestrictionCalendarView key={calendarKey} ratePlans={ratePlans} />
</TabsContent>
```

Single deletion, no other changes needed.




## Add "Pricing Rules" Tab to PMS/Prices Page

### What's changing
Add a third tab "Pricing Rules" next to "Rate Plans" and "Price Lab" on the PMS/Prices page. This tab will contain the Weekend Days / Off-Peak Days configuration UI (currently only in PropertyForm.tsx), allowing users to manage pricing rules directly from where they manage rates.

### Approach
1. **Extract Pricing Rules into a standalone component** (`src/components/pms/PricingRulesEditor.tsx`) that:
   - Reads `weekend_days` and `off_peak_days` from the active property
   - Shows the same UI as PropertyForm's Pricing Rules section (region presets dropdown, day toggle buttons)
   - Saves changes directly to the `properties` table via Supabase
   - Refreshes the property context after saving so other components (RatePlanDialog, QuickRateGrid) pick up the changes immediately

2. **Add the tab** in `Prices.tsx`:
   - New `TabsTrigger value="pricing-rules"` after "Price Lab"
   - New `TabsContent` rendering `<PricingRulesEditor />`

### Files

**New: `src/components/pms/PricingRulesEditor.tsx`**
- Self-contained component using `useProperty()` from propertyContext
- State: `weekendDays`, `offPeakDays`, `saving`
- Region presets dropdown (Middle East, Western, Custom)
- Day toggle buttons for weekend and off-peak (same styling as PropertyForm)
- Off-peak days disabled when already selected as weekend
- Save button that updates the `properties` table and calls `refreshProperties()`
- Toast feedback on save

**Edit: `src/pages/pms/Prices.tsx`**
- Import `PricingRulesEditor`
- Add third tab trigger and content

### No database changes needed
The `weekend_days` and `off_peak_days` columns already exist on the `properties` table.


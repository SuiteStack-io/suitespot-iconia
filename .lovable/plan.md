

## Add Configurable Weekend & Off-Peak Days to Rate Plans

### Overview
Add property-level weekend/off-peak day configuration, add off-peak rate to rate plans, and fix the current bug where Saturday is incorrectly treated as a weekend day for pricing.

### Database Migration

**1. Add columns to `properties` table:**
```sql
ALTER TABLE properties ADD COLUMN weekend_days integer[] DEFAULT '{4,5}';
ALTER TABLE properties ADD COLUMN off_peak_days integer[] DEFAULT '{}';
```

**2. Add off-peak rate to `rate_plan_prices`:**
```sql
ALTER TABLE rate_plan_prices ADD COLUMN off_peak_rate numeric DEFAULT NULL;
```

Using `properties` directly (not a separate table) keeps it simple and aligns with the "properties as single source of truth" pattern.

### Code Changes

#### 1. Property Interface & Settings (`src/lib/propertyContext.tsx`, `src/components/settings/PropertyForm.tsx`)
- Add `weekend_days` and `off_peak_days` to the `Property` interface
- Add a "Pricing Rules" card in PropertyForm with day-of-week toggle buttons for weekend and off-peak days
- Validate no overlap between weekend and off-peak selections
- Include region presets dropdown (Middle East: Thu-Fri weekend/Sat off-peak, Western: Fri-Sat weekend/Sun off-peak)

#### 2. QuickRateGrid.tsx — Use property settings for day classification
- Fetch active property's `weekend_days` and `off_peak_days` from context
- Replace hardcoded `isWeekendRate()` and `isWeekendHighlight()` with property-aware functions:
  - `isWeekendRate(date)` → checks `property.weekend_days.includes(date.getDay())`
  - `isOffPeakRate(date)` → checks `property.off_peak_days.includes(date.getDay())`
  - `isWeekendHighlight(date)` → same as `isWeekendRate`
- Update `getEffectiveRate()` to return off-peak rate when applicable (priority: date override > off-peak rate > weekend rate > weekday rate)
- Add off-peak column highlighting (light blue/purple)
- Update legend to dynamically show configured day names: "Weekend (Thu-Fri) · Off-Peak (Sat)"

#### 3. RoomRates.tsx — Same weekend/off-peak logic
- Mirror the same changes from QuickRateGrid for the front-desk rate calendar view

#### 4. RatePlanDialog.tsx — Add off-peak pricing field
- Add "Off-Peak ($)" input field alongside Weekday and Weekend
- Add "Auto off-peak (-15%)" checkbox similar to auto-weekend (+10%)
- Show info text: "Days shown based on Property Pricing Rules: Weekend: Thu, Fri · Off-Peak: Sat"
- Wire `off_peak_rate` into the save flow

#### 5. rateResolver.ts — Property-aware rate resolution
- Update `getActiveRate()` to accept optional `weekendDays`/`offPeakDays` arrays (with defaults `[4,5]`/`[]`)
- Fix the current bug: remove Saturday (day 6) from weekend detection
- Add off-peak rate logic: if date falls on an off-peak day and `off_peak_rate` exists, use it

#### 6. calculateWeekendRate / calculateOffPeakRate helpers
- Add `calculateOffPeakRate(weekdayRate)` helper in `rateResolver.ts` (default -15%, rounded to $5)

### Files to edit
- **Database migration**: Add `weekend_days`, `off_peak_days` to properties; add `off_peak_rate` to `rate_plan_prices`
- **`src/lib/propertyContext.tsx`**: Add new fields to Property interface
- **`src/components/settings/PropertyForm.tsx`**: Add Pricing Rules UI section
- **`src/components/pms/QuickRateGrid.tsx`**: Property-aware weekend/off-peak logic + highlighting
- **`src/pages/RoomRates.tsx`**: Same weekend/off-peak logic
- **`src/components/pms/RatePlanDialog.tsx`**: Add off-peak rate field
- **`src/lib/rateResolver.ts`**: Fix weekend bug, add off-peak support

### Immediate bug fix included
The current `isWeekendRate` includes Saturday (day 6) which is wrong for Egypt. This will be fixed as part of making it property-configurable, defaulting to Thu-Fri (4,5) only.


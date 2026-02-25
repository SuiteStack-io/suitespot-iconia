

## Phase 2: Wire Entities to Active Property Context

### Problem
Currently, all queries for `units`, `reservations`, and `rate_plans` are global — they don't filter by property. The `rate_plans` table already has a `property_id` column, but `units` and `reservations` do not. When a user switches properties via the PropertySwitcher, the data shown should change accordingly.

### Scope Analysis

**Database changes needed:**
1. Add `property_id` (uuid, nullable, FK to `properties`) to `units` table
2. Add `property_id` (uuid, nullable, FK to `properties`) to `reservations` table
3. Backfill all existing rows in `units`, `reservations`, and `rate_plans` with the ICONIA Zamalek property ID
4. Update RLS policies on all three tables to include property-based access checks

**Frontend files that query `units` (need property filtering) — ~19 files:**
- `Dashboard.tsx`, `AvailabilityCalendar.tsx`, `RoomCalendar.tsx`, `WeeklyCalendar.tsx`
- `Rooms.tsx`, `RoomTypes.tsx`, `BookingComReservations.tsx`
- `Analytics.tsx`, `ReservationDetail.tsx`
- `CreateReservationDialog.tsx`, `BlockedDatesManager.tsx`
- `pms/Prices.tsx`, `pms/Restrictions.tsx`, `front-desk/RoomRates.tsx`
- `channex/PropertySettings.tsx`, `channex/PropertySync.tsx`, `channex/SyncLogs.tsx`
- `ChannexDebug.tsx`, `CheckInOut.tsx`

**Frontend files that query `reservations` (need property filtering) — ~26 files:**
- `Dashboard.tsx`, `ReservationsList.tsx`, `RoomCalendar.tsx`, `WeeklyCalendar.tsx`
- `Analytics.tsx`, `CashSettlement.tsx`, `Commissions.tsx`, `Housekeeping.tsx`
- `CheckInOut.tsx`, `ReservationDetail.tsx`, `GuestAccounts.tsx`, `GuestForms.tsx`
- `CreateReservationDialog.tsx`, `RoomTransferDialog.tsx`, `RoomSwapDialog.tsx`
- `BookingComReservations.tsx`, `PendingAssignmentsAlert.tsx`
- `CancellationAnalytics.tsx`, `Guests.tsx`
- Various edge function triggers (these will continue to work since `property_id` is nullable and existing triggers don't filter by property)

**Frontend files that query `rate_plans`** — ~10 files (already has column, just needs filtering)

### Implementation Plan

#### Step 1: Database Migration
```sql
-- Add property_id to units
ALTER TABLE public.units ADD COLUMN property_id uuid REFERENCES public.properties(id);

-- Add property_id to reservations  
ALTER TABLE public.reservations ADD COLUMN property_id uuid REFERENCES public.properties(id);

-- Create indexes
CREATE INDEX idx_units_property_id ON public.units(property_id);
CREATE INDEX idx_reservations_property_id ON public.reservations(property_id);
CREATE INDEX idx_rate_plans_property_id ON public.rate_plans(property_id);

-- Backfill: set all existing units, reservations, rate_plans to the ICONIA property
UPDATE public.units SET property_id = (SELECT id FROM public.properties WHERE is_default = true LIMIT 1) WHERE property_id IS NULL;
UPDATE public.reservations SET property_id = (SELECT id FROM public.properties WHERE is_default = true LIMIT 1) WHERE property_id IS NULL;
UPDATE public.rate_plans SET property_id = (SELECT id FROM public.properties WHERE is_default = true LIMIT 1) WHERE property_id IS NULL;

-- Auto-assign property_id on new units (trigger)
CREATE OR REPLACE FUNCTION public.set_default_property_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.property_id IS NULL THEN
    SELECT id INTO NEW.property_id FROM public.properties WHERE is_default = true LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_units_default_property BEFORE INSERT ON public.units
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
CREATE TRIGGER set_reservations_default_property BEFORE INSERT ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
CREATE TRIGGER set_rate_plans_default_property BEFORE INSERT ON public.rate_plans
  FOR EACH ROW EXECUTE FUNCTION set_default_property_id();
```

#### Step 2: Create a Reusable Property Filter Hook
Create `src/hooks/usePropertyFilter.ts` — a helper that provides `propertyId` and a `withPropertyFilter(query)` function to DRY up the filtering logic across all pages.

#### Step 3: Update Frontend Queries (Incremental)
For each page/component, the change pattern is:
1. Import `usePropertySafe` (safe variant to avoid crashes on public pages)
2. Add `.eq('property_id', activeProperty.id)` to the query
3. Add `activeProperty?.id` to the query's dependency array

**Replace `.eq('location', 'ICONIA')` with `.eq('property_id', propertyId)` in all 10+ files** that currently hardcode the ICONIA filter.

**Priority order:**
1. Core pages: `Dashboard.tsx`, `Rooms.tsx`, `ReservationsList.tsx`, `Calendar/RoomCalendar.tsx`
2. PMS pages: `pms/Prices.tsx`, `pms/Restrictions.tsx`, `RoomTypes.tsx`, `RoomRates.tsx`
3. Operations: `CheckInOut.tsx`, `CashSettlement.tsx`, `Commissions.tsx`, `Housekeeping.tsx`
4. Analytics: `Analytics.tsx`, `CancellationAnalytics.tsx`
5. Channex: `ChannexDebug.tsx`, `channex/PropertySettings.tsx`, `channex/PropertySync.tsx`
6. Dialogs: `CreateReservationDialog.tsx`, `RoomTransferDialog.tsx`, `RoomSwapDialog.tsx`

#### Step 4: Update Insert Operations
When creating new units, reservations, or rate plans, include `property_id: activeProperty.id` in the insert payload.

### Key Design Decisions
- **`property_id` stays nullable** to avoid breaking existing edge functions and webhook-created records. The default-property trigger ensures new records always get assigned.
- **Replace `location = 'ICONIA'` filter** with `property_id = X` — the `location` column becomes redundant for ICONIA queries but stays for backward compat with Almaza Bay (separate system).
- **Public pages** (booking flow, guest portal) don't filter by property context since they're not in the admin scope.
- **Edge functions** that create reservations (Channex webhook, etc.) will rely on the trigger to auto-assign the default property.

### Risk Mitigation
- All changes are additive (new column, nullable) — no existing data is lost
- Backfill runs in the same migration so queries work immediately
- The default-property trigger prevents orphaned records


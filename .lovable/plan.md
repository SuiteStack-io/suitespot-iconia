

## Use Booking.com Name in All Channex-Related Views

### Problem
The Channex Properties tab currently shows internal suite names (e.g., "One Bedroom Suite with Balcony") instead of the guest-facing Booking.com names (e.g., "Suite with Terrace"). This is inconsistent with the room naming convention used elsewhere in the system.

### Changes

#### 1. `src/components/channex/PropertySync.tsx`
- Add `booking_com_name` to the Unit interface and the database query (`select`)
- Change the display to use `booking_com_name || name` as the primary label (matching the system-wide convention)

#### 2. `supabase/functions/channex-sync-property/index.ts`
- Already uses `booking_com_name || name` for room type grouping -- no changes needed here

### Technical Details

**PropertySync.tsx changes:**

```text
// Interface update
interface Unit {
  id: string;
  name: string | null;
  booking_com_name: string | null;  // ADD
  unit_number: string | null;
}

// Query update (line 43)
supabase.from('units').select('id, name, booking_com_name, unit_number').order('unit_number')

// Display update (line 130)
<p className="font-medium">
  {unit.booking_com_name || unit.name || unit.unit_number || 'Unnamed'}
</p>
```

This ensures the Properties tab shows "Suite with Terrace" (Unit 501) instead of "One Bedroom Suite with Balcony", matching the Booking.com-facing names that Channex will use for OTA synchronization.


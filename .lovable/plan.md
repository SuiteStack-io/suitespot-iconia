

## Add Bulk Availability Editor to PMS Availability Page

### Overview
Add a tabbed interface to the Availability page with a "Bulk Editor" tab for setting availability overrides and syncing to Channex. The existing `channex-push-availability` edge function already handles the API call — this is purely a frontend feature.

### Architecture
- No new database table needed — availability is pushed directly to Channex (same as restrictions pattern)
- The edge function `channex-push-availability` already exists and accepts `updates[]` with `property_id`, `room_type_id`, `date_from`, `date_to`, `availability`
- Room types are derived from `units.booking_com_name` grouping (same as `RoomTypes.tsx` pattern)
- `room_type_id` for Channex mapping = the first unit ID of that room type group (matches `channex_mappings.local_id`)

### File Changes

**1. Create `src/components/pms/BulkAvailabilityEditor.tsx`**

New component following the same two-step Apply/Save pattern as `BulkRestrictionEditor`:

- **Room Type selector**: dropdown populated from distinct `booking_com_name` values of property units
- **Date From / Date To**: calendar pickers (Date To auto-fills from Date From)
- **Available Rooms**: numeric input with "rooms" unit label (using same `w-24 h-9 text-right` styling)
- **Apply Availability**: adds to pending changes list
- **Pending Changes**: displays pending items with remove button
- **Save Changes**: calls `channex-push-availability` edge function with all pending items

Props:
```typescript
interface PendingAvailability {
  id: string;
  roomTypeName: string;
  roomTypeUnitId: string; // first unit ID for channex mapping lookup
  dateFrom: string;
  dateTo: string;
  availability: number;
  addedAt: Date;
}

interface BulkAvailabilityEditorProps {
  pendingAvailability: PendingAvailability[];
  setPendingAvailability: React.Dispatch<React.SetStateAction<PendingAvailability[]>>;
}
```

Save handler:
- Builds `updates[]` array with `property_id` (from `usePropertyId()`), `room_type_id` (the unit ID used in channex_mappings), `date_from`, `date_to`, `availability`
- Calls `supabase.functions.invoke('channex-push-availability', { body: { updates } })`
- Clears pending on success

**2. Update `src/pages/pms/Availability.tsx`**

- Add `Tabs` with "Calendar" and "Bulk Editor" tabs (same pattern as Restrictions page)
- Hold `pendingAvailability` state in the page component so it survives tab switches
- Show badge count on Bulk Editor tab when pending items exist
- Desktop: Calendar tab shows `RoomCalendar` + `BlockedDatesManager`; Bulk Editor tab shows `BulkAvailabilityEditor`
- Mobile: keep existing `MobileCalendarView` in Calendar tab

### Summary
- 1 new file: `BulkAvailabilityEditor.tsx`
- 1 modified file: `Availability.tsx` (add tabs + state)
- 0 database changes
- 0 edge function changes (existing one is sufficient)


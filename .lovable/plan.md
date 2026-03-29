

## Add Room Type Filter to Reservations List

### Changes — Single File: `src/components/ReservationsList.tsx`

**1. Add state** (after line 149):
```ts
const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
const [roomTypes, setRoomTypes] = useState<string[]>([]);
```

**2. Fetch room types** — add a `fetchRoomTypes` function that queries distinct `booking_com_name` values from the `units` table filtered by `property_id`. Call it alongside `fetchUnits` in the initial `useEffect` and on unit real-time changes.

**3. Add `roomTypeFilter` to the `useEffect` dependency array** (line 207).

**4. Add room type filtering in `filterReservations()`** (after status filter, before unit filter ~line 332):
```ts
if (roomTypeFilter !== 'all') {
  filtered = filtered.filter(r => r.units?.booking_com_name === roomTypeFilter);
}
```

**5. Cascading unit filter** — when rendering the "All Units" dropdown, if `roomTypeFilter !== 'all'`, only show units whose `booking_com_name` matches the selected room type. This requires updating `fetchUnits` to also fetch `booking_com_name` on each unit.

**6. UI — add Room Type dropdown** between the "All Units" Select and the check-in date range Popover (after line 887):
```tsx
<Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
  <SelectTrigger className="w-full sm:w-[200px]">
    <SelectValue placeholder="All Room Types" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Room Types</SelectItem>
    {roomTypes.map(rt => (
      <SelectItem key={rt} value={rt}>{rt}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**7. Update units state type** to include `booking_com_name: string | null` so the cascading filter can work.

### No other changes
- Table columns, data, existing filters, Create Reservation — all unchanged.


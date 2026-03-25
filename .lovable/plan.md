

## Show real photos on the Suites page and answer the upload question

### Where to upload photos

Photos can be uploaded from two places:
1. **Rooms Management** (`/admin/rooms`) — edit a room type and add photos directly to the unit record (stored in the `photos` column)
2. **Media Library** (`/admin/media`) — general media uploads, but these aren't linked to specific room types

The `photos` field on each unit record is what the Suites page should display. So the best workflow is: go to Rooms, edit a unit, and upload photos there.

### Code changes — `src/pages/Suites.tsx`

**1. Fetch photos and real data from units**

Update the query (line 81) to also select `photos, max_guests, beds, features`:
```
.select("id, name, booking_com_name, unit_type, unit_number, unit_size, status, comments, photos, max_guests, beds, features")
```

Update the `Unit` interface to add:
```ts
photos: string[] | null;
max_guests: number | null;
beds: number | null;
features: string[] | null;
```

When grouping units, prefer the record that has photos.

**2. Replace placeholder with real image**

Replace the gradient placeholder div (lines 191-196) with:
- If `unit.photos?.length > 0`: render an `<img>` with `unit.photos[0]` as src, object-cover
- Otherwise: keep the current placeholder

**3. Use real data for guests, beds, amenities when available**

- Use `unit.max_guests` instead of hardcoded guest counts when available
- Use `unit.beds` for bedding info when available  
- Use `unit.features` for amenities when available, falling back to the existing defaults

### What stays the same
- Page layout, card structure, SEO, hero section
- "Check Availability" button behavior
- Common amenities section at bottom


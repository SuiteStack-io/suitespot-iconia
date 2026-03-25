

## Room Photos: Type-Level and Unit-Level Photo Management

This is a large feature spanning database changes, a new reusable photo upload modal component, updates to the Rooms Management page, and public Suites page integration.

### Database Changes

**Migration 1 — Two new tables:**

```sql
CREATE TABLE public.room_type_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_name text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.unit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_type_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_photos ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can CRUD (admin check done in app)
CREATE POLICY "Authenticated users can manage room_type_photos"
  ON public.room_type_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage unit_photos"
  ON public.unit_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public read for website display
CREATE POLICY "Public can read room_type_photos"
  ON public.room_type_photos FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read unit_photos"
  ON public.unit_photos FOR SELECT TO anon USING (true);
```

Note: Using `room_type_name` + `property_id` as the grouping key (matching how room types are grouped by `booking_com_name` in the existing code) rather than a foreign key to a room_types table that doesn't exist.

### New Component: `src/components/PhotoUploadModal.tsx`

A reusable modal for both room-type and unit-level photo uploads:
- Props: `open`, `onOpenChange`, `title`, `description` (the note text), `photos` (existing), `onSave`, `onDelete`, `uploading` state
- Drag & drop zone + file picker (jpg, png, webp, max 3MB)
- Photo preview grid with thumbnails
- Delete button per photo
- Drag-to-reorder using `@dnd-kit` (already in project)
- Save button
- For unit-level modal: extra "Clear unit photos" button (passed as optional prop)

### Changes to `src/pages/Rooms.tsx`

**1. Fetch photo data alongside units:**
- Query `room_type_photos` grouped by `room_type_name` for the current property
- Query `unit_photos` grouped by `unit_id`
- Store in state: `roomTypePhotos: Record<string, RoomTypePhoto[]>` and `unitPhotosMap: Record<string, UnitPhoto[]>`

**2. Room type card header — add photo button + mode badge:**
- Add a camera icon button next to the badges in each card header
- Clicking opens the PhotoUploadModal for that room type
- Show photo mode badge:
  - "Type photos (shared)" if room_type_photos exist and no unit has unit_photos
  - "Per-unit photos" if all units have their own photos
  - "Mixed" if some units have their own photos

**3. Unit row PHOTOS column — make clickable:**
- Show effective photo count (unit_photos count if exists, else room_type_photos count, else 0)
- If using shared photos, show a small "shared" indicator
- Clicking opens PhotoUploadModal for that specific unit
- Upload to `property-photos` bucket under path `units/[unit_id]/`

**4. Room type photo upload:**
- Upload to `property-photos` bucket under path `room-types/[property_id]/[room_type_name]/`
- Save references to `room_type_photos` table

**5. Unit photo upload:**
- Upload to `property-photos` bucket under path `units/[unit_id]/`
- Save references to `unit_photos` table

### Changes to `src/pages/Suites.tsx`

Update the public Suites page to use the new photo tables with priority logic:
1. Fetch `unit_photos` and `room_type_photos` for the default property
2. When selecting photos for a suite card: check `unit_photos` first, fall back to `room_type_photos`, then fall back to `units.photos` (legacy)

### Files to Create
- `src/components/PhotoUploadModal.tsx` — reusable photo modal

### Files to Modify
- `src/pages/Rooms.tsx` — add photo fetching, type-level photo button, clickable unit photo counts, mode badges
- `src/pages/Suites.tsx` — use new photo tables with priority logic
- Database migration for two new tables + RLS


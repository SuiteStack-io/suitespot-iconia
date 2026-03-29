

## Add Photo Slideshow to Front Desk Room Rates Cards

### Problem
The Room Rates cards show placeholder icons instead of actual room photos. The photos exist in the `room_type_photos` table (and fallback `unit_photos` / legacy `photos` field on units).

### Solution
Replace the single static image with an auto-advancing slideshow (carousel) per card, fetching photos from `room_type_photos` (priority: cover photo first, then by display_order), falling back to the legacy `photos` array on units.

### Changes — Single File: `src/pages/front-desk/RoomRates.tsx`

**1. Fetch room type photos** — add a 4th parallel query for `room_type_photos` filtered by property, ordered by `display_order`:
```ts
supabase.from('room_type_photos').select('room_type_name, photo_url, display_order, is_cover').eq('property_id', propertyId).order('display_order')
```

**2. Update photo resolution** — when building each `RoomTypeData`, prefer `room_type_photos` matching by `room_type_name`, sorted with `is_cover` first. Fall back to existing legacy `photos` array from units.

**3. Replace static image with slideshow** — replace the `<AspectRatio>` block (lines 198-210) with a simple auto-advancing slideshow component:
- State: `currentIndex` per card, auto-advances every 4 seconds
- Shows dot indicators at the bottom when multiple photos exist
- Click left/right halves to navigate manually
- Smooth crossfade transition between images
- Falls back to placeholder icon if no photos

**4. Add `useState`/`useEffect` imports** and a small inline `RoomPhotoSlideshow` component defined within the file (no new file needed).

### Technical Details
- Uses `useState` + `useEffect` with `setInterval` for auto-advance
- Dot indicators use absolute positioning at the bottom of the AspectRatio container
- No external carousel library needed — simple index rotation
- Pauses auto-advance on hover for better UX


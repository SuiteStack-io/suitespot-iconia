

## Suites Page: Default Cover Photo, Lightbox Slideshow, Mobile Swipe

### Overview
Three changes: (1) add `is_cover` field to `room_type_photos` for marking a default/cover photo, with admin UI toggle; (2) build a fullscreen lightbox slideshow component; (3) add mobile swipe support and dot indicators on suite cards.

### 1. Database Migration

Add `is_cover` boolean column to `room_type_photos`:

```sql
ALTER TABLE public.room_type_photos ADD COLUMN is_cover boolean NOT NULL DEFAULT false;
```

### 2. Admin PhotoUploadModal — Cover Photo Toggle

**File: `src/components/PhotoUploadModal.tsx`**

- Add a star/pin icon overlay on each `SortablePhoto` thumbnail
- Clicking the star marks that photo as the cover (`is_cover = true`) and unmarks all others
- Track `coverId` state in the modal, pass it out via a new `onCoverChange?: (photoId: string) => void` prop or embed it in the `onPhotosChange` callback
- Visually: filled star = cover, outlined star = not cover

**File: `src/pages/Rooms.tsx`**

- When saving room type photos, persist the `is_cover` field alongside each photo record
- Fetch `is_cover` in the photo query and pass it through

### 3. New Component: `src/components/SuiteLightbox.tsx`

A fullscreen lightbox/slideshow component with:

- **Props**: `photos: string[]`, `initialIndex: number`, `open: boolean`, `onClose: () => void`
- **Navigation**: Left/right arrow buttons, keyboard arrows, Escape to close
- **Counter**: "2 / 6" indicator
- **Close**: X button top-right, click outside image, Escape key
- **Transitions**: CSS fade/slide between images
- **Mobile swipe**: Touch event handlers (`touchstart`, `touchmove`, `touchend`) for left/right navigation and swipe-down to close, with momentum-based transitions
- **Animation**: Scale-up open animation using CSS transforms

### 4. Update Suites Page (`src/pages/Suites.tsx`)

**Data fetching:**
- Fetch `is_cover` from `room_type_photos` alongside `photo_url` and `display_order`
- Determine cover photo: find photo with `is_cover = true`, fall back to first by `display_order`
- Store all photos per unit (not just the cover) for the lightbox

**Suite card image area:**
- Display cover photo as main image
- Add dot indicators at bottom of image when `photos.length > 1`
- On click, open `SuiteLightbox` with all photos starting at index 0
- Add a subtle camera icon overlay showing photo count

**Lightbox integration:**
- Render `SuiteLightbox` component, controlled by state: `lightboxOpen`, `lightboxPhotos`, `lightboxIndex`

### 5. Technical Details

**Touch swipe implementation** (in SuiteLightbox):
```
- Track touchStartX, touchStartY, touchDeltaX on touchmove
- Apply translateX transform following the finger
- On touchend: if deltaX > threshold (50px), navigate; if deltaY > threshold, close
- Use CSS transition for snap-back animation
```

**Dot indicators** on suite card:
- Absolutely positioned at bottom center of image container
- Small circles, filled for "current" (always first when not in lightbox)
- Max ~6 dots shown, collapse to "..." if more

### Files to Create
- `src/components/SuiteLightbox.tsx`

### Files to Modify
- `src/components/PhotoUploadModal.tsx` — add cover star toggle on thumbnails
- `src/pages/Rooms.tsx` — persist `is_cover` field when saving room type photos
- `src/pages/Suites.tsx` — fetch `is_cover`, use cover photo, add dot indicators, integrate lightbox
- Database migration for `is_cover` column




## Show Cover Photo + Click-to-Open Lightbox on Room Rate Cards

### Changes — Single File: `src/pages/front-desk/RoomRates.tsx`

**1. Import `SuiteLightbox`** — add `import SuiteLightbox from '@/components/SuiteLightbox';`

**2. Replace `RoomPhotoSlideshow` component** with a simpler `RoomPhotoCard`:
- Shows only the **first photo** (cover) as a static image — no auto-advance, no timer
- Adds a clickable overlay/cursor-pointer so clicking opens the lightbox
- Shows a small photo count badge (e.g., "1/8") in the corner if multiple photos exist
- State: `lightboxOpen` + `lightboxIndex` to control the `SuiteLightbox`
- Renders `<SuiteLightbox photos={photos} initialIndex={0} open={lightboxOpen} onClose={...} />` when clicked
- Falls back to the `ImageIcon` placeholder if no photos

**3. No other changes** — card layout, data fetching, rate display all stay the same.


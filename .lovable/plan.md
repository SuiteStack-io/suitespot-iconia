

## Fix Photo Upload: SEO-Friendly Filenames + WebP Conversion

### Problem
Photos are stored with random timestamp filenames (e.g., `1774440992213-um0zls2l56.webp`), which hurts SEO. Need clean, descriptive filenames like `iconia-zamalek-family-suite-1.webp`.

### Changes

#### 1. Update `src/components/PhotoUploadModal.tsx`

**Add new optional props:**
- `seoPrefix?: string` — e.g. `"iconia-zamalek"`
- `seoSlug?: string` — e.g. `"family-suite"` (pre-slugified room type name)

**Add WebP conversion helper** using Canvas API:
```ts
const convertToWebP = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      canvas.toBlob(blob => blob ? resolve(blob) : reject('Conversion failed'), 'image/webp', 0.85);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
```

**Update `handleFiles` upload logic:**
- When `seoSlug` is provided, calculate the next sequence number from `photos.length + i + 1`
- Convert file to WebP via canvas if not already WebP
- Generate filename: `${storagePath}/${seoPrefix}-${seoSlug}-${sequenceNum}.webp`
- Fall back to existing timestamp naming when no `seoSlug` is provided (backward compatible)

#### 2. Update `src/pages/Rooms.tsx`

**Add slug helper:**
```ts
const toSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');
```

**Pass new props to PhotoUploadModal:**
- For room type uploads: `seoPrefix="iconia-zamalek"` and `seoSlug={toSlug(roomTypeName)}`
- For unit uploads: same pattern using unit name

### What stays the same
- Drag & drop, delete, reorder all unchanged
- Unit-level photo uploads work the same way
- No database changes needed
- Storage paths/bucket unchanged


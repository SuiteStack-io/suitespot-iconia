
## Align Front and Back ID Upload Buttons Side by Side

### Overview

Currently the "Front" and "Back" upload sections for ID documents are stacked vertically. This change places them side-by-side in a 2-column grid layout.

### Changes -- File: `src/components/CreateReservationDialog.tsx`

**1. Wrap Front and Back sections in a grid container (lines 1729-1853)**

When `idPassportType === 'id'`, wrap both the Front and Back upload sections in a `grid grid-cols-2 gap-4` container so they appear side-by-side.

When `idPassportType === 'passport'`, keep the single "Image" upload at full width (no grid needed since there's no Back image).

The existing content of each section stays the same -- only the outer layout wrapper changes.

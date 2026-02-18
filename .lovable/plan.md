

## Rename "Prices" to "Rate Plans" in Navigation and Page

Three files need small text changes:

### 1. `src/components/SlideMenu.tsx` (line 103)
- Change `title: 'Prices'` to `title: 'Rate Plans'`

### 2. `src/pages/pms/Prices.tsx`
- Change the header `<h1>` text from "Prices" to "Rate Plans" (line ~225)
- Change the breadcrumb `currentPage` from "Prices" to "Rate Plans" (line ~231)

No route changes needed -- the URL `/pms/prices` and file name stay the same to avoid breaking links.

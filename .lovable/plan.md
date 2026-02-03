

## Add LocalBusiness Schema to Iconia Zamalek Page

### Overview

Add structured data (JSON-LD) to the Iconia Zamalek page using the `LocalBusiness` schema type. This will help search engines better understand the property details and improve local search visibility.

---

### Technical Change

**File: `src/pages/IconiaZamalek.tsx`**

1. **Add LocalBusiness schema object** before the component (similar to the pattern used in `Locations.tsx`):

```typescript
const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": "https://www.findyoursuitespot.com/iconia-zamalek",
  "name": "SuiteSpot ICONIA Zamalek",
  "description": "Luxury serviced apartments in Zamalek, Cairo. Modern design-driven suites in an architecturally unique building with wellness programs and hotel-level service.",
  "url": "https://www.findyoursuitespot.com/iconia-zamalek",
  "image": "https://www.findyoursuitespot.com/slideshow/iconia-zamalek.jpg",
  "telephone": "+20-2-2735-0000",
  "email": "info@findyoursuitespot.com",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "16 Mohammed Thakeb Street, Iconia Building",
    "addressLocality": "Zamalek",
    "addressRegion": "Cairo",
    "postalCode": "11211",
    "addressCountry": "EG"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "30.0564",
    "longitude": "31.2241"
  },
  "openingHoursSpecification": {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    "opens": "00:00",
    "closes": "23:59"
  },
  "priceRange": "$$$"
};
```

2. **Pass schema to SEO component** via the `additionalJsonLd` prop:

```typescript
<SEO
  title="ICONIA Zamalek | redefining serviced apartment living in Egypt by SuiteSpot Hospitality"
  description="Luxury serviced apartments at Iconia Zamalek, Cairo. Managed by SuiteSpot Hospitality."
  path="/iconia-zamalek"
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "About", path: "/about" },
    { name: "ICONIA Zamalek" }
  ]}
  additionalJsonLd={localBusinessJsonLd}
/>
```

---

### Schema Properties Included

| Property | Value |
|----------|-------|
| `name` | SuiteSpot ICONIA Zamalek |
| `description` | Luxury serviced apartments in Zamalek, Cairo... |
| `telephone` | +20-2-2735-0000 |
| `email` | info@findyoursuitespot.com |
| `streetAddress` | 16 Mohammed Thakeb Street, Iconia Building |
| `addressLocality` | Zamalek |
| `addressRegion` | Cairo |
| `addressCountry` | EG |
| `geo` | Latitude/Longitude coordinates |
| `priceRange` | $$$ |

---

### Result

The page will include a `<script type="application/ld+json">` block with the LocalBusiness schema, helping Google and other search engines display rich results for local business searches.

---

### File Summary

| File | Action | Lines |
|------|--------|-------|
| `src/pages/IconiaZamalek.tsx` | Add schema object (after imports) and update SEO component | 9-21 |


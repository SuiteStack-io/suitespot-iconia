

## Update Schema Markup to LodgingBusiness

### Overview

Update the existing JSON-LD schema on the `/iconia-zamalek` page from `LocalBusiness` to `LodgingBusiness` type with the specified property values, and dynamically fetch the first homepage slideshow image from the database.

---

### Technical Changes

**File: `src/pages/IconiaZamalek.tsx`**

#### 1. Add Database Query for Homepage Image

Import `useEffect` and `useState` from React, and the Supabase client to fetch the first slideshow image:

```typescript
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
```

#### 2. Create Dynamic JSON-LD Schema

Instead of a static `localBusinessJsonLd` object, we'll create it dynamically based on the fetched image. The component will:

1. Fetch the first image from `slideshow_images` table (ordered by `sequence_order`)
2. Use that image URL in the schema, with a fallback to the current static image

#### 3. Updated Schema Values

| Property | Current Value | New Value |
|----------|---------------|-----------|
| `@type` | `LocalBusiness` | `LodgingBusiness` |
| `name` | `SuiteSpot ICONIA Zamalek` | `Iconia Zamalek - SuiteSpot Hospitality` |
| `telephone` | `+20-2-2735-0000` | `+201288444086` |
| `priceRange` | `$$$` | `$110-$160` |
| `description` | (current long description) | `Luxury serviced apartments in Zamalek, Cairo` |
| `image` | (static URL) | (fetched from database with fallback) |

#### 4. Updated Schema Structure

```typescript
const lodgingBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "@id": "https://www.findyoursuitespot.com/iconia-zamalek",
  "name": "Iconia Zamalek - SuiteSpot Hospitality",
  "description": "Luxury serviced apartments in Zamalek, Cairo",
  "url": "https://www.findyoursuitespot.com/iconia-zamalek",
  "image": slideshowImage || "https://www.findyoursuitespot.com/slideshow/iconia-zamalek.jpg",
  "telephone": "+201288444086",
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
  "priceRange": "$110-$160"
};
```

---

### Database Query

```typescript
const { data } = await supabase
  .from("slideshow_images")
  .select("image_url")
  .order("sequence_order", { ascending: true })
  .limit(1)
  .single();
```

This fetches the first homepage slideshow image to use in the schema.

---

### File Summary

| File | Action | Changes |
|------|--------|---------|
| `src/pages/IconiaZamalek.tsx` | Update schema and add dynamic image fetch | Lines 1-40 (imports and schema), add useEffect hook |


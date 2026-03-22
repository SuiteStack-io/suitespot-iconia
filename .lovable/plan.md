

## Full Hardcoded Property References Removal — Implementation Plan

### Overview
Remove all hardcoded property name references from database queries and display strings across 20 files. Replace with dynamic property_id filtering and property name resolution.

---

### PHASE 1: Fix Database Query Hardcodes (9 files, 11 instances)

**Strategy for public pages** (Suites, BookingFlow, BookingWidget, Locations): These don't have PropertyProvider context. Add a helper to look up the default property ID on mount:
```typescript
const [defaultPropertyId, setDefaultPropertyId] = useState<string | null>(null);
useEffect(() => {
  supabase.from("properties").select("id").eq("is_default", true).maybeSingle()
    .then(({ data }) => { if (data) setDefaultPropertyId(data.id); });
}, []);
```
Then replace `.eq("location", "ICONIA")` with `.eq("property_id", defaultPropertyId)` (guard with `if (!defaultPropertyId) return`).

**Strategy for admin pages** (KYCManagement, InventorySelectionModal): Use `usePropertyId()` + `withPropertyFilter()`.

**Strategy for AlmazaBay page**: Look up the Almaza Bay property record by name on mount to get its `id`, then use `.eq("property_id", almazaPropertyId)`.

**Strategy for Edge Functions**: Use `property_id` from the rate plan's associated data or require it in the request payload.

#### File-by-file changes:

**1. `src/pages/Suites.tsx` (line 76)**
- Add state for `defaultPropertyId`, fetch from `properties` table where `is_default = true`
- Replace `.eq("location", "ICONIA")` → `.eq("property_id", defaultPropertyId)`
- Guard: skip fetch if `defaultPropertyId` is null

**2. `src/pages/BookingFlow.tsx` (lines 276, 289, 354)**
- Same default property lookup pattern
- Replace all 3 `.eq("location", "ICONIA")` → `.eq("property_id", defaultPropertyId)`
- Guard all fetches on `defaultPropertyId`

**3. `src/components/BookingWidget.tsx` (line 35)**
- Same default property lookup
- Replace `.eq("location", "ICONIA")` → `.eq("property_id", defaultPropertyId)`

**4. `src/pages/Locations.tsx` (line 72)**
- Same default property lookup
- Replace `.eq("location", "ICONIA")` → `.eq("property_id", defaultPropertyId)`

**5. `src/pages/AlmazaBay.tsx` (lines 336, 877)**
- Add `usePropertyId()` import (this is an admin page with property context)
- Replace `.eq('location', 'Almaza Bay')` → `withPropertyFilter(query, propertyId)` at line 336
- At line 877 (CSV import upsert check): replace `.eq('location', 'Almaza Bay')` → `.eq('property_id', propertyId)` and set `property_id: propertyId` on the insert data instead of `location: 'Almaza Bay'`

**6. `src/pages/KYCManagement.tsx` (line 114)**
- Import `usePropertyId, withPropertyFilter`
- Replace `.eq("location", "Almaza Bay")` → use `withPropertyFilter(query, propertyId)`

**7. `src/components/InventorySelectionModal.tsx` (line 46)**
- Import `usePropertyId, withPropertyFilter`
- Replace `.eq("location", "Almaza Bay")` → use `withPropertyFilter(query, propertyId)`

**8. `supabase/functions/channex-create-derived-rate-plan/index.ts` (line 145)**
- The rate plan already has a `property_id`. Use it: look up `ratePlan.property_id` and replace `.eq('location', 'ICONIA')` → `.eq('property_id', ratePlan.property_id)`

**9. `supabase/functions/channex-sync-property/index.ts` (line 237)**
- Remove the `else` fallback `.eq('location', 'ICONIA')`. If `propertyId` is null, throw an error or return early — property_id should always be provided.

---

### PHASE 2: Fix Display Hardcodes (9 files)

**Strategy for admin pages**: Use `usePropertySafe()` to get `activeProperty?.name`.

**Strategy for GuestCheckIn**: Fetch property name from the reservation's unit's `property_id` (add `properties!property_id(name)` to the reservation query via units join, or look up separately).

**10. `src/components/ReservationQuickActions.tsx` (line 2059)**
- Import `usePropertySafe` from propertyContext
- Replace hardcoded `"ICONIA Zamalek"` with `activeProperty?.name || 'SuiteSpot'`

**11. `src/pages/TicketAnalytics.tsx` (line 229)**
- Import `usePropertySafe`
- Replace `<AdminBreadcrumb section="ICONIA"` → `<AdminBreadcrumb section={activeProperty?.name || "Property"}`

**12. `src/pages/BookingComReservations.tsx` (line 1518)**
- Import `usePropertySafe`
- Replace `<AdminBreadcrumb section="ICONIA"` → `<AdminBreadcrumb section={activeProperty?.name || "Property"}`

**13. `src/pages/SelectionSessions.tsx` (lines 215, 240)**
- Import `usePropertySafe`
- Replace `section="Almaza Bay"` → `section={activeProperty?.name || "Property"}`
- Replace `"Almaza Bay KYC Results"` → `"${activeProperty?.name || 'Property'} KYC Results"` (use template literal)

**14. `src/components/SlideMenu.tsx` (lines 77, 89)**
- Import `usePropertySafe`
- Get `activeProperty` from context
- Replace hardcoded `'ALMAZA BAY'` label → derive from properties list or keep as category labels (these are navigation section headers, not property-specific — will use `activeProperty?.name?.toUpperCase()` for the primary property section, or keep as static navigation categories if they represent distinct product areas)
- Actually, since SlideMenu has two sections ("ALMAZA BAY" and "ICONIA") that represent different property sections, and the menu structure is property-agnostic navigation — these should use the active property name. Replace `'ICONIA'` (line 89) with `activeProperty?.name?.toUpperCase() || 'PROPERTY'`
- The "ALMAZA BAY" section (line 77) is a separate property's management area — keep as-is since it's a distinct navigation section for a specific product line

**15. `src/pages/GuestCheckIn.tsx` (line 445)**
- Expand the reservation query to also fetch the property name: add `property_id` to the units select, then look up property name
- OR: add a state variable `propertyName` and fetch it from the unit's property_id after reservation loads
- Replace `"SuiteSpot ICONIA Zamalek"` → use dynamic property name

**16. `src/pages/BookingFlow.tsx` (line 947)**
- Fetch property name alongside the default property ID lookup
- Replace `"ICONIA Zamalek"` → use `propertyName` state variable

**17. `src/components/guest/QuickActions.tsx` (lines 170, 175)**
- Accept `propertyAddress` as a prop, or fetch from the unit's property
- Replace `"SuiteSpot Almaza, North Coast, Egypt"` → use dynamic value
- This component receives `unitId` — can fetch the property address from the unit's property_id

**18. `src/pages/GuestAccounts.tsx` (line 552)**
- Import `usePropertySafe`
- Replace `"SuiteSpot Almaza"` → use `activeProperty?.name || 'SuiteSpot'`

---

### PHASE 3: Fix Edge Function Email Hardcodes (2 files)

**19. `supabase/functions/send-kyc-reminder/index.ts`**
- Already accepts `propertyName` in request body — the hardcoded strings are in the email template as fallbacks
- Replace `"SuiteSpot Almaza"` in email subject/body with `propertyName || 'SuiteSpot'`
- Replace `"Almaza Bay, North Coast, Egypt"` in footer with dynamic property address (or keep as generic "SuiteSpot" if address not passed)

**20. `supabase/functions/send-kyc-completion-notification/index.ts`**
- Replace `"SuiteSpot Almaza"` references with the property name looked up from the KYC link's associated property
- Import/use the shared `getPropertyName` utility

---

### Files NOT Changed
- Public marketing pages (IconiaZamalek.tsx, PublicFooter, BlogPost, About, PublicHome)
- Route paths
- Code comments
- SEO/schema.org content
- Property records in the database

### Technical Notes
- All public page queries will use a default property lookup pattern (fetch `properties.id` where `is_default = true`)
- All admin page queries will use `usePropertyId()` from the existing hook
- Edge functions will derive property_id from the data context (rate plan, KYC link, etc.)
- Deploy affected edge functions after changes


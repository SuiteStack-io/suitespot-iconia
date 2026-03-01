

## Problem

The dashboard cards don't load for **Manager** and **Front Desk** users because:

1. The `properties` table has an RLS SELECT policy requiring `has_property_access(auth.uid(), id)` OR `is_system_admin` OR `admin` role
2. The three non-admin users (Nikola Bagaric, Emad Rezk, Dina Mamdouh) have **no rows** in the `user_property_access` table
3. Without property access, `PropertyProvider` returns no properties, so `propertyId` is `null`
4. `Dashboard.fetchStats()` has an early return: `if (!propertyId) return;` — cards stay at zero

## Fix

**Database**: Insert `user_property_access` rows for the three users, granting them appropriate roles on the ICONIA Zamalek property (`c98a2256-1787-47a4-bf0f-61942b4e87d5`):

- Nikola Bagaric (`647e42ed-...`) → `manager`
- Emad Rezk (`f2cd80ca-...`) → `manager`  
- Dina Mamdouh (`55dcbd5e-...`) → `staff`

**No code changes needed** — the existing logic works correctly once these users can see the property through RLS.


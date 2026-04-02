

## Fix: Pass property_id to logSync in Derived Rate Plan Functions

### Problem
All `logSync()` calls in both `channex-create-derived-rate-plan` and `channex-delete-derived-rate-plan` pass `null` as the last argument (property_id), so the Property column in sync logs is empty.

### Changes

**File: `supabase/functions/channex-create-derived-rate-plan/index.ts`**

The `ratePlan` object (fetched at line 112) has `ratePlan.property_id`. Use it in all 3 `logSync` calls:

- Line 237: `await logSync(functionName, '/api/v1/rate_plans', channexPayload, null, null, false, errorMessage, null)` → change last `null` to `ratePlan.property_id`
- Line 267: `await logSync(functionName, '/api/v1/rate_plans', channexPayload, channexResponse, 200, true, null, null)` → change last `null` to `ratePlan.property_id`
- Line 281 (catch block): This runs before `ratePlan` may be available, so use `null` still — or wrap in a try. Safest: declare `let resolvedPropertyId: string | null = null;` early in the try block, set it to `ratePlan.property_id` after the rate plan fetch, and use `resolvedPropertyId` in all 3 logSync calls including the catch.

**File: `supabase/functions/channex-delete-derived-rate-plan/index.ts`**

The `mapping` object (fetched at line 80) comes from `derived_rate_plan_mappings` which doesn't have `property_id`. Need to look it up from the base rate plan:

- After fetching `mapping` (line 84), fetch the rate plan's property_id:
  ```ts
  const { data: baseRp } = await supabaseAdmin
    .from('rate_plans')
    .select('property_id')
    .eq('id', mapping.base_rate_plan_id)
    .maybeSingle();
  const resolvedPropertyId = baseRp?.property_id || null;
  ```
- Line 119: change last `null` to `resolvedPropertyId`
- Line 129 (catch block): declare `let resolvedPropertyId: string | null = null;` early, set after fetch, use in catch logSync

### Summary
- 2 files edited
- No new tables, no migrations
- All logSync calls will pass the correct local property_id


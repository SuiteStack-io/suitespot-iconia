

## Clean Up Unused Components

Delete two orphaned component files that are no longer imported anywhere in the project:

1. **`src/components/pms/RatePlanCard.tsx`** -- previously used by the old flat-list Prices page
2. **`src/components/pms/RatePlanPricesTable.tsx`** -- previously used inside RatePlanCard

No other code references these files, so removing them is safe and reduces clutter.


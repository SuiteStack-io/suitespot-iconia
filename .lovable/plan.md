

## Fix Availability Sync: Overlapping Ranges & Checkout Date

### Root Causes

**Bug 1 — Checkout date as occupied**: `calculateAvailabilityRanges` collapses day-by-day results using `date_to = lastDate + 1` (exclusive convention). But Channex treats `date_to` as **inclusive** — so pushing `date_to: 2026-03-27` marks March 27 with reduced availability, even though it's the checkout day and should remain at full availability.

**Bug 2 — Overlapping entries**: The trigger queues two items for date modifications (old range + new range). These are processed independently in the sync queue, each generating collapsed ranges. When old and new ranges overlap, the final payload contains duplicate/overlapping date ranges for the same room type.

### Fix (single file: `channex-process-sync-queue/index.ts`)

**1. Merge overlapping queue items before processing**

After deduplication (lines 82-91), add a merge step: group deduped items by `entity_id`, then merge overlapping date ranges into a single expanded range. For example, if two items cover March 18-25 and March 20-27 for the same entity, merge into one item covering March 18-27. This way `calculateAvailabilityRanges` is called once per entity with the full date span, producing clean non-overlapping output.

**2. Use inclusive `date_to` in collapsed ranges**

In `calculateAvailabilityRanges` (lines 560, 566), change:
```
date_to: formatDate(addDays(new Date(lastDate), 1))
```
to:
```
date_to: lastDate
```

This makes `date_to` inclusive, matching Channex's API convention. The day-by-day loop (`d < endDate`) already correctly excludes the checkout date from availability calculation — this change only affects how the results are formatted for Channex.

No other files are modified. No variable re-declarations.


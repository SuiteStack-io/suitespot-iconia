

## Fix: Equal-Width Metric Cards on Mobile

### Problem
Both the Occupancy and RevPAR cards have `max-w-[300px]`, which prevents them from stretching to full container width on mobile. The Occupancy card content is wider, making them appear different sizes.

### Fix — 1 File

**File: `src/components/AvailabilityCalendar.tsx`**

**Line 1902** — Change the container div class to stack cards vertically on mobile:
```
flex gap-4 mb-4 flex-wrap items-start
→
flex flex-col md:flex-row gap-4 mb-4 flex-wrap items-stretch
```

**Lines 1905 and 1929** — Remove `max-w-[300px]` and add responsive max-width:
```
flex-1 min-w-[200px] max-w-[300px]
→
flex-1 min-w-[200px] md:max-w-[300px]
```

This makes both cards full-width on mobile (stacked) while keeping the current side-by-side capped layout on desktop.


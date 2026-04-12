

## Move "Dynamic Pricing" Menu Item to PMS Section

### Change — 1 File

**File: `src/components/SlideMenu.tsx`**

1. Remove line 77: `{ title: 'Dynamic Pricing', url: '/dynamic-pricing', icon: TrendingUp, showFor: ['admin'] }` from OPERATIONS section
2. Insert it in the PMS section immediately after the "Prices" item (after line 102), so the PMS items become:
   - Availability
   - Prices
   - **Dynamic Pricing** ← here
   - Restrictions
   - Channel Markup
   - Channex Integration
   - Channex Debug
   - Shuffle History

No other files change.


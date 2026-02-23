

## Auto-Create Derived Rate Plans on Channel Markup Save

### Overview

When an admin adds a channel with a markup percentage, the system should automatically create derived rate plans in Channex for all synced base rate plans -- no manual "Create" button needed. The Prices page should show derived plans as read-only entries with colored badges.

### Changes

**1. Channel Markup Page (`src/pages/pms/ChannelMarkup.tsx`)**

Update the `addChannel` function to:
- After inserting the channel markup setting, immediately call `createDerivedPlansForChannel` with the newly created channel ID
- This makes the "Add Channel" button a one-step operation: save settings + create all derived plans
- Keep the manual "Create" button for re-syncing if needed
- When markup percentage is changed (onBlur), also delete existing derived plans and recreate them with the new percentage

**2. Prices Page (`src/pages/pms/Prices.tsx`)**

Update the display to:
- Fetch `derived_rate_plan_mappings` alongside existing data
- For each base rate plan, show any derived plans below it as indented, read-only entries
- Each derived plan displays a colored badge: "Booking.com (+18%)" in blue
- Show the calculated sell rates: "Sell: $127 wkday / $145 wknd"
- Add an info note: "Auto-calculated from base rate + 18% markup"
- Derived plans have no edit/delete buttons (they are managed via Channel Markup page)

**3. Auto-Create on New Base Rate Plan**

In `Prices.tsx` `handleSave`:
- After creating a new base rate plan, check for active channel markups
- For each active channel, call the `channex-create-derived-rate-plan` edge function
- This ensures new base plans automatically get derived plans for all configured channels

**4. Auto-Delete Derived Plans on Base Plan Delete**

In `Prices.tsx` `confirmDelete`:
- Before deleting a base rate plan, look up derived mappings for that plan
- Call `channex-delete-derived-rate-plan` for each derived mapping
- Then proceed with the base plan deletion

### Technical Details

**ChannelMarkup.tsx changes:**
- `addChannel()`: After successful insert, query back the new row's ID, then call `createDerivedPlansForChannel(newId)`
- `updateMarkup()`: After updating the percentage, delete all existing derived plans for that channel, then recreate them with the new percentage

**Prices.tsx changes:**
- Add `derivedMappings` state fetched from `derived_rate_plan_mappings`
- In the render loop, after each base plan card, render derived plan entries filtered by `base_rate_plan_id`
- Derived entries use a lighter background, indentation, and blue badge
- `handleSave()` (create path): After creating the rate plan, loop through `channelMarkups` and invoke `channex-create-derived-rate-plan` for each
- `confirmDelete()`: Before deleting, fetch derived mappings for the plan ID and invoke `channex-delete-derived-rate-plan` for each

**Files modified:**
- `src/pages/pms/ChannelMarkup.tsx` -- Auto-create on add, auto-recreate on markup change
- `src/pages/pms/Prices.tsx` -- Show derived plans, auto-create/delete lifecycle

No new files, no database changes, no new edge functions needed.

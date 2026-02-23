

## Replace Channel Name Text Input with Searchable Dropdown

### Overview

Since the Channex Channel API is restricted to Whitelabel accounts, we cannot fetch OTA lists dynamically. Instead, we will use a searchable dropdown with the 20 most common OTAs as a hardcoded list, and store a normalized channel code alongside the display name.

### Changes

**File: `src/pages/pms/ChannelMarkup.tsx`**

1. **Add OTA channel list constant** at the top of the file with 20 entries, each having a `label` (display name) and `value` (normalized code):
   ```
   Booking.com, Expedia, Airbnb, Agoda, Hotels.com, TripAdvisor,
   Vrbo, Hostelworld, Trip.com, Hotelbeds, HRS, Despegar,
   Rakuten Travel, MakeMyTrip, Traveloka, Webjet, Lastminute.com,
   Laterooms, CTrip, Wotif
   ```

2. **Replace the free text `Input`** (lines 293-299) with a `Popover` + `Command` searchable dropdown (using existing `cmdk`-based components already in the project)

3. **Filter out already-added channels** from the dropdown options by checking `channels` state against existing entries

4. **Store channel_id** in the database insert: when a channel is selected, store the normalized code in the `channel_id` column (already exists in `channel_markup_settings` table)

5. **Update state**: Replace `newChannelName` string state with a selected channel object containing both `label` and `value`

### UI Behavior

- Clicking the dropdown opens a popover with a search input and filtered list
- Typing filters the list (e.g., "book" shows "Booking.com")
- Already-added channels are excluded from the list
- Selected channel name displays in the trigger button
- Markup percentage input and Add Channel button remain unchanged

### Technical Details

- Uses existing `Command`, `CommandInput`, `CommandItem`, `CommandEmpty`, `CommandGroup`, `CommandList` from `src/components/ui/command.tsx`
- Uses existing `Popover`, `PopoverTrigger`, `PopoverContent` from `src/components/ui/popover.tsx`
- No new dependencies, no database changes, no new edge functions
- Single file modified: `src/pages/pms/ChannelMarkup.tsx`

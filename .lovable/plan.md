

## Update Stay Extension Feature: "Extend Again" with Multiple Extensions

This update transforms the extension management from single-extension to multi-extension support, allowing guests to extend their stay repeatedly with proper tracking and display.

---

### Overview of Changes

**5 areas of work:**

1. Add "Extend Again" button to the extension card
2. Fetch and display all sibling extensions in the modal
3. Update the extension creation logic for sequential numbering and price floor
4. Update calendar rendering to handle EXT2, EXT3, etc.
5. Update extension detection logic throughout the component

---

### 1. Extension Detection Update

Currently, the code checks `booking_reference?.endsWith("-EXT")` to detect extensions. This needs to change to also match `-EXT2`, `-EXT3`, etc.

**File: `src/components/ReservationQuickActions.tsx`**

- Change `isExtension` check from `endsWith("-EXT")` to a regex: `/\-EXT\d*$/` (matches `-EXT`, `-EXT2`, `-EXT3`, etc.)
- Similarly update `fetchExtensionUnitDetails` which checks `endsWith("-EXT")`
- Extract the base booking reference by stripping the `-EXT`, `-EXT2`, etc. suffix

---

### 2. Fetch All Sibling Extensions

When the modal opens for an extension reservation, fetch all extensions linked to the same `group_id`.

**File: `src/components/ReservationQuickActions.tsx`**

- Add new state: `siblingExtensions` (array of extension reservations sorted by check-in date)
- In `fetchFullReservation` (or a new effect), when `isExtension` is true, query all reservations with the same `group_id` whose `booking_reference` matches the `-EXT` pattern
- This gives us Extension 1, Extension 2, etc. to display in the card

---

### 3. Multi-Extension Display in the Blue Card

Replace the single extension total display with a list of all extensions.

**File: `src/components/ReservationQuickActions.tsx`** (lines 1110-1224)

The blue extension card will show:
- Each extension listed as: "Extension 1: Feb 18 - Feb 22 (4 nights) -- $373.92"
- "Extension 2: Feb 22 - Feb 26 (4 nights) -- $XXX.XX"
- Combined "Extension Total" at the bottom summing all extensions
- "Extend Again" button below the last extension

---

### 4. "Extend Again" Button and Form

**File: `src/components/ReservationQuickActions.tsx`**

- Add new state: `extendAgainMode` (boolean)
- When "Extend Again" is clicked, show the same extension form (reuse the existing extend mode UI) with these pre-fills:
  - Check-in date: automatically set to the LAST extension's check-out date (not editable, displayed as "Current Checkout")
  - Price/Night: pre-filled with the FIRST extension's nightly rate (`first_ext.total_price / first_ext.nights`)
  - Minimum price validation: the entered price cannot be lower than the first extension's nightly rate
  - Room, guest name, etc.: carried over from the current extension
- The form submit logic (`handleExtendStay`) needs updating:
  - Count existing extensions to determine the suffix number
  - First extension: `-EXT`, second: `-EXT2`, third: `-EXT3`
  - The base booking reference is extracted by stripping all `-EXT*` suffixes
  - Use the same `group_id` as the existing extensions

---

### 5. Reference Numbering Logic

**File: `src/components/ReservationQuickActions.tsx`**

When creating a new extension from "Extend Again":
- Count how many `-EXT*` reservations exist in the group
- If 0 existing extensions: suffix is `-EXT` (first extension, unchanged)
- If 1 existing: suffix is `-EXT2`
- If N existing: suffix is `-EXT{N+1}`
- Base reference is derived from the original booking (strip any existing `-EXT*` suffix)

---

### 6. Calendar Display Updates

**File: `src/components/RoomCalendar.tsx`**

- Update the extension detection logic (lines 215-223) to handle `-EXT2`, `-EXT3`, etc. using regex instead of exact string matching
- The current logic checks if one booking reference equals the other plus `-EXT`. Update to check the general pattern where both share the same base reference and one has any `-EXT*` suffix
- Add a small label overlay on extension cells showing "EXT", "EXT2", "EXT3" to differentiate them visually

**File: `src/components/WeeklyCalendar.tsx`**

- Apply the same extension detection regex update if it has similar logic

---

### 7. Price Floor Validation

**File: `src/components/ReservationQuickActions.tsx`**

In the "Extend Again" form:
- Calculate the first extension's nightly rate: `firstExtension.total_price / firstExtensionNights` (where nights = differenceInCalendarDays between check-out and check-in)
- Divide by 1.14 first to get the net rate (since total_price includes VAT)
- Add validation on the price input: if entered value is less than the first extension's net nightly rate, show error "Rate cannot be lower than the previous extension rate of $XX.XX/night"
- Disable the "Confirm Extension" button when the price is below the floor

---

### Technical Details

**Files to modify:**

| File | Changes |
|------|---------|
| `src/components/ReservationQuickActions.tsx` | Extension detection regex, sibling extensions fetch, multi-extension display, "Extend Again" form with price floor validation, sequential reference numbering |
| `src/components/RoomCalendar.tsx` | Update extension detection regex, add EXT2/EXT3 labels on calendar cells |
| `src/components/WeeklyCalendar.tsx` | Update extension detection if applicable |

**No database changes required** -- the existing schema supports multiple extensions via `group_id` linking and flexible `booking_reference` text field.

**No edge function changes** -- the existing `send-extension-notification` function works with any booking reference format.


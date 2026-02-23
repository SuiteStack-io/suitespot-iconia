

## Remove Guest Type from Main Guest Details

### Overview

Since the main guest is always an adult, the Guest Type radio button (Adult/Child) is unnecessary and should be removed. The gender field should always show (no longer conditional on guest type being "adult").

### Changes -- File: `src/components/CreateReservationDialog.tsx`

**1. Remove the Guest Type radio group (lines 1620-1642)**

Delete the entire "Guest Type" section containing the Adult/Child radio buttons.

**2. Make Gender field always visible (line 1644)**

Remove the `{guestTypes[0] === 'adult' && (` conditional wrapper around the Gender section. Gender should always display since the main guest is always an adult.

**3. Hardcode guest type to "adult" in submission**

Ensure that `guestTypes[0]` is always set to `'adult'` -- either by setting it on initialization/reset and never changing it, or by hardcoding `'adult'` in the submission logic where `guest_types` is built.

**4. Remove guest type validation**

If there is any validation checking that guest type is selected, remove it since it will always be "adult".


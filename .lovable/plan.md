

## Add Country Code Selection to Phone Fields

### Approach
Create a reusable `PhoneInput` component that combines a country code dropdown with a phone number input field, then apply it to the PropertyForm (the form shown in the screenshot).

### New Component: `src/components/ui/phone-input.tsx`
- A composite input with a Select dropdown for country code (flag + dial code) on the left, and a standard text input for the number on the right
- Common country codes: Egypt (+20), UAE (+971), Saudi Arabia (+966), US (+1), UK (+44), France (+33), Germany (+49), Jordan (+962), Lebanon (+961), Morocco (+212)
- Props: `value` (full phone string like "+201003901516"), `onChange`, `placeholder`
- On change, combines the selected dial code with the local number into a single string
- Parses existing values to auto-detect the country code on mount

### Modified File: `src/components/settings/PropertyForm.tsx`
- Replace the two phone `<Input>` fields (lines 235 and 265) with the new `<PhoneInput>` component
- No changes to the data model -- the phone field still stores a single string like "+201003901516"

### Design
- Matches the existing input styling (h-10, rounded-md, border)
- Country code selector as a compact dropdown on the left side of the input
- Shows country flag emoji + dial code in the trigger


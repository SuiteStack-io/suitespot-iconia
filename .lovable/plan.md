

## Adjust Stepper Increments on Business Settings Inputs

### File
`src/components/settings/PropertyForm.tsx`

### Changes
- **VAT Rate input** (line 489): change `step="0.01"` → `step="1"`.
- **Default Commission Rate input** (line 505): change `step="0.01"` → `step="0.5"`.

Manual typing of any decimal value remains allowed (browsers only enforce `step` on the up/down arrows when the field is otherwise valid; users can still type "5.02" directly). Save logic, layout, validation, and other inputs are unchanged.

### Verification
1. Open Edit Property → Step 3 → Business Settings.
2. Click the up arrow on VAT Rate: 14 → 15 → 16. Down: 14 → 13.
3. Click the up arrow on Default Commission Rate: 5.00 → 5.50 → 6.00. Down: 5.00 → 4.50.
4. Manually typing `5.02` into Commission Rate still works and saves correctly.


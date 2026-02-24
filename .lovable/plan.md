

## Guests Page Enhancements

### 1. Add Selection Checkboxes to Guest Table

- Add `selectedGuests` state (`Set<string>`) tracking selected row keys
- Add a checkbox column as the first column in the table header (select all / deselect all)
- Add a checkbox in each table row (first cell)
- Update `exportToCSV` to export only selected guests when any are selected, otherwise export all filtered guests
- Show a count of selected guests near the export button (e.g., "3 selected")

### 2. Move Survey Trigger to Top Bar as Button

- Remove the `<SurveyTrigger />` component and its `<div className="mt-6">` wrapper from the bottom of the page
- Remove the `SurveyTrigger` import
- Add inline survey trigger logic directly in the Guests page: a "Send Surveys" button with a loading state that invokes `send-checkout-surveys`, placed in the top header bar to the left of the "Export CSV" button
- Use the `Mail` icon from lucide-react for the button

### Technical Changes

**File: `src/pages/Guests.tsx`**

- Add state: `selectedGuests` (Set), `surveyLoading` (boolean)
- Import `Checkbox` from `@/components/ui/checkbox` and `Mail` from lucide-react
- Remove `SurveyTrigger` import
- Header buttons area (line ~426-429): Add "Send Surveys" button before "Export CSV" button, wrapped in a `flex gap-2`
- Table header (line ~561): Add `<TableHead>` with select-all checkbox as first column
- Table body rows (line ~594): Add `<TableCell>` with individual checkbox as first cell
- Update `colSpan` on empty state from 14 to 15
- Modify `exportToCSV` to use selected guests when selection is non-empty
- Remove lines 672-674 (SurveyTrigger card at bottom)

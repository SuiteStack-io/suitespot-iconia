

## Move Survey Trigger to Guests Page & Clean Up Settings

### Changes

**1. `src/pages/Guests.tsx`** -- Add `SurveyTrigger` component
- Import `SurveyTrigger` from `@/components/SurveyTrigger`
- Place it below the guest table, after the closing `</div>` of the `bg-card` container (around line 670), so it appears as a card at the bottom of the Guests page

**2. `src/pages/Settings.tsx`** -- Strip down to empty shell
- Remove the `SurveyTrigger` import and usage
- Remove the `syncLogs` state, `fetchSyncLogs` function, and the entire Sync History card
- Remove unused imports (`Activity`, `Badge`, `formatDistanceToNow`, `Card*`, `SurveyTrigger`)
- Keep the page layout (header, back button, SlideMenu, auth check) with an empty `space-y-6` container and a placeholder message like "No settings configured yet"

| File | Change |
|------|--------|
| `src/pages/Guests.tsx` | Add `SurveyTrigger` card below the guest table |
| `src/pages/Settings.tsx` | Remove SurveyTrigger and Sync History; leave empty settings shell |




## Fix: Suites page dependency array bug

### Change — `src/pages/Suites.tsx`, line 111

Change the `useEffect` dependency array from `[toast]` to `[toast, defaultPropertyId]` so the unit fetch re-triggers once the default property ID is resolved.

This is a one-line fix that resolves the perpetual loading spinner.


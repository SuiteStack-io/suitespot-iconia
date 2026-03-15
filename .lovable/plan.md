

## Filter Guest Inbox by Active Property

The `fetchThreads` query currently fetches all `message_threads` without filtering by `property_id`. It needs to use the active property from `PropertyContext`.

### Changes in `src/pages/GuestInbox.tsx`

1. Import `usePropertyId` from `@/hooks/usePropertyFilter`
2. Get `propertyId` via `usePropertyId()`
3. Add `.eq('property_id', propertyId)` to the query when `propertyId` is not null
4. Add `propertyId` to the `useCallback` dependency array so threads re-fetch on property switch
5. Filter the realtime subscription to only listen for changes matching the active property: `filter: 'property_id=eq.' + propertyId`


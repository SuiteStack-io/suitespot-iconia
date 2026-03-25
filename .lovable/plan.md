

## Show trash button for property deletion

### Problem
The `canDeleteProperty` flag from the property context depends on the user's role for the **active** property. Even though you're now `owner` on the default property, the role fetch may be returning null because admin/system-admin users bypass `user_property_access` in the properties query — meaning no access record is found, so `propertyRole` stays null.

### Fix — `src/components/settings/PropertyList.tsx`

**Line 176**: Change the delete button condition from using the context's `canDeleteProperty` (which is tied to the active property) to using the same `canEdit` check already used for the other action buttons:

```tsx
// Before
{canDeleteProperty && !property.is_default && (

// After
{canEdit && !property.is_default && (
```

This aligns the delete button visibility with the edit, users, and toggle buttons — all gated by `canEdit` (`isSystemAdmin || userRole === 'admin'`). The confirmation dialog and reservation-count guard still protect against accidental deletion.

### What stays the same
- Delete confirmation dialog (type property name)
- Reservation check preventing deletion of properties with bookings
- Default property cannot be deleted


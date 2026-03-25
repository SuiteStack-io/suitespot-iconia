

## Update your property role to "owner"

### Single change
Update the `user_property_access` record for your user (`7737ccd3-...`) on the default property (`c98a2256-...`) from `admin` to `owner`.

This will also fix the missing trash icon issue, since `canDeleteProperty` checks for `owner` or `isSystemAdmin` roles via the property context.

### Technical detail
- Table: `user_property_access`
- Record ID: `e298ce92-160e-436b-94de-5dec86e4dc86`
- Change: `role` from `admin` → `owner`
- Method: SQL UPDATE via insert tool


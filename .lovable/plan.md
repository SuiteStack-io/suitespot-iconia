

## Update Ahmed Magdy's Property Role

### Current State
- **Ahmed Magdy** (`7737ccd3-...`) has `owner` role in `user_property_access` (record ID: `e298ce92-160e-436b-94de-5dec86e4dc86`)
- **Youssef Noureldin** (`d540b87e-...`) has no `user_property_access` record yet

### Changes Required

Two data operations (no schema changes):

1. **Update Ahmed's role** from `owner` to `admin` in the `user_property_access` table
2. **Insert Youssef as owner** in `user_property_access` for the ICONIA Zamalek property (`c98a2256-1787-47a4-bf0f-61942b4e87d5`)
3. **Set Youssef as system admin** (`is_system_admin = true` in `profiles`) and remove Ahmed's system admin flag

### SQL Statements
```sql
-- 1. Downgrade Ahmed from owner to admin
UPDATE user_property_access SET role = 'admin' WHERE id = 'e298ce92-160e-436b-94de-5dec86e4dc86';

-- 2. Add Youssef as owner
INSERT INTO user_property_access (user_id, property_id, role, granted_by)
VALUES ('d540b87e-f856-4ef1-9193-2fb077366ef9', 'c98a2256-1787-47a4-bf0f-61942b4e87d5', 'owner', 'd540b87e-f856-4ef1-9193-2fb077366ef9');

-- 3. Make Youssef system admin
UPDATE profiles SET is_system_admin = true WHERE id = 'd540b87e-f856-4ef1-9193-2fb077366ef9';

-- 4. Remove Ahmed's system admin flag
UPDATE profiles SET is_system_admin = false WHERE id = '7737ccd3-87e3-4b61-bfe5-b2d05bd0304c';
```

No frontend code changes needed.


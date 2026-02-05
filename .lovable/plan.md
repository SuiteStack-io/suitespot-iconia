

## Create channex-create-property Edge Function

### Overview

This function will create a property in Channex by taking your local property ID, looking it up in your database, transforming the data to Channex's format, and sending it to the Channex API.

---

### Contact Details (from your input)

| Field | Value |
|-------|-------|
| Email | youssef@suitespotegypt.com |
| Phone | +201288444086 |
| Zip Code | 11211 |

---

### How It Works

```text
1. Receive POST request with property_id
                │
                ▼
2. Authenticate user (admin only)
                │
                ▼
3. Look up property from 'units' table
                │
                ▼
4. Check if already mapped to Channex
   (prevent duplicate creation)
                │
                ▼
5. Transform data to Channex format
                │
                ▼
6. POST to Channex /api/v1/properties
                │
        ┌───────┴───────┐
        ▼               ▼
   SUCCESS           FAILURE
        │               │
        ▼               ▼
7a. Save mapping    7b. Log error
    to channex_         and return
    mappings           error message
        │
        ▼
8. Log sync and return Channex ID
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/channex-create-property/index.ts` | Create new edge function |
| `supabase/config.toml` | Add function configuration |

---

### Request Format

```json
{
  "property_id": "uuid-of-your-local-property"
}
```

---

### Response Format

**Success:**
```json
{
  "success": true,
  "channex_property_id": "channex-uuid-here",
  "message": "Property created successfully in Channex"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error description here"
}
```

---

### Data Transformation

| Your Field (units) | Channex Field | Value/Source |
|-------------------|---------------|--------------|
| `name` | `title` | From database |
| `location` | `city` | From database (default: "Cairo") |
| `address` | `address` | From database |
| `latitude` | `latitude` | From database |
| `longitude` | `longitude` | From database |
| `map_description` | `content.description` | From database |
| - | `currency` | "EGP" (Egyptian Pound) |
| - | `country` | "EG" (Egypt) |
| - | `timezone` | "Africa/Cairo" (handles DST) |
| - | `email` | youssef@suitespotegypt.com |
| - | `phone` | +201288444086 |
| - | `zip_code` | 11211 |

---

### Technical Details

**Authentication:**
- Validates JWT in code (verify_jwt = false in config for better error messages)
- Only admins can sync properties to Channex
- Uses `supabase.auth.getUser()` to verify the caller

**Error Handling:**
- Returns 401 if no authorization header
- Returns 401 if invalid/expired token
- Returns 403 if user is not an admin
- Returns 400 if no property_id provided
- Returns 404 if property not found in database
- Returns 409 if property already mapped to Channex
- Returns 502 if Channex API fails
- All errors are logged to `channex_sync_logs`

**Database Operations:**
- Reads from `units` table to get property data
- Checks `channex_mappings` for existing mapping (entity_type = 'property')
- Inserts new mapping on success with sync_status = 'synced'
- Logs all operations to `channex_sync_logs`

---

### Config Addition

```toml
[functions.channex-create-property]
verify_jwt = false
```


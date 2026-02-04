

## Channex Integration - Database Structure

### Overview

Create three new database tables to support Channex channel manager integration, enabling mapping between your PMS entities and Channex, logging all API interactions, and storing incoming OTA bookings.

---

### Database Tables

#### 1. channex_mappings

Maps your internal PMS records (units, rate_plans) to their Channex counterparts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| entity_type | text | NOT NULL | 'property', 'room_type', or 'rate_plan' |
| local_id | uuid | NOT NULL | References your internal PMS record |
| channex_id | text | NOT NULL | The ID from Channex API |
| channex_data | jsonb | | Full response from Channex for reference |
| sync_status | text | NOT NULL, DEFAULT 'pending' | 'pending', 'synced', 'error' |
| last_synced_at | timestamptz | | Last successful sync time |
| error_message | text | | Error details if sync failed |
| created_at | timestamptz | DEFAULT now() | Record creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |

**Indexes:**
- Unique constraint on (entity_type, local_id)
- Unique constraint on (entity_type, channex_id)
- Index on sync_status for filtering

---

#### 2. channex_sync_logs

Tracks all Channex API calls for debugging and auditing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| function_name | text | NOT NULL | Edge function that made the call |
| endpoint | text | NOT NULL | Channex API endpoint called |
| request_payload | jsonb | | Request body sent to Channex |
| response_payload | jsonb | | Response from Channex |
| status_code | integer | | HTTP status code |
| success | boolean | NOT NULL | Whether the call succeeded |
| error_message | text | | Error details if failed |
| property_id | uuid | | Reference to units table |
| created_at | timestamptz | DEFAULT now() | When the call was made |

**Foreign Keys:**
- property_id references units(id) ON DELETE SET NULL

---

#### 3. channex_bookings

Stores incoming OTA bookings received from Channex webhooks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| channex_booking_id | text | NOT NULL, UNIQUE | Channex booking identifier |
| channex_revision_id | text | | Revision ID for modifications |
| ota_name | text | NOT NULL | Source OTA (Booking.com, Airbnb, etc.) |
| ota_reservation_code | text | | OTA's reservation code |
| property_id | uuid | NOT NULL | References units table |
| room_type_id | uuid | | References units table (room type) |
| rate_plan_id | uuid | | References rate_plans table |
| status | text | NOT NULL, DEFAULT 'new' | 'new', 'modified', 'cancelled' |
| guest_name | text | NOT NULL | Guest's full name |
| guest_email | text | NOT NULL | Guest's email |
| guest_phone | text | | Guest's phone number |
| guest_country | text | | Guest's country |
| arrival_date | date | NOT NULL | Check-in date |
| departure_date | date | NOT NULL | Check-out date |
| adults | integer | NOT NULL, DEFAULT 1 | Number of adults |
| children | integer | NOT NULL, DEFAULT 0 | Number of children |
| total_amount | decimal(10,2) | NOT NULL | Total booking amount |
| currency | text | NOT NULL, DEFAULT 'USD' | Currency code |
| booking_data | jsonb | | Full booking payload from Channex |
| acknowledged | boolean | NOT NULL, DEFAULT false | Whether booking was processed |
| created_at | timestamptz | DEFAULT now() | Record creation time |
| updated_at | timestamptz | DEFAULT now() | Last update time |

**Foreign Keys:**
- property_id references units(id) ON DELETE RESTRICT
- room_type_id references units(id) ON DELETE SET NULL
- rate_plan_id references rate_plans(id) ON DELETE SET NULL

---

### Row-Level Security Policies

All three tables will have RLS enabled with the following policies:

**channex_mappings:**
- Admins can perform all operations (SELECT, INSERT, UPDATE, DELETE)
- Managers can view and update mappings

**channex_sync_logs:**
- Admins can view all logs
- System can insert logs (for edge functions)

**channex_bookings:**
- Admins can perform all operations
- Managers and front desk can view bookings
- System can insert and update (for webhooks)

---

### Database Trigger

Add an `updated_at` trigger for both `channex_mappings` and `channex_bookings` tables using the existing `update_updated_at_column()` function.

---

### SQL Migration Summary

```text
-- Tables Created:
1. channex_mappings (10 columns)
2. channex_sync_logs (10 columns)
3. channex_bookings (21 columns)

-- Indexes Created:
- channex_mappings: unique on (entity_type, local_id)
- channex_mappings: unique on (entity_type, channex_id)
- channex_mappings: index on sync_status
- channex_bookings: unique on channex_booking_id
- channex_bookings: index on status
- channex_bookings: index on acknowledged

-- RLS Policies: 9 total policies across 3 tables

-- Triggers: 2 for updated_at timestamps
```

---

### Entity Relationship

```text
units (properties/rooms)
  ├── channex_mappings.local_id (when entity_type = 'property' or 'room_type')
  ├── channex_sync_logs.property_id
  └── channex_bookings.property_id / room_type_id

rate_plans
  ├── channex_mappings.local_id (when entity_type = 'rate_plan')
  └── channex_bookings.rate_plan_id
```


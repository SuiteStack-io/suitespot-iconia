-- Fix 1: Correct the ICONIA Zamalek property mapping
UPDATE channex_mappings 
SET local_id = 'c98a2256-1787-47a4-bf0f-61942b4e87d5',
    updated_at = now()
WHERE channex_id = '67a25d0e-c251-4ae7-8070-79fbf7c4154f'
  AND entity_type = 'property';

-- Fix 2: Reset failed queue items caused by this mismatch
UPDATE channex_sync_queue 
SET status = 'pending', error_message = NULL
WHERE status = 'failed' 
  AND error_message = 'No property mapped to Channex';
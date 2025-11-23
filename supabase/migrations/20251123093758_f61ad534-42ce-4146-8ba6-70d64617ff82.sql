-- Add photo_urls array column to support multiple photos per ticket
ALTER TABLE guest_tickets 
ADD COLUMN photo_urls text[] DEFAULT '{}';

-- Copy existing photo_url data to photo_urls array
UPDATE guest_tickets 
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL;

-- We'll keep photo_url for backward compatibility but it's now deprecated
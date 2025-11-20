-- Update property-photos bucket to 50MB
UPDATE storage.buckets
SET file_size_limit = 52428800
WHERE id = 'property-photos';

-- Update property-documents bucket to 10MB
UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'property-documents';
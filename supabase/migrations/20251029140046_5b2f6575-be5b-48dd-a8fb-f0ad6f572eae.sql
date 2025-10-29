-- Update 'admin booking' to 'admin'
UPDATE reservations
SET source = 'admin'
WHERE source = 'admin booking';
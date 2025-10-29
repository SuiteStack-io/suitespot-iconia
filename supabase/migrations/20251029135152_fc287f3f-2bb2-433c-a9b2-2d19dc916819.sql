-- Update Eng. Karim bookings to admin source
UPDATE reservations 
SET source = 'admin booking'
WHERE 'Eng. Karim' = ANY(guest_names) OR 'Eng Karim' = ANY(guest_names);
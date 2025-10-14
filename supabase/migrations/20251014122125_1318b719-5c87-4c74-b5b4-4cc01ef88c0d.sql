-- Update units table structure to include additional details
ALTER TABLE public.units 
  ADD COLUMN IF NOT EXISTS unit_number TEXT,
  ADD COLUMN IF NOT EXISTS unit_type TEXT,
  ADD COLUMN IF NOT EXISTS unit_size TEXT,
  ADD COLUMN IF NOT EXISTS availability_date DATE,
  ADD COLUMN IF NOT EXISTS comments TEXT;

-- Clear ALL existing units and reservations
TRUNCATE TABLE public.units CASCADE;
DELETE FROM public.reservations;

-- Update the status check constraint for units
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_status_check;
ALTER TABLE public.units ADD CONSTRAINT units_status_check 
  CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved'));

-- Update the status check constraint for reservations to include 'confirmed'
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE public.reservations ADD CONSTRAINT reservations_status_check 
  CHECK (status IN ('confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out'));

-- Insert the hotel rooms
INSERT INTO public.units (unit_number, name, unit_type, unit_size, status, availability_date, comments) VALUES
  ('502', 'Room 502', '1bd + Balcony', '52m2+25m2', 'available', '2025-07-10', NULL),
  ('504', 'Room 504', '1bd + Balcony', '55m2+25m2', 'available', '2025-07-10', 'Reserved for Eng. Karim (04/11–09/11)'),
  ('505', 'Room 505', '1bd + Balcony', '55m2+25m2', 'available', '2025-07-10', 'Reserved for Eng. Karim (07/11–09/11)'),
  ('506', 'Room 506', '1bd Large', '75 m2', 'available', '2025-07-10', 'Reserved for Eng. Karim (07/11–09/11)'),
  ('509', 'Room 509', '1bd Large', '75 m2', 'available', '2025-07-10', 'Reserved for Eng. Karim (04/11–09/11)');

-- Insert Eng. Karim's reservations with unique booking references
INSERT INTO public.reservations (
  unit_id, 
  check_in_date, 
  check_out_date, 
  guest_names, 
  number_of_guests,
  status,
  booking_reference,
  channel,
  notes
) 
SELECT 
  u.id,
  check_in::date,
  check_out::date,
  ARRAY['Eng. Karim'],
  1,
  'confirmed',
  'EK-' || u.unit_number || '-' || TO_CHAR(check_in::date, 'MMDD'),
  'Direct',
  'Engineering staff reservation'
FROM public.units u
CROSS JOIN (
  VALUES 
    ('504', '2025-11-04', '2025-11-09'),
    ('505', '2025-11-07', '2025-11-09'),
    ('506', '2025-11-07', '2025-11-09'),
    ('509', '2025-11-04', '2025-11-09')
) AS bookings(unit_number, check_in, check_out)
WHERE u.unit_number = bookings.unit_number;
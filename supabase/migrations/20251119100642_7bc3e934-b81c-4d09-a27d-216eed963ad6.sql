-- Drop unique constraint from booking_com_id to allow multiple units with same Room ID
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_booking_com_id_key;

-- Keep the index for performance but without uniqueness
DROP INDEX IF EXISTS idx_units_booking_com_id;
CREATE INDEX idx_units_booking_com_id ON public.units(booking_com_id) WHERE booking_com_id IS NOT NULL;

-- Update comment to reflect that multiple units can share the same ID
COMMENT ON COLUMN public.units.booking_com_id IS 'Booking.com Room Type ID - multiple units can share the same ID if they are the same room type';

-- Add database function to get all units for a Booking.com Room ID
CREATE OR REPLACE FUNCTION get_units_by_booking_com_room_id(p_room_id TEXT)
RETURNS TABLE (
  id UUID,
  unit_number TEXT,
  name TEXT,
  status TEXT,
  last_allocated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.unit_number,
    u.name,
    u.status,
    u.last_allocated_at
  FROM units u
  WHERE u.booking_com_id = p_room_id
    AND u.status != 'maintenance'
  ORDER BY u.last_allocated_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;
-- Create function to update reservation status on check-in (bypasses RLS for anonymous users)
CREATE OR REPLACE FUNCTION public.update_reservation_status_on_checkin(
  p_reservation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agreement_exists BOOLEAN;
  v_current_status TEXT;
BEGIN
  -- Check if a check-in agreement exists for this reservation
  SELECT EXISTS(
    SELECT 1 FROM check_in_agreements WHERE reservation_id = p_reservation_id
  ) INTO v_agreement_exists;
  
  IF NOT v_agreement_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Get current reservation status
  SELECT status INTO v_current_status
  FROM reservations
  WHERE id = p_reservation_id;
  
  -- Only update if currently confirmed (prevent duplicate check-ins)
  IF v_current_status = 'confirmed' THEN
    UPDATE reservations
    SET status = 'checked-in',
        checked_in_at = NOW()
    WHERE id = p_reservation_id;
    
    RETURN TRUE;
  END IF;
  
  -- Already checked in or other status
  RETURN TRUE;
END;
$$;
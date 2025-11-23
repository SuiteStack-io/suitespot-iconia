-- Fix security warning: Add search_path to check_max_guest_accounts function
CREATE OR REPLACE FUNCTION check_max_guest_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO account_count
  FROM guest_accounts
  WHERE reservation_id = NEW.reservation_id;
  
  IF account_count >= 4 THEN
    RAISE EXCEPTION 'Cannot create more than 4 guest accounts per reservation';
  END IF;
  
  RETURN NEW;
END;
$$;
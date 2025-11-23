-- Remove unique constraint on reservation_id to allow multiple guest accounts per reservation
-- First, drop the existing foreign key constraint
ALTER TABLE guest_accounts DROP CONSTRAINT IF EXISTS guest_accounts_reservation_id_fkey;

-- Add the foreign key back without unique constraint
ALTER TABLE guest_accounts 
ADD CONSTRAINT guest_accounts_reservation_id_fkey 
FOREIGN KEY (reservation_id) 
REFERENCES reservations(id) 
ON DELETE CASCADE;

-- Add a check constraint to limit max 4 guest accounts per reservation
CREATE OR REPLACE FUNCTION check_max_guest_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
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

CREATE TRIGGER enforce_max_guest_accounts
  BEFORE INSERT ON guest_accounts
  FOR EACH ROW
  EXECUTE FUNCTION check_max_guest_accounts();

-- Create function to reset guest password
CREATE OR REPLACE FUNCTION reset_guest_password(
  p_account_id UUID,
  p_new_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can reset passwords
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reset guest passwords';
  END IF;
  
  UPDATE guest_accounts
  SET password_hash = p_new_password_hash
  WHERE id = p_account_id;
  
  RETURN FOUND;
END;
$$;
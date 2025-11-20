-- Create storage bucket for guest ticket photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guest-ticket-photos',
  'guest-ticket-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for guest ticket photos
CREATE POLICY "Authenticated users can upload ticket photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'guest-ticket-photos'
);

CREATE POLICY "Authenticated users can view ticket photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'guest-ticket-photos');

CREATE POLICY "Admins can delete ticket photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'guest-ticket-photos' AND
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add index for faster guest account lookups
CREATE INDEX IF NOT EXISTS idx_guest_accounts_username ON guest_accounts(username);
CREATE INDEX IF NOT EXISTS idx_guest_accounts_reservation ON guest_accounts(reservation_id);

-- Add function to generate guest username from reservation
CREATE OR REPLACE FUNCTION generate_guest_username(p_guest_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_username text;
  v_counter integer := 1;
  v_base_username text;
BEGIN
  -- Convert name to lowercase and replace spaces with underscores
  v_base_username := lower(regexp_replace(trim(p_guest_name), '\s+', '_', 'g'));
  v_username := v_base_username;
  
  -- Check if username exists, if so, append number
  WHILE EXISTS (SELECT 1 FROM guest_accounts WHERE username = v_username) LOOP
    v_username := v_base_username || '_' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;
  
  RETURN v_username;
END;
$$;

-- Add function to check if guest session is valid
CREATE OR REPLACE FUNCTION is_guest_session_valid(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout_date date;
BEGIN
  SELECT check_out_date INTO v_checkout_date
  FROM reservations
  WHERE id = p_reservation_id;
  
  -- Session valid until 1 day after checkout
  RETURN v_checkout_date IS NOT NULL AND 
         CURRENT_DATE <= (v_checkout_date + INTERVAL '1 day');
END;
$$;
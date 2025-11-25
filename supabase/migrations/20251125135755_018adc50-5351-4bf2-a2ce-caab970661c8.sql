-- Extend kyc_links table for accept/reject workflow
ALTER TABLE kyc_links ADD COLUMN outcome text DEFAULT NULL;
ALTER TABLE kyc_links ADD COLUMN outcome_at timestamp with time zone;
ALTER TABLE kyc_links ADD COLUMN outcome_by uuid REFERENCES profiles(id);

COMMENT ON COLUMN kyc_links.outcome IS 'Outcome of KYC review: accepted or rejected';

-- Create guest_inventory_access table
CREATE TABLE guest_inventory_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_link_id uuid REFERENCES kyc_links(id) ON DELETE CASCADE NOT NULL,
  unit_id uuid REFERENCES units(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(kyc_link_id, unit_id)
);

-- Enable RLS
ALTER TABLE guest_inventory_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_inventory_access
CREATE POLICY "Admins can manage inventory access"
ON guest_inventory_access
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view their assigned inventory"
ON guest_inventory_access
FOR SELECT
TO public
USING (true);

-- Create selection_accounts table for private landing page access
CREATE TABLE selection_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_link_id uuid REFERENCES kyc_links(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  landing_page_token text NOT NULL UNIQUE,
  first_access_at timestamp with time zone,
  session_expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

-- Enable RLS
ALTER TABLE selection_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policies for selection_accounts
CREATE POLICY "Admins can manage selection accounts"
ON selection_accounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view selection accounts for login"
ON selection_accounts
FOR SELECT
TO public
USING (true);

CREATE POLICY "System can update session info"
ON selection_accounts
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Create index for faster token lookups
CREATE INDEX idx_selection_accounts_token ON selection_accounts(landing_page_token);
CREATE INDEX idx_selection_accounts_username ON selection_accounts(username);
CREATE INDEX idx_guest_inventory_access_kyc ON guest_inventory_access(kyc_link_id);

COMMENT ON TABLE guest_inventory_access IS 'Tracks which properties are shown to each guest in their private selection';
COMMENT ON TABLE selection_accounts IS 'Login credentials for private property selection landing pages';
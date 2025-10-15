-- Add pricing and commission columns to reservations table
ALTER TABLE reservations 
ADD COLUMN price_per_night numeric,
ADD COLUMN commission_rate numeric DEFAULT 10.00,
ADD COLUMN commission_amount numeric,
ADD COLUMN net_revenue numeric;

-- Add comments for clarity
COMMENT ON COLUMN reservations.price_per_night IS 'Price per night in the specified currency';
COMMENT ON COLUMN reservations.commission_rate IS 'Commission percentage (e.g., 10.00 for 10%)';
COMMENT ON COLUMN reservations.commission_amount IS 'Calculated commission amount';
COMMENT ON COLUMN reservations.net_revenue IS 'Revenue after commission (total_price - commission_amount)';
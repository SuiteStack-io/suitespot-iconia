-- Extend rate_plans table with restriction columns
ALTER TABLE public.rate_plans 
ADD COLUMN IF NOT EXISTS cancellation_policy text DEFAULT 'flexible_1_day',
ADD COLUMN IF NOT EXISTS meal_plan text DEFAULT 'no_meals',
ADD COLUMN IF NOT EXISTS meal_plan_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS advance_booking_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS applicable_room_types text[] DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.rate_plans.cancellation_policy IS 'Options: flexible_1_day, non_refundable';
COMMENT ON COLUMN public.rate_plans.meal_plan IS 'Options: no_meals, breakfast, half_board, full_board';
COMMENT ON COLUMN public.rate_plans.meal_plan_price IS 'Price per person per night if meals included';
COMMENT ON COLUMN public.rate_plans.advance_booking_days IS 'Minimum days before check-in required to book';
COMMENT ON COLUMN public.rate_plans.applicable_room_types IS 'Array of room type names (null = all rooms)';

-- Create rate_plan_value_adds table
CREATE TABLE IF NOT EXISTS public.rate_plan_value_adds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  price numeric DEFAULT 0,
  is_per_night boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.rate_plan_value_adds ENABLE ROW LEVEL SECURITY;

-- RLS policies for rate_plan_value_adds
CREATE POLICY "Authenticated users can view value adds"
ON public.rate_plan_value_adds
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and managers can insert value adds"
ON public.rate_plan_value_adds
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins and managers can update value adds"
ON public.rate_plan_value_adds
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Admins and managers can delete value adds"
ON public.rate_plan_value_adds
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rate_plan_value_adds_rate_plan ON public.rate_plan_value_adds(rate_plan_id);
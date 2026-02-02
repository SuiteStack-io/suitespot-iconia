-- Create rate_plans table
CREATE TABLE public.rate_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rate_plan_prices table
CREATE TABLE public.rate_plan_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_plan_id UUID NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL,
  weekday_rate NUMERIC NOT NULL,
  weekend_rate NUMERIC NOT NULL,
  min_stay INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rate_plan_id, room_type)
);

-- Enable RLS
ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_plan_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for rate_plans (viewable by all authenticated, editable by admin/manager)
CREATE POLICY "Rate plans viewable by authenticated users" 
ON public.rate_plans FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Rate plans manageable by admin and manager" 
ON public.rate_plans FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- RLS policies for rate_plan_prices
CREATE POLICY "Rate plan prices viewable by authenticated users" 
ON public.rate_plan_prices FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Rate plan prices manageable by admin and manager" 
ON public.rate_plan_prices FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_rate_plans_updated_at
BEFORE UPDATE ON public.rate_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one default rate plan exists
CREATE OR REPLACE FUNCTION public.ensure_single_default_rate_plan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.rate_plans 
    SET is_default = false 
    WHERE id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER ensure_single_default_rate_plan_trigger
BEFORE INSERT OR UPDATE ON public.rate_plans
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_rate_plan();

-- Create a default rate plan with existing unit prices
INSERT INTO public.rate_plans (name, is_default, priority, is_active)
VALUES ('Standard Rate', true, 0, true);

-- Import existing prices from units table into the default rate plan
INSERT INTO public.rate_plan_prices (rate_plan_id, room_type, weekday_rate, weekend_rate, min_stay)
SELECT 
  (SELECT id FROM public.rate_plans WHERE is_default = true LIMIT 1),
  booking_com_name,
  COALESCE(AVG(price_per_night), 100),
  COALESCE(AVG(COALESCE(weekend_rate, price_per_night * 1.1)), 110),
  COALESCE(MIN(min_stay), 1)
FROM public.units
WHERE booking_com_name IS NOT NULL AND location = 'ICONIA'
GROUP BY booking_com_name;
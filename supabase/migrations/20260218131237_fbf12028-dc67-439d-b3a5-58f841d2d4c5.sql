
-- Step 1: Add room_type column to rate_plans
ALTER TABLE public.rate_plans ADD COLUMN room_type text;

-- Step 2: Drop the unique constraint on booking_com_id so multiple plans can share it or be null
DROP INDEX IF EXISTS idx_rate_plans_booking_com_id;

-- Step 3: Migrate existing data
DO $$
DECLARE
  old_plan RECORD;
  price_row RECORD;
  new_plan_id uuid;
BEGIN
  SELECT * INTO old_plan FROM rate_plans WHERE id = '403a15cf-93b4-4755-bc34-2f1a2eb9101a';
  
  IF old_plan IS NULL THEN
    RETURN;
  END IF;

  FOR price_row IN 
    SELECT * FROM rate_plan_prices 
    WHERE rate_plan_id = old_plan.id AND unit_id IS NULL
  LOOP
    INSERT INTO rate_plans (
      name, room_type, is_default, valid_from, valid_to, is_active, priority,
      cancellation_policy, booking_com_id, currency, sell_mode,
      extra_adult_rate, extra_child_rate, meal_plan, meal_plan_price,
      advance_booking_days, property_id
    ) VALUES (
      'Standard Rate - ' || price_row.room_type,
      price_row.room_type,
      true,
      old_plan.valid_from,
      old_plan.valid_to,
      true,
      old_plan.priority,
      old_plan.cancellation_policy,
      NULL,
      old_plan.currency,
      old_plan.sell_mode,
      old_plan.extra_adult_rate,
      old_plan.extra_child_rate,
      old_plan.meal_plan,
      old_plan.meal_plan_price,
      old_plan.advance_booking_days,
      old_plan.property_id
    )
    RETURNING id INTO new_plan_id;

    INSERT INTO rate_plan_prices (
      rate_plan_id, room_type, weekday_rate, weekend_rate, min_stay,
      base_occupancy, max_occupancy, unit_id
    ) VALUES (
      new_plan_id,
      price_row.room_type,
      price_row.weekday_rate,
      price_row.weekend_rate,
      price_row.min_stay,
      price_row.base_occupancy,
      price_row.max_occupancy,
      NULL
    );
  END LOOP;

  -- Deactivate the old combined plan
  UPDATE rate_plans 
  SET is_active = false, is_default = false, name = '[ARCHIVED] ' || old_plan.name
  WHERE id = old_plan.id;
  
END $$;

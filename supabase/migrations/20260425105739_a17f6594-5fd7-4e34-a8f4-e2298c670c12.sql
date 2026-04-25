UPDATE public.reservations
SET commission_rate  = 0,
    commission_amount = 0,
    net_revenue      = total_price
WHERE (notes ILIKE 'Late checkout fee for booking%' OR booking_reference ILIKE '%-LC')
  AND (commission_rate <> 0 OR commission_amount <> 0 OR net_revenue <> total_price);
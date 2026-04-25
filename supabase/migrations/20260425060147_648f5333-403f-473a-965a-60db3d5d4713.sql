ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS parent_reservation_id UUID
    REFERENCES public.reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_split_reservation BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reservations_parent
  ON public.reservations(parent_reservation_id)
  WHERE parent_reservation_id IS NOT NULL;
ALTER TABLE public.room_shuffle_log
ADD COLUMN change_type text NOT NULL DEFAULT 'automatic'
CHECK (change_type IN ('automatic', 'manual'));

UPDATE public.room_shuffle_log
SET change_type = 'manual'
WHERE reason LIKE 'Manual fix:%';

CREATE INDEX idx_room_shuffle_log_change_type
ON public.room_shuffle_log (change_type);
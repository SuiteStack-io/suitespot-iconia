ALTER TABLE public.user_permissions
ADD COLUMN IF NOT EXISTS can_delete_reservation boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_revenue boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_rooms boolean NOT NULL DEFAULT false;
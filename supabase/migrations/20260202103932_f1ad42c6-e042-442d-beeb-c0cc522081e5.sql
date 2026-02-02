-- Add PMS permission column to user_permissions table
ALTER TABLE public.user_permissions 
ADD COLUMN can_access_pms boolean NOT NULL DEFAULT false;
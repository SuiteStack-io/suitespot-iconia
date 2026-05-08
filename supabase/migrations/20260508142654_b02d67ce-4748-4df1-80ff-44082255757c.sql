-- Private bucket for database export dumps
INSERT INTO storage.buckets (id, name, public)
VALUES ('db-exports', 'db-exports', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins / super_admins may read export files
DROP POLICY IF EXISTS "Admins can read db exports" ON storage.objects;
CREATE POLICY "Admins can read db exports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'db-exports'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- Only admins / super_admins may delete (cleanup); writes happen via service role
DROP POLICY IF EXISTS "Admins can delete db exports" ON storage.objects;
CREATE POLICY "Admins can delete db exports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'db-exports'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);
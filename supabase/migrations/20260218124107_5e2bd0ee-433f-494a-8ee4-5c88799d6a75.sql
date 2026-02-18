
-- Add DELETE policy on channex_sync_logs for admins
CREATE POLICY "Admins can delete channex sync logs"
ON public.channex_sync_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add issue_type column to housekeeping_logs table
ALTER TABLE public.housekeeping_logs 
ADD COLUMN issue_type text;

-- Add a check constraint for valid issue types
ALTER TABLE public.housekeeping_logs 
ADD CONSTRAINT housekeeping_logs_issue_type_check 
CHECK (issue_type IS NULL OR issue_type IN ('TV broke', 'Sofa bed damaged', 'Bed damaged', 'Kitchen broke', 'Replacement needed'));
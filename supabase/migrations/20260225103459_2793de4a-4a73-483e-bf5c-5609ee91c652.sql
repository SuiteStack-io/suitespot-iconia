
-- Create whatsapp_message_templates table
CREATE TABLE public.whatsapp_message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  message_body TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  twilio_content_sid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create whatsapp_message_log table
CREATE TABLE public.whatsapp_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID REFERENCES public.reservations(id),
  guest_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  twilio_message_sid TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- RLS for templates: admin full access, authenticated SELECT
CREATE POLICY "Admins can manage message templates" ON public.whatsapp_message_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view templates" ON public.whatsapp_message_templates
  FOR SELECT USING (true);

-- RLS for log: admin full access, system INSERT
CREATE POLICY "Admins can manage message log" ON public.whatsapp_message_log
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert message log" ON public.whatsapp_message_log
  FOR INSERT WITH CHECK (true);

-- Enable realtime for message log
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_message_log;

-- Updated_at trigger for templates
CREATE TRIGGER update_whatsapp_message_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default templates
INSERT INTO public.whatsapp_message_templates (template_name, template_type, message_body) VALUES
  ('Welcome Message', 'welcome', 'Hello {{guest_name}}, welcome to {{property_name}}! We''re delighted to have you staying with us in our {{room_name}}. If you need anything during your stay, please don''t hesitate to reach out. Enjoy your time in Zamalek! — The SuiteSpot Team'),
  ('Mid-Stay Check-in', 'midstay', 'Hello {{guest_name}}, we hope you''re enjoying your stay at {{property_name}}! We wanted to check in and see if there''s anything we can do to make your experience even better. Don''t hesitate to let us know! — The SuiteSpot Team'),
  ('Checkout Thank You', 'checkout', 'Hello {{guest_name}}, thank you for staying with us at {{property_name}}! We hope you had a wonderful experience in our {{room_name}}. We''d love to welcome you back in the future. Safe travels! — The SuiteSpot Team');

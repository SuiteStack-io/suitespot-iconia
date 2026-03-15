
-- Create message_threads table
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channex_thread_id text UNIQUE NOT NULL,
  channex_booking_id text,
  property_id uuid REFERENCES public.properties(id),
  reservation_id uuid REFERENCES public.reservations(id),
  title text,
  provider text NOT NULL,
  is_closed boolean DEFAULT false,
  is_read boolean DEFAULT false,
  message_count integer DEFAULT 0,
  last_message_text text,
  last_message_sender text,
  last_message_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.message_threads(id) ON DELETE CASCADE NOT NULL,
  channex_message_id text UNIQUE,
  message text,
  sender text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  channex_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes on message_threads
CREATE INDEX idx_message_threads_property_id ON public.message_threads(property_id);
CREATE INDEX idx_message_threads_channex_booking_id ON public.message_threads(channex_booking_id);
CREATE INDEX idx_message_threads_is_read ON public.message_threads(is_read);
CREATE INDEX idx_message_threads_last_message_at ON public.message_threads(last_message_at DESC);

-- Indexes on messages
CREATE INDEX idx_messages_thread_created ON public.messages(thread_id, created_at);

-- Enable RLS
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_threads
CREATE POLICY "Authenticated users can select message_threads"
  ON public.message_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert message_threads"
  ON public.message_threads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update message_threads"
  ON public.message_threads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete message_threads"
  ON public.message_threads FOR DELETE TO authenticated USING (true);

-- RLS policies for messages
CREATE POLICY "Authenticated users can select messages"
  ON public.messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert messages"
  ON public.messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update messages"
  ON public.messages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete messages"
  ON public.messages FOR DELETE TO authenticated USING (true);

-- Allow service role (edge functions) to insert/update
CREATE POLICY "Service can insert message_threads"
  ON public.message_threads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can insert messages"
  ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update message_threads"
  ON public.message_threads FOR UPDATE USING (true);
CREATE POLICY "Service can update messages"
  ON public.messages FOR UPDATE USING (true);

-- Updated_at trigger on message_threads
CREATE TRIGGER update_message_threads_updated_at
  BEFORE UPDATE ON public.message_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live inbox updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;

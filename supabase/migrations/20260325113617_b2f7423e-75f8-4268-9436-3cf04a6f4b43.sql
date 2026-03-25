
CREATE TABLE public.room_type_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_name text NOT NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.unit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_type_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage room_type_photos"
  ON public.room_type_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage unit_photos"
  ON public.unit_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can read room_type_photos"
  ON public.room_type_photos FOR SELECT TO anon USING (true);

CREATE POLICY "Public can read unit_photos"
  ON public.unit_photos FOR SELECT TO anon USING (true);

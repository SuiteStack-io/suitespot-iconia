-- Create FAQ items table
CREATE TABLE public.faq_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view published FAQ items" ON public.faq_items
  FOR SELECT USING (is_published = true);

CREATE POLICY "Admins can manage all FAQ items" ON public.faq_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed initial FAQ data from current hardcoded items
INSERT INTO public.faq_items (question, answer, sequence_order, is_published) VALUES
('What is SuiteSpot?', 'SuiteSpot is a premium serviced apartment provider offering luxury accommodations in prime Cairo locations, including Zamalek. We provide fully-furnished apartments with hotel-like amenities and personalized services for both short and long-term stays.', 0, true),
('What are your check-in and check-out times?', 'Standard check-in time is 3:00 PM and check-out is 11:00 AM. Early check-in and late check-out can be arranged based on availability. Please contact us in advance to request these options.', 1, true),
('What is included in the apartment rental?', 'All apartments include high-speed WiFi, fully equipped kitchen, premium linens and towels, weekly housekeeping, utilities (electricity, water, gas), smart TV with streaming services, and 24/7 guest support. Some units also include access to building amenities like gym, pool, and rooftop terraces.', 2, true),
('Do you offer long-term stays?', 'Yes! We offer discounted rates for extended stays of 30 days or more. Monthly and quarterly packages are available with additional perks like extra housekeeping and flexible payment terms. Contact us for custom long-term rates.', 3, true),
('What is your cancellation policy?', 'Free cancellation is available up to 48 hours before check-in for most bookings. Cancellations within 48 hours may incur a charge equivalent to one night stay. Long-term bookings have specific terms that will be detailed in your booking confirmation.', 4, true),
('Is parking available?', 'Parking availability varies by property. Most of our Zamalek apartments have street parking nearby, and some buildings offer secure underground parking. Please inquire about parking options when booking your stay.', 5, true),
('Do you allow pets?', 'Pet policies vary by property. Some of our apartments are pet-friendly with prior approval and may require an additional cleaning fee. Please contact us before booking if you plan to bring a pet.', 6, true),
('How do I access the apartment?', 'We provide secure, contactless check-in with smart locks or key boxes. Detailed access instructions are sent 24 hours before your arrival. Our team is also available for in-person key handover if preferred.', 7, true),
('What amenities are available in the building?', 'Building amenities vary by property but may include rooftop terraces, swimming pools, fitness centers, gardens, and 24-hour security. Each property listing details the specific amenities available.', 8, true),
('Is housekeeping included?', 'Weekly housekeeping is included in all stays. Additional cleaning services can be arranged upon request for an extra fee. For long-term guests, we offer flexible housekeeping schedules.', 9, true),
('What payment methods do you accept?', 'We accept major credit cards, bank transfers, and cash payments. For long-term stays, we can arrange monthly payment schedules. All payments are processed securely.', 10, true),
('How can I contact SuiteSpot for assistance?', 'Our guest support team is available 24/7. You can reach us via WhatsApp, email at hello@suitespoteg.com, or through the contact form on our website. For urgent matters during your stay, you''ll have direct access to your dedicated guest coordinator.', 11, true);
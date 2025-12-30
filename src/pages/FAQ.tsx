import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { Helmet } from 'react-helmet-async';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "What is SuiteSpot?",
    answer: "SuiteSpot is a premium serviced apartment provider in Egypt, offering thoughtfully designed living spaces that combine the comfort of home with hotel-quality amenities. Our properties are located in prime areas of Cairo, including the prestigious Zamalek district."
  },
  {
    question: "What are your check-in and check-out times?",
    answer: "Standard check-in time is 3:00 PM and check-out is 11:00 AM. Early check-in and late check-out may be available upon request, subject to availability. Please contact us in advance to arrange."
  },
  {
    question: "What amenities are included in the suites?",
    answer: "All our suites include fully equipped kitchens, high-speed WiFi, smart TVs, premium bedding, in-unit washer/dryer, 24/7 concierge service, weekly housekeeping, and access to building amenities such as rooftop terraces and fitness centers where available."
  },
  {
    question: "Do you offer long-term stays?",
    answer: "Yes, we specialize in both short-term and extended stays. We offer special rates for monthly and long-term bookings. Contact us directly for customized packages tailored to your needs."
  },
  {
    question: "What is your cancellation policy?",
    answer: "Our standard cancellation policy allows free cancellation up to 48 hours before check-in for full refund. Cancellations within 48 hours may be subject to charges. Long-term bookings may have different terms - please review your booking confirmation for specific details."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept major credit cards (Visa, MasterCard, American Express), bank transfers, and cash payments in Egyptian Pounds. A deposit may be required at the time of booking."
  },
  {
    question: "Is parking available?",
    answer: "Parking availability varies by property. Some locations offer dedicated parking spaces, while others have nearby parking options. Please inquire about parking when making your reservation."
  },
  {
    question: "Are pets allowed?",
    answer: "Pet policies vary by property. Please contact us before booking if you plan to bring a pet, and we'll do our best to accommodate your needs."
  },
  {
    question: "What makes Zamalek a great location?",
    answer: "Zamalek is an upscale island district in the heart of Cairo, known for its tree-lined streets, embassies, art galleries, boutique shops, and excellent restaurants. It offers a peaceful retreat while being centrally located with easy access to Cairo's major attractions."
  },
  {
    question: "Do you offer airport transfers?",
    answer: "Yes, we can arrange airport pickup and drop-off services for our guests. Please request this service at least 24 hours before your arrival and we'll coordinate the transfer."
  },
  {
    question: "Is there a minimum stay requirement?",
    answer: "Minimum stay requirements vary by property and season. Generally, we have a 2-night minimum for most bookings. Please check the specific property listing or contact us for details."
  },
  {
    question: "How do I contact the concierge during my stay?",
    answer: "Our 24/7 concierge service is available via WhatsApp, phone, or email. Upon check-in, you'll receive all contact details and can reach us anytime for assistance with reservations, recommendations, or any needs during your stay."
  }
];

const FAQ = () => {
  // Generate default values to have all items expanded for crawlers
  const defaultExpandedItems = faqItems.map((_, index) => `item-${index}`);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>FAQ | SuiteSpot - Frequently Asked Questions</title>
        <meta name="description" content="Find answers to common questions about SuiteSpot serviced apartments in Egypt. Learn about check-in times, amenities, cancellation policies, and more." />
        <link rel="canonical" href="https://suitespoteg.com/faq" />
        <meta name="robots" content="index, follow" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqItems.map(item => ({
              "@type": "Question",
              "name": item.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
              }
            }))
          })}
        </script>
      </Helmet>

      <PublicNav />

      <div className="pt-20">
        {/* Hero Section - matching Blog page exactly */}
        <section className="py-8 md:py-13 px-[20px] mx-[40px] bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="font-playfair font-semibold text-[40px] md:text-[80px] tracking-[-0.02em] leading-[1.1] text-foreground mb-6">
              Frequently Asked Questions
            </h1>
            <p className="font-playfair font-medium text-[24px] md:text-[36px] text-muted-foreground">
              Everything you need to know about staying with us
            </p>
          </div>
        </section>

        {/* FAQ Content Section */}
        <section className="py-16 px-6">
          <div className="container mx-auto max-w-4xl">
            <Accordion 
              type="multiple" 
              defaultValue={defaultExpandedItems}
              className="space-y-4"
            >
              {faqItems.map((item, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="bg-card rounded-lg border border-border px-6"
                >
                  <AccordionTrigger className="font-playfair font-semibold text-[18px] md:text-[20px] text-foreground hover:no-underline py-6">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="font-playfair font-normal text-[16px] text-muted-foreground pb-6">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Additional Help Section */}
            <div className="mt-16 text-center">
              <h2 className="font-playfair font-semibold text-[24px] md:text-[32px] text-foreground mb-4">
                Still have questions?
              </h2>
              <p className="font-playfair font-normal text-[16px] text-muted-foreground mb-6">
                Our team is here to help. Reach out to us anytime.
              </p>
              <a 
                href="mailto:info@suitespoteg.com"
                className="inline-block font-playfair font-medium text-[16px] text-primary hover:text-primary/80 transition-colors underline"
              >
                info@suitespoteg.com
              </a>
            </div>
          </div>
        </section>
      </div>

      <PublicFooter />
    </div>
  );
};

export default FAQ;

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PublicNav } from '@/components/PublicNav';
import { PublicFooter } from '@/components/PublicFooter';
import { SEO } from '@/components/SEO';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sequence_order: number;
}

const FAQ = () => {
  const [faqItems, setFaqItems] = useState<FAQItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFAQs = async () => {
      const { data } = await supabase
        .from('faq_items')
        .select('id, question, answer, sequence_order')
        .eq('is_published', true)
        .order('sequence_order', { ascending: true });

      if (data) setFaqItems(data);
      setIsLoading(false);
    };

    fetchFAQs();
  }, []);

  const defaultExpandedItems = faqItems.map((item) => item.id);

  const faqJsonLd = faqItems.length > 0 ? {
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
  } : undefined;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="FAQ | SuiteSpot - Frequently Asked Questions"
        description="Find answers to common questions about SuiteSpot serviced apartments in Egypt. Learn about check-in times, amenities, cancellation policies, and more."
        path="/faq"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "FAQ" }
        ]}
        additionalJsonLd={faqJsonLd}
      />

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
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading...
              </div>
            ) : faqItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No FAQ items available at the moment.
              </div>
            ) : (
              <Accordion 
                type="multiple" 
                defaultValue={defaultExpandedItems}
                className="space-y-4"
              >
                {faqItems.map((item) => (
                  <AccordionItem 
                    key={item.id} 
                    value={item.id}
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
            )}

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

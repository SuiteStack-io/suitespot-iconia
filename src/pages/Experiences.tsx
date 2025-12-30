import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Palmtree, Camera, Sailboat, Sparkles } from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { SEO } from "@/components/SEO";

const Experiences = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Curated Experiences | Pyramids Tours, Nile Cruises & More - SuiteSpot"
        description="Discover Egypt through handpicked adventures. Private Pyramids tours, Nile felucca cruises, art tours, and Egyptian cooking classes with SuiteSpot."
        path="/experiences"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Experiences" }
        ]}
      />

      <PublicNav />

      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-8 md:py-13 px-[20px] mx-[40px] bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="font-playfair font-semibold text-[40px] md:text-[80px] tracking-[-0.02em] leading-[1.1] text-foreground mb-6">Curated Experiences</h1>
            <p className="font-playfair font-medium text-[24px] md:text-[36px] text-muted-foreground">
              Discover Egypt's rich culture through handpicked adventures
            </p>
          </div>
        </section>

        {/* Introduction */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">Beyond comfortable accommodation, we offer exclusive access to Egypt's most captivating experiences. Our team has curated a collection of cultural, culinary, and adventure activities that showcase the best of Cairo and beyond.</p>
          </div>
        </section>

        {/* Experiences Grid */}
        <section className="py-12 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="overflow-hidden group hover:shadow-xl transition-shadow">
                <div className="h-64 bg-gradient-to-br from-accent/30 to-primary/20 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Palmtree className="w-16 h-16 text-accent/50" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    Day at the Pyramids
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Private guided tour of the Giza Pyramids and Sphinx, including exclusive access to 
                    lesser-known tombs. Learn from expert Egyptologists about ancient history.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>• Duration: Full day (8 hours)</p>
                    <p>• Private transportation included</p>
                    <p>• Traditional Egyptian lunch</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    Inquire About This Experience
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden group hover:shadow-xl transition-shadow">
                <div className="h-64 bg-gradient-to-br from-accent/30 to-primary/20 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sailboat className="w-16 h-16 text-accent/50" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    Nile Felucca Cruise
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Sail the Nile on a traditional Egyptian felucca at sunset. Experience Cairo from 
                    the water while enjoying tea and local snacks.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>• Duration: 2-3 hours</p>
                    <p>• Sunset timing</p>
                    <p>• Refreshments included</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    Inquire About This Experience
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden group hover:shadow-xl transition-shadow">
                <div className="h-64 bg-gradient-to-br from-accent/30 to-primary/20 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="w-16 h-16 text-accent/50" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    Local Art & Culture Tour
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Explore Zamalek's vibrant art scene with visits to contemporary galleries, 
                    artist studios, and cultural spaces. Meet local artists and collectors.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>• Duration: Half day (4 hours)</p>
                    <p>• Walking tour</p>
                    <p>• Gallery entrance fees included</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    Inquire About This Experience
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden group hover:shadow-xl transition-shadow">
                <div className="h-64 bg-gradient-to-br from-accent/30 to-primary/20 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-16 h-16 text-accent/50" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    Egyptian Cooking Class
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Learn to cook authentic Egyptian dishes with a local chef. Visit a traditional 
                    market to source ingredients, then prepare and enjoy a feast.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p>• Duration: Half day (4 hours)</p>
                    <p>• Market tour included</p>
                    <p>• Take recipes home</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    Inquire About This Experience
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Custom Experiences */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-6">
              Custom Experiences
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Have something specific in mind? Our concierge team can arrange bespoke experiences 
              tailored to your interests—from private museum tours to desert adventures.
            </p>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/book">Contact Our Concierge</Link>
            </Button>
          </div>
        </section>
      </div>

      <PublicFooter />
    </div>
  );
};

export default Experiences;

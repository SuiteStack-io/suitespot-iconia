import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { PublicNav } from "@/components/PublicNav";
import { Building2, MapPin, Users, Calendar, Home, Sparkles, Leaf, Headphones, Briefcase, Plane, Baby, Waves, Coffee, BookOpen } from "lucide-react";

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "SuiteSpot Hospitality",
  "alternateName": "SuiteSpot",
  "url": "https://www.findyoursuitespot.com",
  "logo": "https://www.findyoursuitespot.com/suitespot-logo-3.png",
  "description": "SuiteSpot Hospitality redefines serviced apartment living in Egypt, blending local culture, modern design, and hotel-level service.",
  "foundingDate": "2024",
  "foundingLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Cairo",
      "addressCountry": "Egypt"
    }
  },
  "areaServed": {
    "@type": "Country",
    "name": "Egypt"
  },
  "knowsAbout": [
    "Serviced Apartments",
    "Hospitality",
    "Wellness Programs",
    "Luxury Accommodation"
  ],
  "slogan": "Welcome Home"
};

const About = () => {
  return <div className="min-h-screen bg-background">
      <SEO
        title="About SuiteSpot | Premium Serviced Living in Egypt"
        description="Learn about SuiteSpot Hospitality - redefining serviced apartment living in Egypt. Premium apartments, wellness focus, and hotel-level service in Zamalek, Cairo."
        path="/about"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "About" }
        ]}
        additionalJsonLd={organizationJsonLd}
      />

      <PublicNav />

      <div className="pt-20">
        {/* Hero Section */}
        <section className="relative py-8 md:py-13 bg-gradient-to-b from-primary/5 to-background px-[20px] mx-[40px] my-0 border-0">
          <div className="container mx-auto max-w-5xl text-center">
            <h1 className="font-playfair text-[40px] md:text-[80px] font-semibold tracking-[-0.02em] text-foreground mb-6 leading-[1.1]">
              About SuiteSpot Hospitality
            </h1>
            <p className="font-playfair text-[24px] md:text-[36px] font-medium text-muted-foreground">Welcome! We’re so happy you’ve crossed our path.</p>
          </div>
        </section>

        {/* Brand Introduction */}
        <section className="py-6 md:py-10 px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="space-y-6">
              <p className="font-playfair text-[18px] md:text-[20px] font-normal leading-[1.5] text-foreground">
                SuiteSpot Hospitality is redefining serviced apartment living in Egypt. At SuiteSpot, we’re redefining the way you stay. Positioned at the sweet spot between a hotel and a serviced apartment, we blend the comfort of home with the service and style of a boutique hotel, transforming iconic spaces into wellness-focused, design-driven stays.
              </p>
              <p className="font-playfair text-[18px] md:text-[20px] font-normal leading-[1.5] text-foreground">
                Whether you're here for a few nights, a week, or longer, SuiteSpot offers a consistent brand experience across every location without sacrificing individuality. Each Suite is architecturally unique and culturally rooted, with wellbeing at the core of everything we do.

This is more than a place to sleep. It’s a better way to stay.
              </p>
            </div>
          </div>
        </section>

        {/* Key Facts Section */}
        <section className="py-16 md:py-24 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-playfair text-[32px] md:text-[48px] font-semibold tracking-[-0.02em] text-center text-foreground mb-12">
              Key Facts
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Brand Type */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-playfair text-[18px] md:text-[20px] font-medium mb-2 text-foreground">
                      Brand Type
                    </h3>
                    <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                      Premium serviced apartments with hotel-level service
                    </p>
                  </div>
                </div>
              </Card>

              {/* Locations */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-playfair text-[18px] md:text-[20px] font-medium mb-2 text-foreground">
                      Current Location
                    </h3>
                    <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                      Zamalek, Cairo (Iconia Building)
                    </p>
                  </div>
                </div>
              </Card>

              {/* Target Guests */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-playfair text-[18px] md:text-[20px] font-medium mb-2 text-foreground">
                      Target Guests
                    </h3>
                    <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                      Families from around the world, Business travelers, relocations, &amp; digital nomads.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Stay Lengths */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-playfair text-[18px] md:text-[20px] font-medium mb-2 text-foreground">
                      Stay Lengths
                    </h3>
                    <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                      From 3 nights to 12+ months
                    </p>
                  </div>
                </div>
              </Card>

              {/* Positioning */}
              <Card className="p-6 hover:shadow-lg transition-shadow md:col-span-2 lg:col-span-2">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Home className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-playfair text-[18px] md:text-[20px] font-medium mb-2 text-foreground">
                      Positioning
                    </h3>
                    <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">Better than Airbnb with professional service and wellness classes, more homely than hotels with full kitchens and living spaces</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* What is SuiteSpot? Section */}
        <section className="py-16 md:py-24 px-6">
          <div className="container mx-auto max-w-4xl">
            <h2 className="font-playfair text-[32px] md:text-[48px] font-semibold tracking-[-0.02em] text-foreground mb-8">
              What is SuiteSpot?
            </h2>
            <div className="bg-accent/5 border-l-4 border-accent p-6 md:p-8 rounded-r-lg">
              <p className="font-playfair text-[18px] md:text-[20px] font-normal leading-[1.5] text-foreground mb-4">
                SuiteSpot is a new category of hospitality—we combine the professional service and amenities of a boutique hotel with the space, comfort, and flexibility of a fully-furnished apartment.
              </p>
              <p className="font-playfair text-[18px] md:text-[20px] font-normal leading-[1.5] text-foreground mb-4">
                We transform iconic buildings in Egypt's most vibrant neighborhoods into wellness-focused, design-driven stays. Each property features thoughtfully curated interiors, full kitchens, spacious living areas, and access to wellness programs including yoga, fitness, and mindfulness sessions.
              </p>
              <p className="font-playfair text-[18px] md:text-[20px] font-normal leading-[1.5] text-foreground">
                Unlike traditional hotels that can feel impersonal or Airbnb properties that lack consistency, SuiteSpot delivers reliable, high-quality experiences with 24/7 support, professional housekeeping, and concierge services—all while making you feel truly at home.
              </p>
            </div>
          </div>
        </section>

        {/* Why Zamalek? Section */}
        <section className="py-16 md:py-24 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-playfair text-[32px] md:text-[48px] font-semibold tracking-[-0.02em] text-center text-foreground mb-12">
              Why Zamalek?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] md:text-[24px] font-medium mb-3 text-foreground">
                  Cultural Heart
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                  Zamalek is Cairo's most prestigious island neighborhood, known for tree-lined streets, art galleries, and authentic Egyptian culture.
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] md:text-[24px] font-medium mb-3 text-foreground">
                  Iconic Building
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                  The Iconia building, once the historic AUC dormitory, has been transformed into a modern mixed-use development with character and charm.
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <MapPin className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] md:text-[24px] font-medium mb-3 text-foreground">
                  Prime Location
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                  Walking distance to embassies, world-class restaurants, cultural sites, and stunning Nile views—everything you need is nearby.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Amenities & Services Section */}
        <section className="py-16 md:py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-playfair text-[32px] md:text-[48px] font-semibold tracking-[-0.02em] text-center text-foreground mb-12">
              Amenities & Services
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {/* Wellness */}
              <Card className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-green-500/10">
                    <Leaf className="w-10 h-10 text-green-600" />
                  </div>
                </div>
                <h3 className="font-playfair text-[24px] md:text-[28px] font-medium text-center mb-4 text-foreground">
                  Wellness
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Yoga classes for all levels, fitness and cardio sessions, mindfulness and meditation—powered by OnTrack wellness.
                </p>
              </Card>

              {/* Design */}
              <Card className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-purple-500/10">
                    <Home className="w-10 h-10 text-purple-600" />
                  </div>
                </div>
                <h3 className="font-playfair text-[24px] md:text-[28px] font-medium text-center mb-4 text-foreground">Residential Suites</h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Thoughtfully curated interiors featuring local Egyptian artwork, modern functional furniture, and full kitchens and living spaces.
                </p>
              </Card>

              {/* Service */}
              <Card className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-blue-500/10">
                    <Headphones className="w-10 h-10 text-blue-600" />
                  </div>
                </div>
                <h3 className="font-playfair text-[24px] md:text-[28px] font-medium text-center mb-4 text-foreground">
                  Service
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  24/7 support and assistance, professional housekeeping, concierge services, and maintenance and repairs.
                </p>
              </Card>

              {/* Outdoor Pool */}
              <Card className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-cyan-500/10">
                    <Waves className="w-10 h-10 text-cyan-600" />
                  </div>
                </div>
                <h3 className="font-playfair text-[24px] md:text-[28px] font-medium text-center mb-4 text-foreground">
                  Outdoor Pool
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  A serene open-air pool designed for slow mornings, sunset dips, and unwinding after a day of exploring.
                </p>
              </Card>

              {/* Restaurant & Coffee Bar */}
              <Card className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-amber-500/10">
                    <Coffee className="w-10 h-10 text-amber-600" />
                  </div>
                </div>
                <h3 className="font-playfair text-[24px] md:text-[28px] font-medium text-center mb-4 text-foreground">
                  On-Premise Restaurant & Specialty Coffee Bar
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Savor single-origin coffee brewed by expert baristas, along with thoughtfully crafted lunch and dinner menus inspired by local flavors and global comfort.
                </p>
              </Card>

              {/* Bookstore & Gift Shop */}
              <Card className="p-8 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-6">
                  <div className="p-4 rounded-full bg-rose-500/10">
                    <BookOpen className="w-10 h-10 text-rose-600" />
                  </div>
                </div>
                <h3 className="font-playfair text-[24px] md:text-[28px] font-medium text-center mb-4 text-foreground">
                  Boutique Bookstore & Egyptian Gift Shop
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Discover curated reads, locally made crafts, and meaningful keepsakes to take a piece of Egypt home with you.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Who Is This Ideal For? Section */}
        <section className="py-16 md:py-24 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-playfair text-[32px] md:text-[48px] font-semibold tracking-[-0.02em] text-center text-foreground mb-12">
              Who Is This Ideal For?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Families */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Baby className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] font-medium text-center mb-3 text-foreground">Families & Tourists</h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Spacious suites, full kitchens, and kid-friendly amenities
                </p>
              </Card>

              {/* Business Travelers */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Plane className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] font-medium text-center mb-3 text-foreground">
                  Business Travelers
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Central location, professional environment, and executive service
                </p>
              </Card>

              {/* Relocations */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Home className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] font-medium text-center mb-3 text-foreground">
                  Relocations
                </h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Hassle-free moves with fully furnished apartments and monthly rates
                </p>
              </Card>

              {/* Remote Workers */}
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-center mb-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Briefcase className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <h3 className="font-playfair text-[20px] font-medium text-center mb-3 text-foreground">Digital Nomads</h3>
                <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5] text-center">
                  Fast WiFi, dedicated workspaces, and flexible stay durations
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Internal Navigation Links */}
        <section className="py-16 md:py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-playfair text-[32px] md:text-[48px] font-semibold tracking-[-0.02em] text-center text-foreground mb-12">
              Explore More
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Link to="/iconia-zamalek" className="group">
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-105">
                  <h3 className="font-playfair text-[20px] font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                    ICONIA Zamalek →
                  </h3>
                  <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                    Learn about our journey and vision
                  </p>
                </Card>
              </Link>

              <Link to="/suites" className="group">
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-105">
                  <h3 className="font-playfair text-[20px] font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                    View Suites →
                  </h3>
                  <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                    Explore our property collection
                  </p>
                </Card>
              </Link>

              <Link to="/wellness" className="group">
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-105">
                  <h3 className="font-playfair text-[20px] font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                    Wellness Programs →
                  </h3>
                  <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                    Discover yoga and fitness options
                  </p>
                </Card>
              </Link>

              <Link to="/experiences" className="group">
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-105">
                  <h3 className="font-playfair text-[20px] font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                    Local Experiences →
                  </h3>
                  <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                    Explore curated Egyptian adventures
                  </p>
                </Card>
              </Link>

              <Link to="/nearby" className="group">
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-105">
                  <h3 className="font-playfair text-[20px] font-medium mb-2 text-foreground group-hover:text-primary transition-colors">
                    Nearby Amenities →
                  </h3>
                  <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                    Find restaurants and attractions
                  </p>
                </Card>
              </Link>

              <Link to="/book" className="group">
                <Card className="p-6 hover:shadow-lg transition-all hover:scale-105 bg-accent/5 border-accent">
                  <h3 className="font-playfair text-[20px] font-medium mb-2 text-accent group-hover:text-accent/80 transition-colors">
                    Book Your Stay →
                  </h3>
                  <p className="font-playfair text-[16px] font-normal text-muted-foreground leading-[1.5]">
                    Reserve your SuiteSpot experience
                  </p>
                </Card>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-accent/5 to-background">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="font-playfair text-[36px] md:text-[60px] font-semibold tracking-[-0.02em] text-foreground mb-6">
              Ready to Experience SuiteSpot?
            </h2>
            <p className="font-playfair text-[18px] md:text-[20px] font-normal text-muted-foreground mb-8 leading-[1.5]">
              Book your stay today and discover a new way to experience Egypt
            </p>
            <Button asChild size="lg" className="font-playfair text-[16px] font-medium bg-accent hover:bg-accent/90 text-white h-12 px-8">
              <Link to="/book">Book Now</Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 bg-card border-t border-border">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-serif font-bold text-foreground mb-4">SuiteSpot</h3>
                <p className="text-sm text-muted-foreground">
                  Redefining serviced apartment living in Egypt
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Explore</h4>
                <div className="space-y-2">
                  <Link to="/about" className="block text-sm text-muted-foreground hover:text-foreground">About</Link>
                  <Link to="/iconia-zamalek" className="block text-sm text-muted-foreground hover:text-foreground">ICONIA Zamalek</Link>
                  <Link to="/locations" className="block text-sm text-muted-foreground hover:text-foreground">Locations</Link>
                  <Link to="/suites" className="block text-sm text-muted-foreground hover:text-foreground">Suites</Link>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Experience</h4>
                <div className="space-y-2">
                  <Link to="/wellness" className="block text-sm text-muted-foreground hover:text-foreground">Wellness</Link>
                  <Link to="/experiences" className="block text-sm text-muted-foreground hover:text-foreground">Experiences</Link>
                  <Link to="/nearby" className="block text-sm text-muted-foreground hover:text-foreground">Nearby Amenities</Link>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-4">Contact</h4>
                <p className="text-sm text-muted-foreground">
                  Iconia, Zamalek<br />
                  Cairo, Egypt
                </p>
              </div>
            </div>
            <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
              <p>&copy; 2025 SuiteSpot Hospitality. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>;
};
export default About;
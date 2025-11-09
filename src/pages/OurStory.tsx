import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/suitespot-logo.png";
const OurStory = () => {
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SuiteSpot logo" className="h-8 w-8" />
            <span className="text-2xl font-serif font-bold text-foreground">SuiteSpot</span>
          </Link>
          <Button asChild className="bg-accent hover:bg-accent/90">
            <Link to="/book">Book Now</Link>
          </Button>
        </div>
      </nav>

      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-24 px-6 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Our Story</h1>
            <p className="text-xl opacity-90">Transforming iconic spaces into wellness-focused, design-driven stays.</p>
          </div>
        </section>

        {/* Story Content */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-4xl">
          <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-serif font-bold text-foreground mb-4">We started back in 2018.</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  ICONIA began in 2018 with a simple yet ambitious vision — to breathe new life into one of Zamalek's most iconic buildings. What was once the AUC dormitory was reimagined as Egypt's first-of-its-kind mixed-use development — a vibrant space blending residences, offices, and retail under one roof.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  After 18 months of transformation, ICONIA opened its doors in June 2019, welcoming Egypt's leading firms and long-stay guests seeking comfort, design, and community in the heart of the city.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Today, as we look toward the future, ICONIA is evolving once again — giving rise to SuiteSpot, a hospitality brand redefining modern living. Rooted in design, wellness, and local culture, SuiteSpot continues ICONIA's journey of turning exceptional spaces into meaningful experiences.
                </p>
              </div>

              <div>
                <h2 className="text-3xl font-serif font-bold text-foreground mb-4">
                  A Vision Born from Experience
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  SuiteSpot Hospitality was founded on a simple belief: travelers deserve more than just a place to stay. 
                  They deserve a home away from home, enhanced with the sophistication and service of a boutique hotel. 
                  Our vision is to blend comfort, design, and authentic hospitality to create unforgettable experiences in Egypt.
                </p>
              </div>

              <div className="h-96 bg-muted rounded-lg overflow-hidden">
                {/* Placeholder for image */}
                <div className="w-full h-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                  <p className="text-muted-foreground">[Image: SuiteSpot Interior]</p>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-serif font-bold text-foreground mb-4">
                  Our Philosophy
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                  We believe in creating spaces that reflect local culture while embracing modern design principles. 
                  Each SuiteSpot property is carefully curated to offer guests an immersive experience that goes beyond accommodation. 
                  From wellness-focused amenities to culturally rich experiences, we aim to nourish both body and soul.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Our commitment extends to sustainable practices, community engagement, and providing hotel-level service 
                  in every interaction. Whether you're staying for a few nights or several months, SuiteSpot is designed 
                  to make you feel at home while inspiring you to explore all that Egypt has to offer.
                </p>
              </div>

              <div>
                <h2 className="text-3xl font-serif font-bold text-foreground mb-4">
                  Looking Forward
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Starting with our flagship property, Iconia in Zamalek, we're expanding our vision across Egypt's 
                  most vibrant neighborhoods. Each new location will bring the same commitment to design, wellness, 
                  and authentic hospitality that defines the SuiteSpot experience.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 bg-muted/30">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-6">
              Experience SuiteSpot
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Discover a new way to experience Egypt
            </p>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link to="/book">Book Your Stay</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>;
};
export default OurStory;
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Coffee, UtensilsCrossed, MapPin, Landmark } from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { SEO } from "@/components/SEO";

const Nearby = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Nearby Amenities | Zamalek Restaurants, Cafes & Attractions - SuiteSpot"
        description="Explore the best of Zamalek at your doorstep. World-class dining, cultural attractions, and the Nile just steps from SuiteSpot."
        path="/nearby"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Nearby" }
        ]}
      />

      <PublicNav />

      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-24 px-6 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Nearby Amenities</h1>
            <p className="text-xl opacity-90">
              Explore the best of Zamalek at your doorstep
            </p>
          </div>
        </section>

        {/* Introduction */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Located in the heart of Zamalek, Cairo's most prestigious island neighborhood, 
              SuiteSpot places you steps away from world-class dining, cultural attractions, 
              and the serene banks of the Nile.
            </p>
          </div>
        </section>

        {/* Categories */}
        <section className="py-12 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl space-y-16">
            {/* Dining */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-foreground">Dining</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Sequoia</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Mediterranean dining with stunning Nile views. Perfect for sunset dinners.
                  </p>
                  <p className="text-xs text-accent">5 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Kazoku</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Upscale Japanese cuisine in an elegant setting.
                  </p>
                  <p className="text-xs text-accent">7 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Left Bank</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    French-inspired bistro with riverside terrace.
                  </p>
                  <p className="text-xs text-accent">10 min walk</p>
                </Card>
              </div>
            </div>

            {/* Cafes */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <Coffee className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-foreground">Cafés & Coffee Shops</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Beano's Café</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Local favorite for specialty coffee and pastries.
                  </p>
                  <p className="text-xs text-accent">3 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Café Greco</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Italian café with outdoor seating and people-watching.
                  </p>
                  <p className="text-xs text-accent">5 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">L'Aroma</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Cozy spot for specialty coffee and fresh juices.
                  </p>
                  <p className="text-xs text-accent">8 min walk</p>
                </Card>
              </div>
            </div>

            {/* Culture */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-foreground">Cultural Attractions</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Cairo Opera House</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    World-class performances and cultural events.
                  </p>
                  <p className="text-xs text-accent">15 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Museum of Modern Egyptian Art</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Contemporary Egyptian art collections.
                  </p>
                  <p className="text-xs text-accent">15 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Gezira Art Center</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Local galleries showcasing emerging artists.
                  </p>
                  <p className="text-xs text-accent">12 min walk</p>
                </Card>
              </div>
            </div>

            {/* Parks & Recreation */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-accent rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-foreground">Parks & Recreation</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Gezira Club</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Historic sports club with tennis, swimming, and more.
                  </p>
                  <p className="text-xs text-accent">10 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Nile Corniche</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Riverside promenade perfect for jogging or evening strolls.
                  </p>
                  <p className="text-xs text-accent">5 min walk</p>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-2">Zamalek Gardens</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Quiet green spaces scattered throughout the neighborhood.
                  </p>
                  <p className="text-xs text-accent">Various locations</p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Concierge CTA */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-serif font-bold text-foreground mb-6">
              Need Recommendations?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our concierge team knows Zamalek inside out. We're happy to make reservations, 
              provide directions, or suggest hidden gems based on your preferences.
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

export default Nearby;

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import logo from "@/assets/suitespot-logo.png";

const Locations = () => {
  return (
    <div className="min-h-screen bg-background">
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
        <section className="py-24 px-6 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Our Locations</h1>
            <p className="text-xl opacity-90">
              Architecturally unique properties in Cairo's most vibrant neighborhoods
            </p>
          </div>
        </section>

        {/* Locations Grid */}
        <section className="py-24 px-6">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Iconia Zamalek */}
              <Card className="overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                <div className="h-64 bg-gradient-to-br from-accent/20 to-primary/20 relative overflow-hidden">
                  {/* Placeholder for image */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground">[Image: Iconia Zamalek]</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-accent mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">Now Open</span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    Iconia, Zamalek
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Our flagship property in the heart of Zamalek, Cairo's most prestigious island neighborhood. 
                    Experience modern luxury in an architecturally unique building surrounded by art galleries, 
                    cafes, and the Nile.
                  </p>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 bg-accent rounded-full"></span>
                      <span>Studio, 1BR & 2BR Suites</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 bg-accent rounded-full"></span>
                      <span>Rooftop Wellness Center</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 bg-accent rounded-full"></span>
                      <span>Walking Distance to Museums & Galleries</span>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-accent hover:bg-accent/90">
                    <Link to="/suites">View Suites</Link>
                  </Button>
                </div>
              </Card>

              {/* Coming Soon Location */}
              <Card className="overflow-hidden opacity-75">
                <div className="h-64 bg-muted relative overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-serif font-bold text-foreground mb-2">Coming Soon</p>
                      <p className="text-muted-foreground">New locations in development</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    Expanding Across Egypt
                  </h3>
                  <p className="text-muted-foreground">
                    We're scouting new locations in Cairo and beyond. Each property will bring the same 
                    commitment to design, wellness, and authentic hospitality that defines SuiteSpot.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Map Section */}
        <section className="py-24 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-serif font-bold text-foreground mb-4">Find Us</h2>
              <p className="text-lg text-muted-foreground">
                Strategically located in Cairo's most desirable neighborhoods
              </p>
            </div>
            <div className="h-96 bg-background rounded-lg border border-border flex items-center justify-center">
              {/* Placeholder for map */}
              <p className="text-muted-foreground">[Interactive Map - Zamalek, Cairo]</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Locations;

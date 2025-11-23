import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { MapPin, Home, Waves, Dumbbell, Lock, Tv, Wifi, Wind, Package, Sparkles } from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import InteractivePropertyMap from "@/components/InteractivePropertyMap";
import northCoast from "@/assets/north-coast.webp";


const Locations = () => {
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    const { data } = await supabase
      .from("units")
      .select("*")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .not('name', 'ilike', '%Almaza%')
      .order("name");
    
    if (data) setProperties(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-8 px-6 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Our Locations</h1>
            <p className="text-xl opacity-90">
              Architecturally unique properties in Cairo's most vibrant neighborhoods
            </p>
          </div>
        </section>

        {/* Locations Grid */}
        <section className="py-6 px-6">
          <div className="container mx-auto">
            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Iconia Zamalek */}
              <Card className="overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                <div className="h-64 relative overflow-hidden">
                  <img 
                    src="/slideshow/iconia-zamalek.jpg" 
                    alt="ICONIA Zamalek - Modern luxury suites in the heart of Zamalek" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
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
                    cafes, Zamalek's hidden gems, and the Nile.
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Home className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Studio, 1BR & 2BR Suites</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Waves className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Outdoor Pool</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Dumbbell className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Group Fitness Classes & Wellness sessions (powered by OnTrack)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>In-room safe</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tv className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>55-inch flat-screen television with streaming and casting options</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wifi className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Free Wifi</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wind className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Iron and ironing board</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Package className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Walk-in closet</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground col-span-2">
                      <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>Deluxe toiletries</span>
                    </div>
                  </div>
                  <Button asChild className="w-full bg-accent hover:bg-accent/90">
                    <Link to="/suites">View Suites</Link>
                  </Button>
                </div>
              </Card>

              {/* North Coast Location */}
              <Card className="overflow-hidden group cursor-pointer hover:shadow-xl transition-shadow">
                <div className="h-64 relative overflow-hidden">
                  <img 
                    src={northCoast} 
                    alt="North Coast - Beautiful beachfront luxury coming soon" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-medium">Coming Soon</span>
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-foreground mb-3">
                    North Coast <span className="text-lg text-muted-foreground font-normal">Summer 2026</span>
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Experience beachfront luxury on Egypt's stunning Mediterranean coastline. 
                    Our North Coast property will offer pristine beaches, crystal-clear waters, 
                    and the same exceptional hospitality that defines SuiteSpot.
                  </p>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 bg-primary rounded-full"></span>
                      <span>Beachfront Access</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 bg-primary rounded-full"></span>
                      <span>Luxury Suites with Sea Views</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="w-1 h-1 bg-primary rounded-full"></span>
                      <span>Premium Amenities & Dining</span>
                    </div>
                  </div>
                  <Button disabled className="w-full">
                    Coming Soon
                  </Button>
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
                ICONIA Zamalek - 16 Mohammed Thakeb St, Zamalek, Cairo
              </p>
            </div>
            <InteractivePropertyMap properties={properties} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Locations;

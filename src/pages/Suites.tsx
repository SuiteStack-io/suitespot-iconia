import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Wifi, Tv, Coffee, Wind, Users, Bed, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/suitespot-logo.png";

interface Unit {
  id: string;
  name: string;
  unit_type: string | null;
  unit_number: string | null;
  unit_size: string | null;
  status: string;
  comments: string | null;
}

const Suites = () => {
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const { data, error } = await supabase
          .from("units")
          .select("*")
          .order("name");

        if (error) throw error;
        setUnits(data || []);
      } catch (error: any) {
        toast({
          title: "Error loading suites",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnits();
  }, [toast]);

  // Default amenities based on unit type
  const getDefaultAmenities = (unitType: string | null) => {
    const baseAmenities = ["Smart TV", "High-Speed WiFi", "Air Conditioning", "Premium Bedding"];
    
    if (unitType?.toLowerCase().includes("studio")) {
      return ["Kitchenette", "Work Desk", ...baseAmenities];
    } else if (unitType?.toLowerCase().includes("one bedroom")) {
      return ["Full Kitchen", "Living Area", "Work Desk", ...baseAmenities, "Washer/Dryer"];
    } else if (unitType?.toLowerCase().includes("two bedroom")) {
      return ["Full Kitchen", "Spacious Living Area", "2 Bathrooms", "Work Desk", ...baseAmenities, "Washer/Dryer"];
    }
    return baseAmenities;
  };

  const getDefaultGuests = (unitType: string | null) => {
    if (unitType?.toLowerCase().includes("studio")) return "1-2";
    if (unitType?.toLowerCase().includes("one bedroom")) return "2-3";
    if (unitType?.toLowerCase().includes("two bedroom")) return "4-5";
    return "1-2";
  };

  const getDefaultBeds = (unitType: string | null) => {
    if (unitType?.toLowerCase().includes("studio")) return "1 Queen Bed";
    if (unitType?.toLowerCase().includes("one bedroom")) return "1 King Bed + Sofa Bed";
    if (unitType?.toLowerCase().includes("two bedroom")) return "1 King + 2 Twin Beds";
    return "1 Queen Bed";
  };

  const getUnitDescription = (unit: Unit) => {
    const type = unit.unit_type?.toLowerCase() || "";
    
    if (type.includes("studio")) {
      return "Modern studio suite with kitchenette, perfect for solo travelers or couples seeking a comfortable stay with all essential amenities.";
    } else if (type.includes("one bedroom")) {
      return "Spacious one-bedroom suite with separate living area and full kitchen. Ideal for extended stays or small families looking for home-like comfort.";
    } else if (type.includes("two bedroom")) {
      return "Luxurious two-bedroom suite with expansive living space, two bathrooms, and full kitchen. Perfect for families or groups seeking premium accommodation.";
    }
    return "Experience comfort and style in our beautifully appointed suite with modern amenities and thoughtful design.";
  };

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
        <section className="py-24 px-6 bg-background/80 backdrop-blur-md">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Our Suites</h1>
            <p className="text-xl opacity-90">
              Thoughtfully designed spaces that feel like home
            </p>
          </div>
        </section>

        {/* Suites Grid */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : units.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">No suites available at the moment.</p>
              </div>
            ) : (
              <div className="space-y-12">
                {units.map((unit) => {
                  const amenities = getDefaultAmenities(unit.unit_type);
                  const guests = getDefaultGuests(unit.unit_type);
                  const beds = getDefaultBeds(unit.unit_type);
                  
                  return (
                    <Card key={unit.id} className="overflow-hidden">
                      <div className="grid md:grid-cols-2 gap-0">
                        <div className="h-64 md:h-auto bg-gradient-to-br from-accent/20 to-primary/20 relative">
                          {/* Placeholder for image */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-muted-foreground">[Image: {unit.name}]</p>
                          </div>
                        </div>
                        <div className="p-8">
                          <h3 className="text-3xl font-serif font-bold text-foreground mb-2">
                            {unit.name}
                          </h3>
                          {unit.unit_number && (
                            <p className="text-sm text-muted-foreground mb-2">Unit {unit.unit_number}</p>
                          )}
                          <p className="text-muted-foreground mb-6">
                            {getUnitDescription(unit)}
                          </p>
                          
                          <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center">
                              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                                <Users className="w-6 h-6 text-accent" />
                              </div>
                              <p className="text-sm font-medium text-foreground">{guests}</p>
                              <p className="text-xs text-muted-foreground">Guests</p>
                            </div>
                            <div className="text-center">
                              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                                <Bed className="w-6 h-6 text-accent" />
                              </div>
                              <p className="text-sm font-medium text-foreground">{beds}</p>
                              <p className="text-xs text-muted-foreground">Bedding</p>
                            </div>
                            <div className="text-center">
                              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                                <Wind className="w-6 h-6 text-accent" />
                              </div>
                              <p className="text-sm font-medium text-foreground">{unit.unit_size || "35-40 sqm"}</p>
                              <p className="text-xs text-muted-foreground">Size</p>
                            </div>
                          </div>

                          <div className="mb-6">
                            <h4 className="font-semibold text-foreground mb-3">Amenities</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {amenities.map((amenity, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="w-1 h-1 bg-accent rounded-full"></span>
                                  <span>{amenity}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <Button asChild className="w-full bg-accent hover:bg-accent/90">
                            <Link to="/book">Check Availability</Link>
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Common Amenities */}
        <section className="py-24 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-serif font-bold text-foreground mb-4">
                Every Suite Includes
              </h2>
              <p className="text-lg text-muted-foreground">
                Premium amenities for your comfort and convenience
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wifi className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">High-Speed WiFi</h3>
                <p className="text-muted-foreground">Complimentary fiber-optic internet throughout</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Tv className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Smart Entertainment</h3>
                <p className="text-muted-foreground">Smart TVs with streaming services</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                  <Coffee className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Fully Equipped Kitchen</h3>
                <p className="text-muted-foreground">Cook like you're at home</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Suites;

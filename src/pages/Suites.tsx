import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Wifi, Tv, Coffee, Wind, Users, Bed } from "lucide-react";

const Suites = () => {
  const suiteTypes = [
    {
      name: "Studio Suite",
      size: "35-40 sqm",
      guests: "1-2",
      beds: "1 Queen Bed",
      amenities: ["Kitchenette", "Work Desk", "Smart TV", "High-Speed WiFi", "Air Conditioning", "Premium Bedding"],
      description: "Perfect for solo travelers or couples seeking a comfortable and stylish space.",
    },
    {
      name: "One Bedroom Suite",
      size: "55-65 sqm",
      guests: "2-3",
      beds: "1 King Bed + Sofa Bed",
      amenities: ["Full Kitchen", "Living Area", "Work Desk", "Smart TV", "High-Speed WiFi", "Air Conditioning", "Premium Bedding", "Washer/Dryer"],
      description: "Ideal for extended stays with separate living and sleeping areas.",
    },
    {
      name: "Two Bedroom Suite",
      size: "85-95 sqm",
      guests: "4-5",
      beds: "1 King + 2 Twin Beds",
      amenities: ["Full Kitchen", "Spacious Living Area", "2 Bathrooms", "Work Desk", "Smart TV", "High-Speed WiFi", "Air Conditioning", "Premium Bedding", "Washer/Dryer"],
      description: "Spacious suite perfect for families or groups traveling together.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-serif font-bold text-foreground">
            SuiteSpot
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
            <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">Our Suites</h1>
            <p className="text-xl opacity-90">
              Thoughtfully designed spaces that feel like home
            </p>
          </div>
        </section>

        {/* Suites Grid */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="space-y-12">
              {suiteTypes.map((suite, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-0">
                    <div className="h-64 md:h-auto bg-gradient-to-br from-accent/20 to-primary/20 relative">
                      {/* Placeholder for image */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-muted-foreground">[Image: {suite.name}]</p>
                      </div>
                    </div>
                    <div className="p-8">
                      <h3 className="text-3xl font-serif font-bold text-foreground mb-2">
                        {suite.name}
                      </h3>
                      <p className="text-muted-foreground mb-6">{suite.description}</p>
                      
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                            <Users className="w-6 h-6 text-accent" />
                          </div>
                          <p className="text-sm font-medium text-foreground">{suite.guests}</p>
                          <p className="text-xs text-muted-foreground">Guests</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                            <Bed className="w-6 h-6 text-accent" />
                          </div>
                          <p className="text-sm font-medium text-foreground">{suite.beds}</p>
                          <p className="text-xs text-muted-foreground">Bedding</p>
                        </div>
                        <div className="text-center">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                            <Wind className="w-6 h-6 text-accent" />
                          </div>
                          <p className="text-sm font-medium text-foreground">{suite.size}</p>
                          <p className="text-xs text-muted-foreground">Size</p>
                        </div>
                      </div>

                      <div className="mb-6">
                        <h4 className="font-semibold text-foreground mb-3">Amenities</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {suite.amenities.map((amenity, i) => (
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
              ))}
            </div>
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

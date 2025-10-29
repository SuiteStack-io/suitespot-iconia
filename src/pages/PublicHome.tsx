import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-lobby.jpg";
import suitesFeature from "@/assets/iconia-zamalek-building.jpg";
import wellnessFeature from "@/assets/wellness-feature.jpg";
import experiencesFeature from "@/assets/experiences-feature.jpg";
import { BookingWidget } from "@/components/BookingWidget";
import { PublicNav } from "@/components/PublicNav";

const PublicHome = () => {
  return <div className="min-h-screen">
      {/* Navigation */}
      <PublicNav />

      {/* Hero Section with Photo Background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Photo Background */}
        <div className="absolute inset-0">
          <img src={heroImage} alt="SuiteSpot luxury lobby" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40" />
        </div>
        
        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <h1 className="text-3xl md:text-7xl font-serif font-bold text-white mb-6 animate-fade-in">Welcome Home</h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 animate-fade-in" style={{
          animationDelay: "0.2s"
        }}>Blending the comfort of home with the service of a boutique hotel in Zamalek</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in mb-8" style={{
          animationDelay: "0.4s"
        }}>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/book">Book Your Stay</Link>
            </Button>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/suites">Explore Suites</Link>
            </Button>
          </div>
          
          {/* Booking Widget */}
          <div className="animate-fade-in" style={{
          animationDelay: "0.6s"
        }}>
            <BookingWidget />
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-white/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Introduction Section */}
      <section className="py-24 px-6 bg-background">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-2xl md:text-5xl font-serif font-bold text-foreground mb-6">
            A New Standard<br className="md:hidden" /> in Serviced Living<br className="md:hidden" /> in Zamalek
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            SuiteSpot Hospitality redefines serviced apartment living in Egypt. We blend local culture, 
            modern design, and hotel-level service to create spaces that feel like home but offer so much more. 
            Perfect for both short escapes and extended stays, each property reflects our commitment to 
            wellness, style, and authentic Egyptian hospitality.
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white">
            <Link to="/our-story">Our Story</Link>
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full">
        <div className="grid md:grid-cols-3">
          {/* Suites */}
          <Link to="/suites" className="relative h-[650px] overflow-hidden group cursor-pointer">
            <img 
              src={suitesFeature} 
              alt="Luxurious suites" 
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105" 
              style={{ objectPosition: '50% 20%' }}
            />
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 text-center">
              <h3 className="text-3xl md:text-4xl font-serif font-bold mb-6 uppercase tracking-wider">
                Suites
              </h3>
              <p className="text-lg md:text-xl max-w-md opacity-90">
                Architecturally unique properties in Cairo's most vibrant neighborhoods, 
                starting with Iconia in Zamalek
              </p>
            </div>
          </Link>

          {/* Wellness */}
          <Link to="/wellness" className="relative h-[650px] overflow-hidden group cursor-pointer">
            <img 
              src={wellnessFeature} 
              alt="Wellness and yoga" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 text-center">
              <h3 className="text-3xl md:text-4xl font-serif font-bold mb-6 uppercase tracking-wider">
                Wellness
              </h3>
              <p className="text-lg md:text-xl max-w-md opacity-90">
                Yoga, fitness classes, and mindfulness sessions designed to nourish 
                your body and soul during your stay
              </p>
            </div>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <p className="text-sm text-white/80">powered by OnTrack</p>
            </div>
          </Link>

          {/* Experiences */}
          <Link to="/experiences" className="relative h-[650px] overflow-hidden group cursor-pointer">
            <img 
              src={experiencesFeature} 
              alt="Egyptian experiences" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 text-center">
              <h3 className="text-3xl md:text-4xl font-serif font-bold mb-6 uppercase tracking-wider">
                Experiences
              </h3>
              <p className="text-lg md:text-xl max-w-md opacity-90">
                From Pyramids tours to Nile cruises, explore Egypt's rich culture 
                with our handpicked experiences
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-background/80 backdrop-blur-md text-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            Ready to Experience SuiteSpot?
          </h2>
          <p className="text-xl mb-8 text-muted-foreground">
            Book your stay today and discover a new way to experience Egypt
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white">
            <Link to="/book">Book your stay</Link>
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
                <Link to="/our-story" className="block text-sm text-muted-foreground hover:text-foreground">Our Story</Link>
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
    </div>;
};
export default PublicHome;
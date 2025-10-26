import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar, MapPin, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-lobby.jpg";
const PublicHome = () => {
  return <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-serif font-bold text-foreground">
            SuiteSpot
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/our-story" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Our Story
            </Link>
            <Link to="/locations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Locations
            </Link>
            <Link to="/suites" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Suites
            </Link>
            <Link to="/wellness" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Wellness
            </Link>
            <Link to="/experiences" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Experiences
            </Link>
            <Link to="/nearby" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Nearby
            </Link>
          </div>
          <Button asChild className="bg-accent hover:bg-accent/90">
            <Link to="/book">Book Now</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section with Photo Background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Photo Background */}
        <div className="absolute inset-0">
          <img src={heroImage} alt="SuiteSpot luxury lobby" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40" />
        </div>
        
        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-6 animate-fade-in">Welcome Home</h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 animate-fade-in" style={{
          animationDelay: "0.2s"
        }}>Blending the comfort of home with the service of a boutique hotel</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{
          animationDelay: "0.4s"
        }}>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/book">Book Your Stay</Link>
            </Button>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/suites">Explore Suites</Link>
            </Button>
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
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-6">
            A New Standard in Serviced Living
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            SuiteSpot Hospitality redefines serviced apartment living in Egypt. We blend local culture, 
            modern design, and hotel-level service to create spaces that feel like home but offer so much more. 
            Perfect for both short escapes and extended stays, each property reflects our commitment to 
            wellness, style, and authentic Egyptian hospitality.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                Prime Locations
              </h3>
              <p className="text-muted-foreground">
                Architecturally unique properties in Cairo's most vibrant neighborhoods, 
                starting with Iconia in Zamalek
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                Wellness-Focused
              </h3>
              <p className="text-muted-foreground">
                Yoga, fitness classes, and mindfulness sessions designed to nourish 
                your body and soul during your stay
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                Curated Experiences
              </h3>
              <p className="text-muted-foreground">
                From Pyramids tours to Nile cruises, explore Egypt's rich culture 
                with our handpicked experiences
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6">
            Ready to Experience SuiteSpot?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Book your stay today and discover a new way to experience Egypt
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white">
            <Link to="/book">Check Availability</Link>
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
                <Link to="/nearby" className="block text-sm text-muted-foreground hover:text-foreground">Nearby</Link>
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
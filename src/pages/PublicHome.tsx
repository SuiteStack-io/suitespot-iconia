import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import suitesFeature from "@/assets/iconia-zamalek-building.jpg";
import wellnessFeature from "@/assets/wellness-feature.jpg";
import experiencesFeature from "@/assets/experiences-feature.jpg";
import { BookingWidget } from "@/components/BookingWidget";
import { PublicNav } from "@/components/PublicNav";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { SEO } from "@/components/SEO";
import { useRef } from "react";
const PublicHome = () => {
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const handleHeroTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleHeroTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleHeroTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > swipeThreshold) {
      const direction = diff > 0 ? 'right' : 'left';
      const event = new CustomEvent('hero-swipe', {
        detail: {
          direction
        }
      });
      window.dispatchEvent(event);
    }
  };
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "Organization",
      "@id": "https://www.findyoursuitespot.com/#organization",
      "name": "SuiteSpot Hospitality",
      "url": "https://www.findyoursuitespot.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.findyoursuitespot.com/suitespot-logo-3.png"
      },
      "description": "Premium serviced apartments in Cairo, Egypt. Blending hotel service with home comfort.",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "16 Mohammed Thakeb St, Iconia Building",
        "addressLocality": "Zamalek",
        "addressRegion": "Cairo",
        "addressCountry": "EG"
      },
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "info@findyoursuitespot.com",
        "contactType": "customer service"
      }
    }, {
      "@type": "WebSite",
      "@id": "https://www.findyoursuitespot.com/#website",
      "url": "https://www.findyoursuitespot.com",
      "name": "SuiteSpot Hospitality",
      "publisher": {
        "@id": "https://www.findyoursuitespot.com/#organization"
      }
    }]
  };
  return <div className="min-h-screen">
      <SEO title="SuiteSpot Hospitality | Premium Serviced Apartments in Cairo, Egypt" description="Experience luxury serviced apartments in Zamalek, Cairo. SuiteSpot blends hotel service with home comfort. Wellness programs, stunning Nile views, and authentic Egyptian hospitality." path="/" additionalJsonLd={organizationJsonLd} />

      {/* Navigation */}
      <PublicNav />

      {/* Hero Section with Slideshow Background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Slideshow Background */}
        <HeroSlideshow />
        
        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-4xl mt-16 md:mt-0" onTouchStart={handleHeroTouchStart} onTouchMove={handleHeroTouchMove} onTouchEnd={handleHeroTouchEnd}>
          <h1 className="text-[40px] md:text-[60px] font-playfair font-semibold tracking-[-0.02em] text-white mb-6 animate-fade-in" style={{
          textShadow: "1px 1px 3px rgba(0,0,0,0.6), 0 0 15px rgba(0,0,0,0.4)"
        }}>ICONIA Zamalek</h1>
          <p className="text-[20px] md:text-[28px] font-playfair font-light text-white/90 mb-48 md:mb-8 animate-fade-in" style={{
          animationDelay: "0.2s",
          textShadow: "2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6)"
        }}>More space than a hotel. More service than an apartment. All the comfort of home.</p>
          
          {/* Desktop buttons only */}
          <div className="hidden sm:flex gap-4 justify-center animate-fade-in mb-8 mt-16" style={{
          animationDelay: "0.4s"
        }}>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-playfair font-medium text-[14px]">
              <Link to="/book">Book Your Stay</Link>
            </Button>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 font-playfair font-medium text-[14px]">
              <Link to="/suites">Explore Suites</Link>
            </Button>
          </div>
          
          {/* Booking Widget */}
          <div className="animate-fade-in" style={{
          animationDelay: "0.6s"
        }}>
            <BookingWidget />
          </div>

          {/* Mobile Explore Suites button - below search */}
          <div className="sm:hidden mt-4 animate-fade-in" style={{
          animationDelay: "0.8s"
        }}>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 w-full max-w-sm mx-auto font-playfair font-medium text-[14px]">
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
      <section className="py-24 px-4 bg-background">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-[40px] md:text-[60px] font-playfair font-semibold tracking-[-0.02em] text-foreground mb-6">
            A New Standard<br className="md:hidden" /> in Serviced Living<br className="md:hidden" /> in Zamalek
          </h2>
          <p className="text-[14px] md:text-[16px] font-playfair font-normal leading-[1.5] text-muted-foreground mb-8">
            SuiteSpot Hospitality redefines serviced apartment living in Egypt. We blend local culture, 
            modern design, and hotel-level service to create spaces that feel like home but offer so much more. 
            Perfect for both short escapes and extended stays, each property reflects our commitment to 
            wellness, style, and authentic Egyptian hospitality.
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white font-playfair font-medium text-[14px]">
            <Link to="/iconia-zamalek">ICONIA Zamalek</Link>
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="w-full">
        <div className="grid md:grid-cols-3">
          {/* Suites */}
          <Link to="/suites" className="relative h-[500px] md:h-[650px] overflow-hidden group cursor-pointer">
            <img src={suitesFeature} alt="Luxurious suites" className="w-full h-full object-cover object-[50%_10%] md:object-[50%_20%] transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 text-center">
              <h3 className="text-[28px] md:text-[36px] font-playfair font-semibold tracking-[-0.02em] mb-6 uppercase">
                Suites
              </h3>
              <p className="text-[14px] md:text-[16px] font-playfair font-normal leading-[1.5] max-w-md opacity-90">
                Architecturally unique properties in Cairo's most vibrant neighborhoods, 
                starting with Iconia in Zamalek
              </p>
            </div>
          </Link>

          {/* Wellness */}
          <Link to="/wellness" className="relative h-[500px] md:h-[650px] overflow-hidden group cursor-pointer">
            <img src={wellnessFeature} alt="Wellness and yoga" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 text-center">
              <h3 className="text-[28px] md:text-[36px] font-playfair font-semibold tracking-[-0.02em] mb-6 uppercase">
                Wellness
              </h3>
              <p className="text-[14px] md:text-[16px] font-playfair font-normal leading-[1.5] max-w-md opacity-90">
                Yoga, fitness classes, and mindfulness sessions designed to nourish 
                your body and soul during your stay
              </p>
            </div>
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              <p className="text-sm text-white/80">powered by OnTrack</p>
            </div>
          </Link>

          {/* Experiences */}
          <Link to="/experiences" className="relative h-[500px] md:h-[650px] overflow-hidden group cursor-pointer">
            <img src={experiencesFeature} alt="Egyptian experiences" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-black/40 transition-opacity duration-300 group-hover:bg-black/50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-8 text-center">
              <h3 className="text-[28px] md:text-[36px] font-playfair font-semibold tracking-[-0.02em] mb-6 uppercase">
                Experiences
              </h3>
              <p className="text-[14px] md:text-[16px] font-playfair font-normal leading-[1.5] max-w-md opacity-90">
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
          <h2 className="text-[40px] md:text-[60px] font-playfair font-semibold tracking-[-0.02em] mb-6">
            Ready to Experience SuiteSpot?
          </h2>
          <p className="text-[14px] md:text-[16px] font-playfair font-normal leading-[1.5] mb-8 text-muted-foreground">
            Book your stay today and discover a new way to experience Egypt
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-white font-playfair font-medium text-[14px]">
            <Link to="/book">Book your stay</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-card border-t border-border">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-[20px] font-playfair font-semibold text-foreground mb-4">SuiteSpot</h3>
              <p className="text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground">
                Redefining serviced apartment living in Egypt
              </p>
            </div>
            <div>
              <h4 className="font-playfair font-medium text-[14px] text-foreground mb-4">Explore</h4>
              <div className="space-y-2">
                <Link to="/about" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">About</Link>
                <Link to="/iconia-zamalek" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">ICONIA Zamalek</Link>
                <Link to="/locations" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">Locations</Link>
                <Link to="/suites" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">Suites</Link>
              </div>
            </div>
            <div>
              <h4 className="font-playfair font-medium text-[14px] text-foreground mb-4">Experience</h4>
              <div className="space-y-2">
                <Link to="/wellness" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">Wellness</Link>
                <Link to="/experiences" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">Experiences</Link>
                <Link to="/nearby" className="block text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground hover:text-foreground">Nearby Amenities</Link>
              </div>
            </div>
            <div>
              <h4 className="font-playfair font-medium text-[14px] text-foreground mb-4">Contact</h4>
              <p className="text-[14px] font-playfair font-normal leading-[1.5] text-muted-foreground">
                Iconia, Zamalek<br />
                Cairo, Egypt
              </p>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-muted-foreground">
            <p className="text-[14px] font-playfair font-normal leading-[1.5]">&copy; 2025 SuiteSpot Hospitality. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>;
};
export default PublicHome;
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { User, Menu } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/suitespot-logo.png";

export const PublicNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent border-b border-white/20">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between bg-white/25 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SuiteSpot logo" className="h-8 w-8" />
            <span className="text-2xl font-serif font-bold text-foreground">SuiteSpot</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden px-3 py-2 flex flex-col items-center justify-center gap-1 bg-muted hover:bg-accent transition-colors rounded-lg"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-foreground" strokeWidth={2.5} />
            <span className="text-xs font-medium tracking-wider text-foreground">MENU</span>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/our-story" className="text-sm text-white hover:text-white/80 transition-colors">
            Our Story
          </Link>
          <Link to="/locations" className="text-sm text-white hover:text-white/80 transition-colors">
            Locations
          </Link>
          <Link to="/suites" className="text-sm text-white hover:text-white/80 transition-colors">
            Suites
          </Link>
          <Link to="/wellness" className="text-sm text-white hover:text-white/80 transition-colors">
            Wellness
          </Link>
          <Link to="/experiences" className="text-sm text-white hover:text-white/80 transition-colors">
            Experiences
          </Link>
          <Link to="/nearby" className="text-sm text-white hover:text-white/80 transition-colors">
            Nearby Amenities
          </Link>
          <Link to="/blog" className="text-sm text-white hover:text-white/80 transition-colors">
            Blog
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link 
            to="/admin" 
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-muted hover:bg-accent transition-colors"
            aria-label="Admin Dashboard"
          >
            <User className="h-5 w-5 text-foreground" />
          </Link>
          <Button asChild className="bg-accent hover:bg-accent/90 hidden md:inline-flex">
            <Link to="/book">Book Now</Link>
          </Button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg animate-fade-in z-50">
          <div className="container mx-auto px-6 py-4 space-y-3">
            <Link 
              to="/our-story" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Our Story
            </Link>
            <Link 
              to="/locations" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Locations
            </Link>
            <Link 
              to="/suites" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Suites
            </Link>
            <Link 
              to="/wellness" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Wellness
            </Link>
            <Link 
              to="/experiences" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Experiences
            </Link>
            <Link 
              to="/nearby" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Nearby Amenities
            </Link>
            <Link 
              to="/blog" 
              className="block py-3 text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={() => setMobileMenuOpen(false)}
            >
              Blog
            </Link>
            <Button asChild className="w-full bg-accent hover:bg-accent/90 mt-4">
              <Link to="/book" onClick={() => setMobileMenuOpen(false)}>Book Now</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

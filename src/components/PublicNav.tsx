import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { User, Menu } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/suitespot-logo.png";

export const PublicNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="SuiteSpot logo" className="h-8 w-8" />
          <span className="text-2xl font-serif font-bold text-foreground">SuiteSpot</span>
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
            Nearby Amenities
          </Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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
      
      {/* Mobile Menu Button - Only visible on mobile */}
      <div className="md:hidden border-t border-border">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="py-3 px-6 flex flex-col items-center justify-center gap-1 bg-[#5D4E37] text-white hover:bg-[#4a3e2c] transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" strokeWidth={2.5} />
          <span className="text-xs font-medium tracking-wider">MENU</span>
        </button>
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

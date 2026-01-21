import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import { useState, useEffect } from "react";
import logo from "@/assets/suitespot-logo.png";
import menuIcon from "@/assets/menu-icon.png";

export const PublicNav = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleMenuClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setMobileMenuOpen(false);
      setIsClosing(false);
    }, 500); // Match animation duration
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      {/* Dark gradient overlay behind nav */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent pointer-events-none" />
      
      <div className="relative container mx-auto px-6 py-4 flex items-center justify-between bg-white/25 backdrop-blur-md border-b border-white/20">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SuiteSpot logo" className="h-8 w-8" />
            <span className="text-2xl font-serif font-bold text-foreground">SuiteSpot</span>
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <Link to="/about" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            About
          </Link>
          <Link to="/locations" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            Locations
          </Link>
          <Link to="/suites" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            Suites
          </Link>
          <Link to="/wellness" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            Wellness
          </Link>
          <Link to="/experiences" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            Experiences
          </Link>
          <Link to="/nearby" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            Nearby Amenities
          </Link>
          <Link to="/blog" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            Blog
          </Link>
          <Link to="/iconia-zamalek" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            ICONIA Zamalek
          </Link>
          <Link to="/faq" className="font-playfair font-medium text-[14px] text-white hover:text-white/80 transition-colors">
            FAQ
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => mobileMenuOpen ? handleMenuClose() : setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-full bg-muted hover:bg-accent transition-colors"
            aria-label="Toggle menu"
          >
            <img src={menuIcon} alt="Menu" className="h-5 w-5" />
          </button>
          <Link 
            to="/admin" 
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex p-2 rounded-full bg-muted hover:bg-accent transition-colors"
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
        <div className={`md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg z-50 ${isClosing ? 'animate-slide-up' : 'animate-slide-down'}`}>
          <div className="container mx-auto px-6 py-4 space-y-3">
            <Link 
              to="/about" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              About
            </Link>
            <Link 
              to="/locations" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Locations
            </Link>
            <Link 
              to="/suites" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Suites
            </Link>
            <Link 
              to="/wellness" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Wellness
            </Link>
            <Link 
              to="/experiences" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Experiences
            </Link>
            <Link 
              to="/nearby" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Nearby Amenities
            </Link>
            <Link 
              to="/blog" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Blog
            </Link>
            <Link 
              to="/iconia-zamalek" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              ICONIA Zamalek
            </Link>
            <Link 
              to="/faq" 
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              FAQ
            </Link>
            <a 
              href="/auth"
              target="_blank"
              rel="noopener noreferrer"
              className="block py-3 font-playfair font-medium text-[14px] text-foreground hover:text-accent transition-colors border-b border-border"
              onClick={handleMenuClose}
            >
              Admin
            </a>
            <Button asChild className="w-full bg-accent hover:bg-accent/90 mt-4 font-playfair font-medium text-[14px]">
              <Link to="/book" onClick={handleMenuClose}>Book Now</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

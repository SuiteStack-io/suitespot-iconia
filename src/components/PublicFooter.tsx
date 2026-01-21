import { Link } from "react-router-dom";
import { Instagram, Facebook, Linkedin } from "lucide-react";

export const PublicFooter = () => {
  return (
    <footer className="py-12 px-6 bg-card border-t border-border mt-24">
      <div className="container mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-serif font-bold text-foreground mb-4">SuiteSpot</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Redefining serviced apartment living in Egypt
            </p>
            <div className="flex gap-3">
              <a 
                href="https://instagram.com/suitespotegypt" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-white transition-colors"
                aria-label="Follow us on Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a 
                href="https://facebook.com/suitespotegypt" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-white transition-colors"
                aria-label="Follow us on Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a 
                href="https://linkedin.com/company/suitespot-hospitality" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-white transition-colors"
                aria-label="Follow us on LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Explore</h4>
            <div className="space-y-2">
              <Link to="/iconia-zamalek" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">ICONIA Zamalek</Link>
              <Link to="/locations" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Locations</Link>
              <Link to="/suites" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Suites</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-4">Experience</h4>
            <div className="space-y-2">
              <Link to="/wellness" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Wellness</Link>
              <Link to="/experiences" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Experiences</Link>
              <Link to="/nearby" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Nearby</Link>
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
  );
};

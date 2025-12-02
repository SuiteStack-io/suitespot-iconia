import { Link } from "react-router-dom";

export const PublicFooter = () => {
  return (
    <footer className="py-12 px-6 bg-card border-t border-border mt-24">
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
              <Link to="/our-story" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Our Story</Link>
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

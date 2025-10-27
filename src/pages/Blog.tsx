import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import logo from "@/assets/suitespot-logo.png";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
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
              Nearby
            </Link>
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Blog
            </Link>
          </div>
          <Button asChild className="bg-accent hover:bg-accent/90">
            <Link to="/book">Book Now</Link>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-foreground mb-6">
            SuiteSpot Blog
          </h1>
          <p className="text-xl text-muted-foreground">
            Stories, insights, and inspiration from our serviced living community
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Placeholder for blog posts - will be populated from database */}
            <div className="text-center py-16 col-span-full">
              <p className="text-muted-foreground">Blog posts coming soon...</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
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
    </div>
  );
};

export default Blog;

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Dumbbell, Heart, Sunrise, Users } from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/components/PublicFooter";
import { SEO } from "@/components/SEO";

const Wellness = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Wellness Activities | Yoga, Fitness & Mindfulness - SuiteSpot"
        description="Nourish your body and soul during your stay. Rooftop yoga, fitness classes, and mindfulness sessions at SuiteSpot's wellness center in Cairo."
        path="/wellness"
        ogImage="/slideshow/rooftop.jpg"
        breadcrumbs={[
          { name: "Home", path: "/" },
          { name: "Wellness" }
        ]}
      />

      <PublicNav />

      <div className="pt-20">
        {/* Hero Section */}
        <section className="py-8 md:py-13 px-[20px] mx-[40px] bg-gradient-to-b from-primary/5 to-background">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="font-playfair font-semibold text-[40px] md:text-[80px] tracking-[-0.02em] leading-[1.1] text-foreground mb-6">Wellness Activities</h1>
            <p className="font-playfair font-medium text-[24px] md:text-[36px] text-muted-foreground">
              Nourish your body and soul during your stay
            </p>
          </div>
        </section>

        {/* Introduction */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-4xl text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              At SuiteSpot, wellness is not an add-on—it's woven into the fabric of your stay. 
              Our rooftop wellness center and curated programs are designed to help you find balance, 
              rejuvenation, and connection during your time with us.
            </p>
          </div>
        </section>

        {/* Activities Grid */}
        <section className="py-12 px-6 bg-muted/30">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="p-8">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-6">
                  <Sunrise className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                  Yoga & Meditation
                </h3>
                <p className="text-muted-foreground mb-6">
                  Start your day with sunrise yoga sessions on our rooftop terrace, or wind down with 
                  evening meditation classes. All levels welcome, from beginners to advanced practitioners.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Morning sessions: 7:00 AM - 8:00 AM</p>
                  <p>• Evening sessions: 6:00 PM - 7:00 PM</p>
                  <p>• Private sessions available upon request</p>
                </div>
              </Card>

              <Card className="p-8">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-6">
                  <Dumbbell className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                  Fitness Classes
                </h3>
                <p className="text-muted-foreground mb-6">
                  From high-intensity interval training to gentle stretching, our fitness classes cater 
                  to all fitness levels and goals. Equipment provided.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• HIIT: Monday & Wednesday, 6:00 PM</p>
                  <p>• Pilates: Tuesday & Thursday, 7:00 AM</p>
                  <p>• Personal training sessions available</p>
                </div>
              </Card>

              <Card className="p-8">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-6">
                  <Heart className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                  Mindfulness Sessions
                </h3>
                <p className="text-muted-foreground mb-6">
                  Learn techniques for stress reduction, better sleep, and mental clarity through 
                  guided mindfulness practices and breathing exercises.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Weekly workshops: Saturdays, 10:00 AM</p>
                  <p>• One-on-one sessions: By appointment</p>
                  <p>• In-suite guided meditation available</p>
                </div>
              </Card>

              <Card className="p-8">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-6">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-foreground mb-4">
                  Group Wellness Programs
                </h3>
                <p className="text-muted-foreground mb-6">
                  Join our community wellness programs including nutrition workshops, sound healing sessions, 
                  and holistic health talks led by local practitioners.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Monthly nutrition workshops</p>
                  <p>• Quarterly wellness retreats</p>
                  <p>• Community wellness circles</p>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Rooftop Wellness Center */}
        <section className="py-24 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-serif font-bold text-foreground mb-6">
                  Rooftop Wellness Center
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Our stunning rooftop wellness center offers panoramic views of Cairo while you practice. 
                  Equipped with state-of-the-art facilities and natural light, it's designed to inspire 
                  your wellness journey.
                </p>
                <ul className="space-y-3 text-muted-foreground mb-8">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2"></span>
                    <span>Professional yoga and fitness equipment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2"></span>
                    <span>Shaded areas and open-air spaces</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2"></span>
                    <span>Changing rooms and showers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full mt-2"></span>
                    <span>Complimentary towels and mats</span>
                  </li>
                </ul>
                <Button asChild className="bg-accent hover:bg-accent/90">
                  <Link to="/book">Book Your Wellness Retreat</Link>
                </Button>
              </div>
              <div className="h-96 bg-gradient-to-br from-accent/20 to-primary/20 rounded-lg flex items-center justify-center">
                {/* Placeholder for image */}
                <p className="text-muted-foreground">[Image: Rooftop Wellness Center]</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <PublicFooter />
    </div>
  );
};

export default Wellness;

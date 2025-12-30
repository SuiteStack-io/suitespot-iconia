import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { PublicNav } from "@/components/PublicNav";
import { SEO } from "@/components/SEO";

const BookingConfirmation = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Booking Confirmed | SuiteSpot"
        description="Your reservation is confirmed. Thank you for choosing SuiteSpot."
        path="/booking-confirmation"
        robots="noindex, nofollow"
      />

      {/* Navigation */}
      <PublicNav />

      <div className="container mx-auto px-6 py-24 pt-32">
        <Card className="max-w-2xl mx-auto p-12 text-center">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>
          
          <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
            Booking Confirmed!
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Thank you for choosing SuiteSpot. We've sent a confirmation email with all the details of your reservation.
          </p>

          <div className="bg-muted/30 rounded-lg p-6 mb-8 text-left">
            <h3 className="font-semibold text-foreground mb-3">What's Next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Check your email for booking confirmation and details</li>
              <li>• You'll receive check-in instructions 24 hours before arrival</li>
              <li>• Our concierge team will contact you to arrange any experiences or wellness activities</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild variant="outline">
              <Link to="/">Return to Home</Link>
            </Button>
            <Button asChild className="bg-accent hover:bg-accent/90">
              <Link to="/suites">Explore More Suites</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BookingConfirmation;

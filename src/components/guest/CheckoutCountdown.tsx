import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface CheckoutCountdownProps {
  checkoutDate: string;
}

export function CheckoutCountdown({ checkoutDate }: CheckoutCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const checkout = new Date(checkoutDate);
      checkout.setHours(11, 0, 0, 0); // Checkout at 11:00 AM
      const now = new Date();
      const difference = checkout.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [checkoutDate]);

  if (!timeLeft) return null;

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Clock className="h-5 w-5" />
          Checkout Countdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6 justify-center">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {timeLeft.days}
            </div>
            <div className="text-sm text-muted-foreground">Days</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {timeLeft.hours}
            </div>
            <div className="text-sm text-muted-foreground">Hours</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {timeLeft.minutes}
            </div>
            <div className="text-sm text-muted-foreground">Minutes</div>
          </div>
        </div>
        <p className="text-center mt-4 text-sm text-muted-foreground">
          Checkout time: 11:00 AM
        </p>
      </CardContent>
    </Card>
  );
}

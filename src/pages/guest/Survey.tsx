import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Star, CheckCircle2 } from "lucide-react";

const Survey = () => {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [resolutionSatisfaction, setResolutionSatisfaction] = useState<number>(0);
  const [responseTimeSatisfaction, setResponseTimeSatisfaction] = useState<number>(0);
  const [wouldRecommend, setWouldRecommend] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0 || resolutionSatisfaction === 0 || responseTimeSatisfaction === 0 || !wouldRecommend) {
      toast({
        title: "Please complete all ratings",
        description: "All rating fields are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Get ticket details
      const { data: ticket, error: ticketError } = await supabase
        .from("guest_tickets")
        .select("guest_account_id, reservation_id")
        .eq("id", ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Submit survey
      const { error } = await supabase.from("ticket_surveys").insert({
        ticket_id: ticketId,
        guest_account_id: ticket.guest_account_id,
        reservation_id: ticket.reservation_id,
        rating,
        resolution_satisfaction: resolutionSatisfaction,
        response_time_satisfaction: responseTimeSatisfaction,
        would_recommend: wouldRecommend === "yes",
        feedback: feedback.trim() || null,
      });

      if (error) throw error;

      setSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted successfully",
      });
    } catch (error) {
      console.error("Error submitting survey:", error);
      toast({
        title: "Error",
        description: "Failed to submit survey. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              Your feedback helps us improve our service for all guests.
            </p>
            <Button onClick={() => navigate("/guest/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-8 h-8 ${
                star <= value ? "fill-primary text-primary" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-2xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Share Your Feedback</CardTitle>
            <p className="text-muted-foreground">
              Help us improve by sharing your experience with our service
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <StarRating
                value={rating}
                onChange={setRating}
                label="Overall Experience"
              />

              <StarRating
                value={resolutionSatisfaction}
                onChange={setResolutionSatisfaction}
                label="How satisfied are you with the resolution?"
              />

              <StarRating
                value={responseTimeSatisfaction}
                onChange={setResponseTimeSatisfaction}
                label="How satisfied are you with our response time?"
              />

              <div className="space-y-2">
                <Label>Would you recommend our property to others?</Label>
                <RadioGroup value={wouldRecommend} onValueChange={setWouldRecommend}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes" />
                    <Label htmlFor="yes" className="font-normal cursor-pointer">
                      Yes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="no" />
                    <Label htmlFor="no" className="font-normal cursor-pointer">
                      No
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Additional Comments (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us more about your experience..."
                  rows={4}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Submitting..." : "Submit Survey"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Survey;

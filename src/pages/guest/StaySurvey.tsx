import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Star, CheckCircle2, Loader2 } from "lucide-react";

const StaySurvey = () => {
  const { reservationId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingReservation, setFetchingReservation] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [overallRating, setOverallRating] = useState<number>(0);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(0);
  const [amenitiesRating, setAmenitiesRating] = useState<number>(0);
  const [locationRating, setLocationRating] = useState<number>(0);
  const [valueRating, setValueRating] = useState<number>(0);
  const [wouldRecommend, setWouldRecommend] = useState<string>("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    fetchReservation();
  }, [reservationId]);

  const fetchReservation = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, units!unit_id(name)")
        .eq("id", reservationId)
        .single();

      if (error) throw error;
      
      // Check if survey already completed
      if (data.survey_completed_at) {
        setSubmitted(true);
      }
      
      setReservation(data);
    } catch (error) {
      console.error("Error fetching reservation:", error);
      toast({
        title: "Error",
        description: "Could not load reservation details",
        variant: "destructive",
      });
    } finally {
      setFetchingReservation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (overallRating === 0 || cleanlinessRating === 0 || amenitiesRating === 0 || 
        locationRating === 0 || valueRating === 0 || !wouldRecommend) {
      toast({
        title: "Please complete all ratings",
        description: "All rating fields are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Submit survey
      const { error: surveyError } = await supabase.from("stay_surveys").insert({
        reservation_id: reservationId,
        overall_rating: overallRating,
        cleanliness_rating: cleanlinessRating,
        amenities_rating: amenitiesRating,
        location_rating: locationRating,
        value_rating: valueRating,
        would_recommend: wouldRecommend === "yes",
        feedback: feedback.trim() || null,
      });

      if (surveyError) throw surveyError;

      // Mark survey as completed
      const { error: updateError } = await supabase
        .from("reservations")
        .update({ survey_completed_at: new Date().toISOString() })
        .eq("id", reservationId);

      if (updateError) throw updateError;

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

  if (fetchingReservation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-6">
              Your feedback helps us improve and provide better experiences for all our guests.
            </p>
            <p className="text-sm text-muted-foreground">
              We hope to welcome you back soon!
            </p>
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
            <CardTitle className="text-2xl">How was your stay?</CardTitle>
            {reservation && (
              <p className="text-muted-foreground">
                {reservation.units?.name} • {new Date(reservation.check_in_date).toLocaleDateString()} - {new Date(reservation.check_out_date).toLocaleDateString()}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <StarRating
                value={overallRating}
                onChange={setOverallRating}
                label="Overall Experience"
              />

              <StarRating
                value={cleanlinessRating}
                onChange={setCleanlinessRating}
                label="Cleanliness"
              />

              <StarRating
                value={amenitiesRating}
                onChange={setAmenitiesRating}
                label="Amenities & Facilities"
              />

              <StarRating
                value={locationRating}
                onChange={setLocationRating}
                label="Location"
              />

              <StarRating
                value={valueRating}
                onChange={setValueRating}
                label="Value for Money"
              />

              <div className="space-y-2">
                <Label>Would you recommend us to others?</Label>
                <RadioGroup value={wouldRecommend} onValueChange={setWouldRecommend}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="yes" />
                    <Label htmlFor="yes" className="font-normal cursor-pointer">
                      Yes, definitely!
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
                <Label htmlFor="feedback">Tell us more about your stay (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What did you love? What could we improve?"
                  rows={4}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Submitting..." : "Submit Feedback"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaySurvey;

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ThumbsUp, Home, Sparkles, MapPin, DollarSign } from "lucide-react";

const StaySurveyAnalytics = () => {
  const { data: surveys } = useQuery({
    queryKey: ["stay-surveys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stay_surveys")
        .select(`
          *,
          reservations (
            booking_reference,
            check_in_date,
            check_out_date,
            units (name)
          )
        `)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (!surveys || surveys.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          No guest feedback yet
        </CardContent>
      </Card>
    );
  }

  const avgOverall = (surveys.reduce((sum, s) => sum + s.overall_rating, 0) / surveys.length).toFixed(1);
  const avgCleanliness = (surveys.reduce((sum, s) => sum + (s.cleanliness_rating || 0), 0) / surveys.length).toFixed(1);
  const avgAmenities = (surveys.reduce((sum, s) => sum + (s.amenities_rating || 0), 0) / surveys.length).toFixed(1);
  const avgLocation = (surveys.reduce((sum, s) => sum + (s.location_rating || 0), 0) / surveys.length).toFixed(1);
  const avgValue = (surveys.reduce((sum, s) => sum + (s.value_rating || 0), 0) / surveys.length).toFixed(1);
  const recommendCount = surveys.filter(s => s.would_recommend).length;
  const recommendPercentage = ((recommendCount / surveys.length) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgOverall} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              From {surveys.length} guests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cleanliness</CardTitle>
            <Sparkles className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCleanliness} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              Cleanliness rating
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Amenities</CardTitle>
            <Home className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgAmenities} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              Facilities rating
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgLocation} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              Location rating
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgValue} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              Value for money
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Would Recommend</CardTitle>
            <ThumbsUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recommendPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {recommendCount} of {surveys.length} guests
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Guest Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {surveys
              .filter(s => s.feedback)
              .slice(0, 10)
              .map((survey: any) => (
                <div key={survey.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < survey.overall_rating ? "fill-primary text-primary" : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium">
                        {survey.reservations?.units?.name}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(survey.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{survey.feedback}</p>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaySurveyAnalytics;

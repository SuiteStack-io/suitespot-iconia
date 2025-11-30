import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ThumbsUp, TrendingUp, MessageSquare } from "lucide-react";

interface SurveyAnalyticsProps {
  dateRange?: { startDate: string; endDate: string };
}

const SurveyAnalytics = ({ dateRange }: SurveyAnalyticsProps) => {
  const { data: surveys } = useQuery({
    queryKey: ["surveys", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("ticket_surveys")
        .select(`
          *,
          guest_tickets (
            title,
            ticket_type
          )
        `);

      if (dateRange) {
        query = query
          .gte('submitted_at', dateRange.startDate)
          .lte('submitted_at', dateRange.endDate + 'T23:59:59');
      }

      const { data, error } = await query.order("submitted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (!surveys || surveys.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          {dateRange ? "No survey responses for the selected period" : "No survey responses yet"}
        </CardContent>
      </Card>
    );
  }

  const avgRating = (surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length).toFixed(1);
  const avgResolution = (surveys.reduce((sum, s) => sum + s.resolution_satisfaction, 0) / surveys.length).toFixed(1);
  const avgResponseTime = (surveys.reduce((sum, s) => sum + s.response_time_satisfaction, 0) / surveys.length).toFixed(1);
  const recommendCount = surveys.filter(s => s.would_recommend).length;
  const recommendPercentage = ((recommendCount / surveys.length) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRating} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              From {surveys.length} responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResolution} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              Resolution satisfaction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              Response time rating
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
          <CardTitle>Recent Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {surveys
              .filter(s => s.feedback)
              .slice(0, 5)
              .map((survey) => (
                <div key={survey.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < survey.rating ? "fill-primary text-primary" : "text-muted-foreground"
                          }`}
                        />
                      ))}
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

export default SurveyAnalytics;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

const SurveyTrigger = () => {
  const [loading, setLoading] = useState(false);

  const handleTriggerSurveys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-checkout-surveys");

      if (error) throw error;

      toast.success(
        `Survey emails queued for ${data.reservationsFound} recent checkouts`
      );
    } catch (error: any) {
      console.error("Error triggering surveys:", error);
      toast.error(error.message || "Failed to trigger survey emails");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Guest Feedback Surveys
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send satisfaction surveys to guests who have recently checked out. Surveys are automatically
          sent to guests whose checkout date was in the last 24 hours and who haven't received a survey yet.
        </p>
        <Button
          onClick={handleTriggerSurveys}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Surveys...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send Checkout Surveys Now
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          Tip: Set up a daily automated trigger to send surveys automatically
        </p>
      </CardContent>
    </Card>
  );
};

export default SurveyTrigger;

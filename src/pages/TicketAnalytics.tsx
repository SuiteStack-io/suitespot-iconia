import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import TicketMetrics from "@/components/analytics/TicketMetrics";
import ResolutionTimeChart from "@/components/analytics/ResolutionTimeChart";
import TicketTypeChart from "@/components/analytics/TicketTypeChart";
import SurveyAnalytics from "@/components/analytics/SurveyAnalytics";
import StaySurveyAnalytics from "@/components/analytics/StaySurveyAnalytics";
import { BarChart3, ArrowLeft } from "lucide-react";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";
import { useNavigate } from "react-router-dom";

interface TicketData {
  id: string;
  created_at: string;
  resolved_at: string | null;
  status: string;
  ticket_type: string;
  priority: string;
  assigned_to: string | null;
}

const TicketAnalytics = () => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("guest_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <SlideMenu isAdmin={userRole === 'admin'} />
        
        {/* Mobile back button - icon only */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin')}
          className="md:hidden"
          size="icon"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        {/* Desktop back button with text */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin')}
          className="hidden md:flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <BarChart3 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Ticket Analytics</h1>
      </div>

      <TicketMetrics tickets={tickets} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResolutionTimeChart tickets={tickets} />
        <TicketTypeChart tickets={tickets} />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Guest Feedback</h2>
        <StaySurveyAnalytics />
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Ticket Resolution Feedback</h2>
        <SurveyAnalytics />
      </div>
    </div>
  );
};

export default TicketAnalytics;

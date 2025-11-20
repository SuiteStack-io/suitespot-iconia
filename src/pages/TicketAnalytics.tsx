import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import TicketMetrics from "@/components/analytics/TicketMetrics";
import ResolutionTimeChart from "@/components/analytics/ResolutionTimeChart";
import TicketTypeChart from "@/components/analytics/TicketTypeChart";
import SurveyAnalytics from "@/components/analytics/SurveyAnalytics";
import { BarChart3 } from "lucide-react";

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
        <BarChart3 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Ticket Analytics</h1>
      </div>

      <TicketMetrics tickets={tickets} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResolutionTimeChart tickets={tickets} />
        <TicketTypeChart tickets={tickets} />
      </div>

      <SurveyAnalytics />
    </div>
  );
};

export default TicketAnalytics;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { History, Clock } from "lucide-react";

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  ticket_type: string;
  created_at: string;
  resolved_at: string | null;
  photo_url: string | null;
}

interface TicketHistoryProps {
  guestAccountId: string;
}

const TicketHistory = ({ guestAccountId }: TicketHistoryProps) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, [guestAccountId]);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("guest_tickets")
        .select("*")
        .eq("guest_account_id", guestAccountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      open: "bg-yellow-500",
      in_progress: "bg-blue-500",
      resolved: "bg-green-500",
      closed: "bg-gray-500",
    };
    return colors[status as keyof typeof colors] || "bg-gray-500";
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-green-500",
      medium: "bg-yellow-500",
      high: "bg-orange-500",
      urgent: "bg-red-500",
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Ticket History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No tickets submitted yet
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <Card key={ticket.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold">{ticket.title}</h4>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(ticket.created_at), "MMM d, yyyy h:mm a")}
                      </div>
                      {ticket.resolved_at && (
                        <div className="text-green-600">
                          Resolved: {format(new Date(ticket.resolved_at), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                    {ticket.photo_url && (
                      <img
                        src={ticket.photo_url}
                        alt="Ticket"
                        className="mt-3 rounded-lg max-h-40 object-cover"
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default TicketHistory;

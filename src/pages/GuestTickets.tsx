import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketList } from "@/components/tickets/TicketList";
import { TicketFilters } from "@/components/tickets/TicketFilters";
import { TicketStats } from "@/components/tickets/TicketStats";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";

export default function GuestTickets() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "all",
    priority: "all",
    ticketType: "all",
    assignedTo: "all",
  });

  useEffect(() => {
    fetchTickets();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("guest-tickets-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guest_tickets",
        },
        (payload) => {
          console.log("Ticket update:", payload);
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("guest_tickets")
        .select(`
          *,
          guest_accounts (
            username,
            reservation_id
          ),
          reservations (
            guest_names,
            units (
              name,
              unit_number
            )
          ),
          assigned_to_profile:profiles!guest_tickets_assigned_to_fkey (
            full_name
          ),
          resolved_by_profile:profiles!guest_tickets_resolved_by_fkey (
            full_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filters.status !== "all" && ticket.status !== filters.status) return false;
    if (filters.priority !== "all" && ticket.priority !== filters.priority) return false;
    if (filters.ticketType !== "all" && ticket.ticket_type !== filters.ticketType) return false;
    if (filters.assignedTo !== "all") {
      if (filters.assignedTo === "unassigned" && ticket.assigned_to) return false;
      if (filters.assignedTo !== "unassigned" && ticket.assigned_to !== filters.assignedTo) return false;
    }
    return true;
  });

  const ticketsByStatus = {
    open: filteredTickets.filter((t) => t.status === "open"),
    in_progress: filteredTickets.filter((t) => t.status === "in_progress"),
    resolved: filteredTickets.filter((t) => t.status === "resolved"),
    closed: filteredTickets.filter((t) => t.status === "closed"),
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
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
        
        <div>
          <h1 className="text-3xl font-bold text-foreground">Guest Tickets</h1>
          <p className="text-muted-foreground">
            Manage and resolve guest requests and issues
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Tickets update in real-time. You'll see changes as guests submit new requests or as your team updates them.
        </AlertDescription>
      </Alert>

      <TicketStats tickets={tickets} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketFilters filters={filters} onFiltersChange={setFilters} />
        </CardContent>
      </Card>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="open">
            Open ({ticketsByStatus.open.length})
          </TabsTrigger>
          <TabsTrigger value="in_progress">
            In Progress ({ticketsByStatus.in_progress.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({ticketsByStatus.resolved.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed ({ticketsByStatus.closed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <TicketList tickets={ticketsByStatus.open} loading={loading} onUpdate={fetchTickets} />
        </TabsContent>

        <TabsContent value="in_progress">
          <TicketList tickets={ticketsByStatus.in_progress} loading={loading} onUpdate={fetchTickets} />
        </TabsContent>

        <TabsContent value="resolved">
          <TicketList tickets={ticketsByStatus.resolved} loading={loading} onUpdate={fetchTickets} />
        </TabsContent>

        <TabsContent value="closed">
          <TicketList tickets={ticketsByStatus.closed} loading={loading} onUpdate={fetchTickets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

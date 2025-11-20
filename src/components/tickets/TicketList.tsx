import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDetailDialog } from "./TicketDetailDialog";
import { formatDistanceToNow } from "date-fns";
import { Eye, AlertCircle } from "lucide-react";

interface TicketListProps {
  tickets: any[];
  loading: boolean;
  onUpdate: () => void;
}

export function TicketList({ tickets, loading, onUpdate }: TicketListProps) {
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500 text-white";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-white";
      case "low":
        return "bg-green-500 text-white";
      default:
        return "bg-muted";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500 text-white";
      case "in_progress":
        return "bg-purple-500 text-white";
      case "resolved":
        return "bg-green-500 text-white";
      case "closed":
        return "bg-gray-500 text-white";
      default:
        return "bg-muted";
    }
  };

  const formatTicketType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-foreground">No tickets found</p>
        <p className="text-sm text-muted-foreground">
          Tickets matching your filters will appear here
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <Card key={ticket.id} className="p-4 hover:bg-accent/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground text-lg">
                      {ticket.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ticket.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status)}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong>Type:</strong> {formatTicketType(ticket.ticket_type)}
                  </span>
                  <span>
                    <strong>Guest:</strong> {ticket.guest_accounts?.username}
                  </span>
                  {ticket.reservations?.units && (
                    <span>
                      <strong>Unit:</strong> {ticket.reservations.units.name}
                    </span>
                  )}
                  {ticket.assigned_to_profile && (
                    <span>
                      <strong>Assigned to:</strong> {ticket.assigned_to_profile.full_name}
                    </span>
                  )}
                  <span>
                    <strong>Created:</strong>{" "}
                    {formatDistanceToNow(new Date(ticket.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTicket(ticket)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {selectedTicket && (
        <TicketDetailDialog
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
          onUpdate={() => {
            onUpdate();
            setSelectedTicket(null);
          }}
        />
      )}
    </>
  );
}

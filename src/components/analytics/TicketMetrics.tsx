import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle, AlertCircle, Ticket } from "lucide-react";

interface TicketMetricsProps {
  tickets: Array<{
    status: string;
    created_at: string;
    resolved_at: string | null;
    priority: string;
  }>;
}

const TicketMetrics = ({ tickets }: TicketMetricsProps) => {
  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === "open").length;
  const resolvedTickets = tickets.filter(t => t.status === "resolved").length;
  const urgentTickets = tickets.filter(t => t.priority === "urgent" && t.status !== "resolved").length;

  const avgResolutionTime = tickets
    .filter(t => t.resolved_at)
    .reduce((acc, ticket) => {
      const created = new Date(ticket.created_at).getTime();
      const resolved = new Date(ticket.resolved_at!).getTime();
      return acc + (resolved - created);
    }, 0) / (resolvedTickets || 1);

  const avgHours = Math.round(avgResolutionTime / (1000 * 60 * 60));

  const metrics = [
    {
      title: "Total Tickets",
      value: totalTickets,
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Open Tickets",
      value: openTickets,
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Resolved",
      value: resolvedTickets,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Avg Resolution Time",
      value: `${avgHours}h`,
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${metric.bgColor}`}>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default TicketMetrics;

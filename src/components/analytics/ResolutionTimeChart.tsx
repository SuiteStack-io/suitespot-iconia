import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ResolutionTimeChartProps {
  tickets: Array<{
    created_at: string;
    resolved_at: string | null;
    ticket_type: string;
  }>;
}

const ResolutionTimeChart = ({ tickets }: ResolutionTimeChartProps) => {
  const resolvedTickets = tickets.filter(t => t.resolved_at);

  const chartData = resolvedTickets.reduce((acc, ticket) => {
    const created = new Date(ticket.created_at).getTime();
    const resolved = new Date(ticket.resolved_at!).getTime();
    const hours = Math.round((resolved - created) / (1000 * 60 * 60));
    
    const existing = acc.find(item => item.type === ticket.ticket_type);
    if (existing) {
      existing.hours = (existing.hours * existing.count + hours) / (existing.count + 1);
      existing.count += 1;
    } else {
      acc.push({ type: ticket.ticket_type, hours, count: 1 });
    }
    return acc;
  }, [] as Array<{ type: string; hours: number; count: number }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Resolution Time by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Bar dataKey="hours" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ResolutionTimeChart;

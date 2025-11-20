import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface TicketTypeChartProps {
  tickets: Array<{
    ticket_type: string;
    priority: string;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const TicketTypeChart = ({ tickets }: TicketTypeChartProps) => {
  const typeCounts = tickets.reduce((acc, ticket) => {
    acc[ticket.ticket_type] = (acc[ticket.ticket_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(typeCounts).map(([type, count]) => ({
    name: type.replace(/_/g, ' ').toUpperCase(),
    value: count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by Type</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TicketTypeChart;

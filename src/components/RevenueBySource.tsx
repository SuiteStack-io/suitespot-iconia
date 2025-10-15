import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SourceRevenue {
  source: string;
  count: number;
  grossRevenue: number;
  commissionRate: number;
  commission: number;
  netRevenue: number;
}

const COMMISSION_RATES: Record<string, number> = {
  'Booking.com': 17.4,
  'booking.com': 17.4,
  'default': 10.0
};

const getCommissionRate = (source: string): number => {
  return COMMISSION_RATES[source] || COMMISSION_RATES['default'];
};

export const RevenueBySource = () => {
  const [revenueBySource, setRevenueBySource] = useState<SourceRevenue[]>([]);
  const [filteredRevenue, setFilteredRevenue] = useState<SourceRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('all');

  useEffect(() => {
    fetchRevenueBySource();

    // Real-time updates
    const channel = supabase
      .channel('revenue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchRevenueBySource();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedSource === 'all') {
      setFilteredRevenue(revenueBySource);
    } else {
      setFilteredRevenue(revenueBySource.filter(r => r.source === selectedSource));
    }
  }, [selectedSource, revenueBySource]);

  const fetchRevenueBySource = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('source, total_price, commission_amount, net_revenue')
      .neq('status', 'Cancelled');

    if (error) {
      console.error('Error fetching revenue by source:', error);
      setLoading(false);
      return;
    }

    // Group by source
    const sourceMap: Record<string, SourceRevenue> = {};
    
    data?.forEach((reservation) => {
      const source = reservation.source || 'Unknown';
      
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          count: 0,
          grossRevenue: 0,
          commissionRate: getCommissionRate(source),
          commission: 0,
          netRevenue: 0,
        };
      }
      
      sourceMap[source].count += 1;
      sourceMap[source].grossRevenue += reservation.total_price || 0;
      sourceMap[source].commission += reservation.commission_amount || 0;
      sourceMap[source].netRevenue += reservation.net_revenue || 0;
    });

    // Convert to array and sort by gross revenue (descending)
    const revenueArray = Object.values(sourceMap).sort(
      (a, b) => b.grossRevenue - a.grossRevenue
    );

    setRevenueBySource(revenueArray);
    setFilteredRevenue(revenueArray);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (revenueBySource.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No revenue data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const totals = filteredRevenue.reduce(
    (acc, source) => ({
      count: acc.count + source.count,
      grossRevenue: acc.grossRevenue + source.grossRevenue,
      commission: acc.commission + source.commission,
      netRevenue: acc.netRevenue + source.netRevenue,
    }),
    { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 }
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Revenue by Source</CardTitle>
        <Select value={selectedSource} onValueChange={setSelectedSource}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {revenueBySource.map((source) => (
              <SelectItem key={source.source} value={source.source}>
                {source.source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Gross Revenue</TableHead>
                <TableHead className="text-right">Commission Rate</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right font-semibold">Net Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRevenue.map((source) => (
                <TableRow key={source.source}>
                  <TableCell className="font-medium">{source.source}</TableCell>
                  <TableCell className="text-right">{source.count}</TableCell>
                  <TableCell className="text-right">
                    ${source.grossRevenue.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">{source.commissionRate}%</TableCell>
                  <TableCell className="text-right text-amber-600">
                    ${source.commission.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">
                    ${source.netRevenue.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.count}</TableCell>
                <TableCell className="text-right">
                  ${totals.grossRevenue.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right text-amber-600">
                  ${totals.commission.toFixed(2)}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  ${totals.netRevenue.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>* Commission rates: Booking.com (17.4%), Others (10%)</p>
          <p>* Net Revenue = Gross Revenue - Commission</p>
        </div>
      </CardContent>
    </Card>
  );
};

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
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BookingDetail {
  guestName: string;
  totalPrice: number;
  netRevenue: number;
}

interface SourceRevenue {
  source: string;
  count: number;
  grossRevenue: number;
  commissionRate: number;
  commission: number;
  netRevenue: number;
  guestNames?: string[];
  bookingDetails?: BookingDetail[];
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
  const [isAdminExpanded, setIsAdminExpanded] = useState(false);
  const [isBookingComExpanded, setIsBookingComExpanded] = useState(false);

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
      .select('source, total_price, commission_amount, net_revenue, guest_names')
      .neq('status', 'Cancelled');

    if (error) {
      console.error('Error fetching revenue by source:', error);
      setLoading(false);
      return;
    }

    // Group by source with guest names and booking details for all sources
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
          guestNames: [],
          bookingDetails: [],
        };
      }
      
      sourceMap[source].count += 1;
      sourceMap[source].grossRevenue += reservation.total_price || 0;
      sourceMap[source].commission += reservation.commission_amount || 0;
      sourceMap[source].netRevenue += reservation.net_revenue || 0;
      
      // Store booking details for all sources (for expandable breakdowns)
      if (reservation.guest_names?.[0]) {
        sourceMap[source].bookingDetails?.push({
          guestName: reservation.guest_names[0],
          totalPrice: reservation.total_price || 0,
          netRevenue: reservation.net_revenue || 0,
        });
        sourceMap[source].guestNames?.push(reservation.guest_names[0]);
      }
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

  // Group sources into 4 categories: Booking.com, Direct Website, Admin, KSS
  const bookingComSources = filteredRevenue.filter(s => 
    s.source.toLowerCase().includes('booking.com')
  );
  
  const directWebsiteSources = filteredRevenue.filter(s => 
    s.source.toLowerCase().includes('direct website')
  );
  
  const adminSources = filteredRevenue.filter(s => 
    s.source.toLowerCase().includes('admin') || 
    s.source.toLowerCase().includes('nicol')
  );
  
  const kssSources = filteredRevenue.filter(s => 
    s.source.toLowerCase().includes('kss')
  );

  const bookingComTotal = bookingComSources.reduce(
    (acc, source) => ({
      count: acc.count + source.count,
      grossRevenue: acc.grossRevenue + source.grossRevenue,
      commission: acc.commission + source.commission,
      netRevenue: acc.netRevenue + source.netRevenue,
    }),
    { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 }
  );

  const directWebsiteTotal = directWebsiteSources.reduce(
    (acc, source) => ({
      count: acc.count + source.count,
      grossRevenue: acc.grossRevenue + source.grossRevenue,
      commission: acc.commission + source.commission,
      netRevenue: acc.netRevenue + source.netRevenue,
    }),
    { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 }
  );

  const adminTotal = adminSources.reduce(
    (acc, source) => ({
      count: acc.count + source.count,
      grossRevenue: acc.grossRevenue + source.grossRevenue,
      commission: acc.commission + source.commission,
      netRevenue: acc.netRevenue + source.netRevenue,
      guestNames: [...(acc.guestNames || []), ...(source.guestNames || [])],
      bookingDetails: [...(acc.bookingDetails || []), ...(source.bookingDetails || [])],
    }),
    { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0, guestNames: [] as string[], bookingDetails: [] as BookingDetail[] }
  );

  // Aggregate Booking.com details
  const bookingComDetails = bookingComSources.reduce(
    (acc, source) => [...acc, ...(source.bookingDetails || [])],
    [] as BookingDetail[]
  );

  const kssTotal = kssSources.reduce(
    (acc, source) => ({
      count: acc.count + source.count,
      grossRevenue: acc.grossRevenue + source.grossRevenue,
      commission: acc.commission + source.commission,
      netRevenue: acc.netRevenue + source.netRevenue,
    }),
    { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 }
  );

  const totals = {
    count: bookingComTotal.count + directWebsiteTotal.count + adminTotal.count + kssTotal.count,
    grossRevenue: bookingComTotal.grossRevenue + directWebsiteTotal.grossRevenue + adminTotal.grossRevenue + kssTotal.grossRevenue,
    commission: bookingComTotal.commission + directWebsiteTotal.commission + adminTotal.commission + kssTotal.commission,
    netRevenue: bookingComTotal.netRevenue + directWebsiteTotal.netRevenue + adminTotal.netRevenue + kssTotal.netRevenue,
  };

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
              {/* Booking.com (Collapsible) */}
              {bookingComSources.length > 0 && (
                <>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => setIsBookingComExpanded(!isBookingComExpanded)}
                      >
                        {isBookingComExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        Booking.com
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">{bookingComTotal.count}</TableCell>
                    <TableCell className="text-right">
                      ${bookingComTotal.grossRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">17.4%</TableCell>
                    <TableCell className="text-right text-amber-600">
                      ${bookingComTotal.commission.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      ${bookingComTotal.netRevenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  
                  {/* Individual Booking.com Reservations */}
                  {isBookingComExpanded && bookingComDetails.map((booking, index) => (
                    <TableRow key={`booking-com-${index}`} className="bg-muted/30">
                      <TableCell className="pl-10 font-normal text-muted-foreground">
                        {booking.guestName}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">1</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${booking.totalPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">17.4%</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${(booking.totalPrice * 0.174).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${booking.netRevenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* Direct Website */}
              {directWebsiteSources.length > 0 && (
                <TableRow className="hover:bg-muted/50">
                  <TableCell className="font-medium">Direct Website</TableCell>
                  <TableCell className="text-right">{directWebsiteTotal.count}</TableCell>
                  <TableCell className="text-right">
                    ${directWebsiteTotal.grossRevenue.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">10%</TableCell>
                  <TableCell className="text-right text-amber-600">
                    ${directWebsiteTotal.commission.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">
                    ${directWebsiteTotal.netRevenue.toFixed(2)}
                  </TableCell>
                </TableRow>
              )}

              {/* Admin (Collapsible) */}
              {adminSources.length > 0 && (
                <>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => setIsAdminExpanded(!isAdminExpanded)}
                      >
                        {isAdminExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        Admin
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">{adminTotal.count}</TableCell>
                    <TableCell className="text-right">
                      ${adminTotal.grossRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">10%</TableCell>
                    <TableCell className="text-right text-amber-600">
                      ${adminTotal.commission.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      ${adminTotal.netRevenue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  
                  {/* Individual Admin Bookings by Guest */}
                  {isAdminExpanded && adminTotal.bookingDetails.map((booking, index) => (
                    <TableRow key={`admin-${index}`} className="bg-muted/30">
                      <TableCell className="pl-10 font-normal text-muted-foreground">
                        {booking.guestName}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">1</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${booking.totalPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">10%</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${(booking.totalPrice * 0.10).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${booking.netRevenue.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* KSS */}
              {kssSources.length > 0 && (
                <TableRow className="hover:bg-muted/50">
                  <TableCell className="font-medium">KSS</TableCell>
                  <TableCell className="text-right">{kssTotal.count}</TableCell>
                  <TableCell className="text-right">
                    ${kssTotal.grossRevenue.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">10%</TableCell>
                  <TableCell className="text-right text-amber-600">
                    ${kssTotal.commission.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">
                    ${kssTotal.netRevenue.toFixed(2)}
                  </TableCell>
                </TableRow>
              )}

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

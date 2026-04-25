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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, Download, FileSpreadsheet, DollarSign, Users, Percent, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { applyRevenueDateFilter, prorateFactor, type RevenueRecognitionMethod } from '@/lib/revenueDateFilter';

interface RevenueBySourceProps {
  mainDateRange?: DateRange;
  method?: RevenueRecognitionMethod;
}

interface BookingDetail {
  guestName: string;
  totalPrice: number;
  netRevenue: number;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  commission?: number;
  paymentMethod?: string;
  currency?: string;
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

export const RevenueBySource = ({ mainDateRange, method = 'check_in' }: RevenueBySourceProps) => {
  const propertyId = usePropertyId();
  const [revenueBySource, setRevenueBySource] = useState<SourceRevenue[]>([]);
  const [filteredRevenue, setFilteredRevenue] = useState<SourceRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isDirectExpanded, setIsDirectExpanded] = useState(false);
  const [isBookingComExpanded, setIsBookingComExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSourceDetail, setSelectedSourceDetail] = useState<SourceRevenue | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);

  const handleBookingClick = (booking: BookingDetail) => {
    setSelectedBooking(booking);
    setBookingModalOpen(true);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime(), propertyId, method]);

  useEffect(() => {
    if (selectedSource === 'all') {
      setFilteredRevenue(revenueBySource);
    } else {
      setFilteredRevenue(revenueBySource.filter(r => r.source === selectedSource));
    }
  }, [selectedSource, revenueBySource]);

  const formatPaymentMethod = (method: string | null): string => {
    if (!method) return '-';
    return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getCurrencyLabel = (currency: string | null): string => {
    switch (currency) {
      case 'USD': return 'USD';
      case 'EGP': return 'EGP';
      case 'AED': return 'AED';
      case 'SAR': return 'SAR';
      default: return currency || '-';
    }
  };

  const fetchRevenueBySource = async () => {
    if (!mainDateRange?.from || !mainDateRange?.to) return;

    const startDate = format(mainDateRange.from, 'yyyy-MM-dd');
    const endDate = format(mainDateRange.to, 'yyyy-MM-dd');

    const { data, error } = await withPropertyFilter(
      applyRevenueDateFilter(
        supabase
          .from('reservations')
          .select('source, total_price, commission_amount, net_revenue, guest_names, check_in_date, check_out_date, nights, payment_method, currency')
          .neq('status', 'Cancelled')
          .is('cancelled_at', null),
        method, startDate, endDate,
      ),
      propertyId,
    );

    if (error) {
      console.error('Error fetching revenue by source:', error);
      setLoading(false);
      return;
    }

    // Group by source with guest names and booking details for all sources
    const sourceMap: Record<string, SourceRevenue> = {};
    
    data?.forEach((reservation: any) => {
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
      
      const f = method === 'prorata'
        ? prorateFactor(reservation.check_in_date, reservation.check_out_date, startDate, endDate)
        : 1;
      sourceMap[source].count += 1;
      sourceMap[source].grossRevenue += (reservation.total_price || 0) * f;
      sourceMap[source].commission += (reservation.commission_amount || 0) * f;
      const calculatedNetRevenue = ((reservation.total_price || 0) - (reservation.commission_amount || 0)) * f;
      sourceMap[source].netRevenue += calculatedNetRevenue;
      
      // Store booking details for all sources (for expandable breakdowns)
      if (reservation.guest_names?.[0]) {
        sourceMap[source].bookingDetails?.push({
          guestName: reservation.guest_names[0],
          totalPrice: (reservation.total_price || 0) * f,
          netRevenue: calculatedNetRevenue,
          checkInDate: reservation.check_in_date,
          checkOutDate: reservation.check_out_date,
          nights: reservation.nights || 0,
          commission: (reservation.commission_amount || 0) * f,
          paymentMethod: formatPaymentMethod(reservation.payment_method),
          currency: getCurrencyLabel(reservation.currency),
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

  const handleSourceClick = (source: SourceRevenue) => {
    setSelectedSourceDetail(source);
    setModalOpen(true);
  };

  const handleExportExcel = () => {
    // Prepare data for export
    const exportData: any[] = [];
    
    // Add Booking.com section
    if (bookingComSources.length > 0) {
      exportData.push({
        Source: 'Booking.com',
        Bookings: bookingComTotal.count,
        'Gross Revenue': `$${bookingComTotal.grossRevenue.toFixed(2)}`,
        'Commission Rate': '17.4%',
        Commission: `$${bookingComTotal.commission.toFixed(2)}`,
        'Net Revenue': `$${bookingComTotal.netRevenue.toFixed(2)}`,
      });
      
      // Add individual bookings
      bookingComDetails.forEach(booking => {
        exportData.push({
          Source: `  └ ${booking.guestName}`,
          Bookings: 1,
          'Gross Revenue': `$${booking.totalPrice.toFixed(2)}`,
          'Commission Rate': '17.4%',
          Commission: `$${(booking.totalPrice * 0.174).toFixed(2)}`,
          'Net Revenue': `$${booking.netRevenue.toFixed(2)}`,
        });
      });
    }
    
    // Add Direct section
    if (directSources.length > 0) {
      exportData.push({
        Source: 'Direct',
        Bookings: directTotal.count,
        'Gross Revenue': `$${directTotal.grossRevenue.toFixed(2)}`,
        'Commission Rate': '10%',
        Commission: `$${directTotal.commission.toFixed(2)}`,
        'Net Revenue': `$${directTotal.netRevenue.toFixed(2)}`,
      });
      
      // Add team member breakdown
      directSourceBreakdown.forEach(source => {
        exportData.push({
          Source: `  └ ${source.source}`,
          Bookings: source.count,
          'Gross Revenue': `$${source.grossRevenue.toFixed(2)}`,
          'Commission Rate': '10%',
          Commission: `$${source.commission.toFixed(2)}`,
          'Net Revenue': `$${source.netRevenue.toFixed(2)}`,
        });
      });
    }
    
    // Add totals row
    exportData.push({
      Source: 'TOTAL',
      Bookings: totals.count,
      'Gross Revenue': `$${totals.grossRevenue.toFixed(2)}`,
      'Commission Rate': '-',
      Commission: `$${totals.commission.toFixed(2)}`,
      'Net Revenue': `$${totals.netRevenue.toFixed(2)}`,
    });

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue by Source');

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Source
      { wch: 10 }, // Bookings
      { wch: 15 }, // Gross Revenue
      { wch: 15 }, // Commission Rate
      { wch: 15 }, // Commission
      { wch: 15 }, // Net Revenue
    ];

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `revenue-by-source-${date}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
    toast.success('Excel file downloaded successfully');
  };

  const handleExportCSV = () => {
    // Prepare CSV content
    let csvContent = 'Source,Bookings,Gross Revenue,Commission Rate,Commission,Net Revenue\n';
    
    // Add Booking.com section
    if (bookingComSources.length > 0) {
      csvContent += `Booking.com,${bookingComTotal.count},$${bookingComTotal.grossRevenue.toFixed(2)},17.4%,$${bookingComTotal.commission.toFixed(2)},$${bookingComTotal.netRevenue.toFixed(2)}\n`;
      
      // Add individual bookings
      bookingComDetails.forEach(booking => {
        csvContent += `"  └ ${booking.guestName}",1,$${booking.totalPrice.toFixed(2)},17.4%,$${(booking.totalPrice * 0.174).toFixed(2)},$${booking.netRevenue.toFixed(2)}\n`;
      });
    }
    
    // Add Direct section
    if (directSources.length > 0) {
      csvContent += `Direct,${directTotal.count},$${directTotal.grossRevenue.toFixed(2)},10%,$${directTotal.commission.toFixed(2)},$${directTotal.netRevenue.toFixed(2)}\n`;
      
      // Add team member breakdown
      directSourceBreakdown.forEach(source => {
        csvContent += `"  └ ${source.source}",${source.count},$${source.grossRevenue.toFixed(2)},10%,$${source.commission.toFixed(2)},$${source.netRevenue.toFixed(2)}\n`;
      });
    }
    
    // Add totals row
    csvContent += `TOTAL,${totals.count},$${totals.grossRevenue.toFixed(2)},-,$${totals.commission.toFixed(2)},$${totals.netRevenue.toFixed(2)}\n`;

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-by-source-${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV file downloaded successfully');
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

  // Group sources into 2 categories: Booking.com and Direct
  const bookingComSources = filteredRevenue.filter(s => 
    s.source.toLowerCase().includes('booking.com')
  );
  
  // All non-Booking.com sources are "Direct"
  const directSources = filteredRevenue.filter(s => 
    !s.source.toLowerCase().includes('booking.com')
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

  // Aggregate Booking.com details by guest
  const bookingComDetails = bookingComSources.reduce(
    (acc, source) => [...acc, ...(source.bookingDetails || [])],
    [] as BookingDetail[]
  );

  // Aggregate Direct total
  const directTotal = directSources.reduce(
    (acc, source) => ({
      count: acc.count + source.count,
      grossRevenue: acc.grossRevenue + source.grossRevenue,
      commission: acc.commission + source.commission,
      netRevenue: acc.netRevenue + source.netRevenue,
    }),
    { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 }
  );

  // Keep Direct sources separate for breakdown by team member
  const directSourceBreakdown = directSources.map(source => ({
    source: source.source,
    count: source.count,
    grossRevenue: source.grossRevenue,
    commission: source.commission,
    netRevenue: source.netRevenue,
  }));

  const totals = {
    count: bookingComTotal.count + directTotal.count,
    grossRevenue: bookingComTotal.grossRevenue + directTotal.grossRevenue,
    commission: bookingComTotal.commission + directTotal.commission,
    netRevenue: bookingComTotal.netRevenue + directTotal.netRevenue,
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle>Revenue by Source</CardTitle>
        <div className="flex items-center gap-2 w-full sm:w-auto">
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
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
                <TableHead className="text-right">Payment</TableHead>
                <TableHead className="text-right">Currency</TableHead>
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
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  
                  {/* Individual Booking.com Reservations by Guest */}
                  {isBookingComExpanded && bookingComDetails.map((booking, index) => (
                    <TableRow key={`booking-com-${index}`} className="bg-muted/30">
                      <TableCell className="pl-10 font-normal text-muted-foreground">
                        <button
                          onClick={() => handleBookingClick(booking)}
                          className="hover:underline hover:text-primary cursor-pointer text-left"
                        >
                          {booking.guestName}
                        </button>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">1</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${booking.totalPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">17.4%</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${(booking.commission || booking.totalPrice * 0.174).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${booking.netRevenue.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {booking.paymentMethod || '-'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {booking.currency || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              )}

              {/* Direct (Collapsible) */}
              {directSources.length > 0 && (
                <>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => setIsDirectExpanded(!isDirectExpanded)}
                      >
                        {isDirectExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2" />
                        )}
                        Direct
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">{directTotal.count}</TableCell>
                    <TableCell className="text-right">
                      ${directTotal.grossRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">10%</TableCell>
                    <TableCell className="text-right text-amber-600">
                      ${directTotal.commission.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-semibold">
                      ${directTotal.netRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  
                  {/* Direct Breakdown by Team Member */}
                  {isDirectExpanded && directSourceBreakdown.map((source, index) => {
                    const fullSourceData = directSources.find(s => s.source === source.source);
                    return (
                      <TableRow key={`direct-${index}`} className="bg-muted/30">
                        <TableCell className="pl-10 font-normal text-muted-foreground">
                          <button
                            onClick={() => fullSourceData && handleSourceClick(fullSourceData)}
                            className="hover:underline hover:text-primary cursor-pointer text-left"
                          >
                            {source.source}
                          </button>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{source.count}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${source.grossRevenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">10%</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${source.commission.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          ${source.netRevenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">-</TableCell>
                        <TableCell className="text-right text-muted-foreground">-</TableCell>
                      </TableRow>
                    );
                  })}
                </>
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
                <TableCell className="text-right">-</TableCell>
                <TableCell className="text-right">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>* Commission rates: Booking.com (17.4%), Others (10%)</p>
          <p>* Net Revenue = Gross Revenue - Commission</p>
        </div>
      </CardContent>

      {/* Source Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedSourceDetail?.source} - Booking Details</DialogTitle>
          </DialogHeader>
          
          {selectedSourceDetail && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">Bookings</span>
                  </div>
                  <p className="text-2xl font-bold">{selectedSourceDetail.count}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs">Revenue</span>
                  </div>
                  <p className="text-2xl font-bold">${selectedSourceDetail.grossRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-amber-600 mb-1">
                    <Percent className="h-4 w-4" />
                    <span className="text-xs">Commission</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-600">${selectedSourceDetail.commission.toFixed(2)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Net</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">${selectedSourceDetail.netRevenue.toFixed(2)}</p>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest Name</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead className="text-right">Nights</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Currency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSourceDetail.bookingDetails?.map((booking, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{booking.guestName}</TableCell>
                        <TableCell>
                          {booking.checkInDate ? format(new Date(booking.checkInDate), 'MMM d, yy') : '-'}
                        </TableCell>
                        <TableCell>
                          {booking.checkOutDate ? format(new Date(booking.checkOutDate), 'MMM d, yy') : '-'}
                        </TableCell>
                        <TableCell className="text-right">{booking.nights || '-'}</TableCell>
                        <TableCell className="text-right">${booking.totalPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-amber-600">${(booking.commission || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-green-600">${booking.netRevenue.toFixed(2)}</TableCell>
                        <TableCell>{booking.paymentMethod || '-'}</TableCell>
                        <TableCell>{booking.currency || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Individual Booking Detail Modal */}
      <Dialog open={bookingModalOpen} onOpenChange={setBookingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedBooking?.guestName}</DialogTitle>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Check-in</p>
                  <p className="font-semibold">
                    {selectedBooking.checkInDate ? format(new Date(selectedBooking.checkInDate), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Check-out</p>
                  <p className="font-semibold">
                    {selectedBooking.checkOutDate ? format(new Date(selectedBooking.checkOutDate), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
              </div>
              
              <div className="border rounded-lg divide-y">
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">Nights</span>
                  <span className="font-medium">{selectedBooking.nights || '-'}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">Gross Revenue</span>
                  <span className="font-medium">${selectedBooking.totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between p-3">
                  <span className="text-muted-foreground">Commission (17.4%)</span>
                  <span className="font-medium text-amber-600">
                    ${(selectedBooking.commission || selectedBooking.totalPrice * 0.174).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-muted/30">
                  <span className="font-semibold">Net Revenue</span>
                  <span className="font-semibold text-green-600">${selectedBooking.netRevenue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

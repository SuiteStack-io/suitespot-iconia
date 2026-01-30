import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface NationalityRevenue {
  nationality: string;
  totalNights: number;
  revenuePercentage: number;
  avgPricePerNight: number;
  totalRevenue: number;
  source: string;
  payment: string;
}

type SortField = 'nationality' | 'totalNights' | 'revenuePercentage' | 'avgPricePerNight' | 'totalRevenue' | 'source' | 'payment';
type SortOrder = 'asc' | 'desc';

interface RevenueByNationalityProps {
  mainDateRange?: DateRange;
}

export const RevenueByNationality = ({ mainDateRange }: RevenueByNationalityProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (mainDateRange?.from && mainDateRange?.to) {
      return mainDateRange;
    }
    return {
      from: new Date(2024, 10, 1), // Nov 1, 2024
      to: new Date(),
    };
  });

  const [nationalityRevenues, setNationalityRevenues] = useState<NationalityRevenue[]>([]);
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Sync with main date range when it changes
  useEffect(() => {
    if (mainDateRange?.from && mainDateRange?.to) {
      setDateRange(mainDateRange);
    }
  }, [mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime()]);

  useEffect(() => {
    fetchNationalityRevenues();
  }, [dateRange]);

  const formatSource = (source: string | null): string => {
    if (!source) return '-';
    const lowerSource = source.toLowerCase();
    if (lowerSource === 'booking.com') return 'Booking.com';
    if (lowerSource === 'emad rezk') return 'Direct - Emad Rezk';
    return `Direct - ${source}`;
  };

  const formatPaymentMethod = (method: string | null): string => {
    if (!method) return '-';
    return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const fetchNationalityRevenues = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    const { data, error } = await supabase
      .from('reservations')
      .select('guest_nationality, nights, price_per_night, total_price, vat_exempt, source, payment_method')
      .gte('check_in_date', format(dateRange.from, 'yyyy-MM-dd'))
      .lte('check_in_date', format(dateRange.to, 'yyyy-MM-dd'))
      .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed']);

    if (error) {
      console.error('Error fetching nationality revenues:', error);
      return;
    }

    // Aggregate by nationality
    const nationalityMap: Record<string, {
      totalNights: number;
      totalRevenue: number;
      totalPricePerNight: number;
      count: number;
      sources: Record<string, number>;
      payments: Record<string, number>;
    }> = {};

    data?.forEach((reservation) => {
      const nationality = reservation.guest_nationality || 'Unknown';
      const nights = reservation.nights || 0;
      const pricePerNight = Number(reservation.price_per_night) || 0;
      const totalPrice = Number(reservation.total_price) || 0;
      const vatExempt = reservation.vat_exempt || false;
      const source = reservation.source || 'Unknown';
      const payment = reservation.payment_method || 'Unknown';

      // Calculate revenue excluding VAT (14% VAT rate)
      const revenueExVat = vatExempt ? totalPrice : totalPrice / 1.14;

      if (!nationalityMap[nationality]) {
        nationalityMap[nationality] = {
          totalNights: 0,
          totalRevenue: 0,
          totalPricePerNight: 0,
          count: 0,
          sources: {},
          payments: {},
        };
      }

      nationalityMap[nationality].totalNights += nights;
      nationalityMap[nationality].totalRevenue += revenueExVat;
      nationalityMap[nationality].totalPricePerNight += pricePerNight * nights;
      nationalityMap[nationality].count += 1;
      nationalityMap[nationality].sources[source] = (nationalityMap[nationality].sources[source] || 0) + 1;
      nationalityMap[nationality].payments[payment] = (nationalityMap[nationality].payments[payment] || 0) + 1;
    });

    // Calculate grand total revenue first
    const grandTotalRevenue = Object.values(nationalityMap).reduce(
      (sum, data) => sum + data.totalRevenue, 0
    );

    // Convert to array and calculate averages
    const revenues: NationalityRevenue[] = Object.entries(nationalityMap).map(([nationality, data]) => {
      // Get most common source and payment
      const mostCommonSource = Object.entries(data.sources).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      const mostCommonPayment = Object.entries(data.payments).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

      return {
        nationality,
        totalNights: data.totalNights,
        revenuePercentage: grandTotalRevenue > 0 ? (data.totalRevenue / grandTotalRevenue) * 100 : 0,
        avgPricePerNight: data.totalNights > 0 ? data.totalPricePerNight / data.totalNights : 0,
        totalRevenue: data.totalRevenue,
        source: formatSource(mostCommonSource),
        payment: formatPaymentMethod(mostCommonPayment),
      };
    });

    // Sort by default
    const sorted = sortData(revenues, sortField, sortOrder);
    setNationalityRevenues(sorted);
  };

  const sortData = (data: NationalityRevenue[], field: SortField, order: SortOrder): NationalityRevenue[] => {
    return [...data].sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'nationality':
        case 'source':
        case 'payment':
          comparison = a[field].localeCompare(b[field]);
          break;
        case 'totalNights':
        case 'revenuePercentage':
        case 'avgPricePerNight':
        case 'totalRevenue':
          comparison = a[field] - b[field];
          break;
      }
      return order === 'asc' ? comparison : -comparison;
    });
  };

  const handleSort = (field: SortField) => {
    const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortField(field);
    setSortOrder(newOrder);
    setNationalityRevenues(sortData(nationalityRevenues, field, newOrder));
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Nationality</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('nationality')}
                >
                  <div className="flex items-center">
                    Nationality
                    {getSortIcon('nationality')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('totalNights')}
                >
                  <div className="flex items-center justify-end">
                    Total Nights
                    {getSortIcon('totalNights')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('revenuePercentage')}
                >
                  <div className="flex items-center justify-end">
                    % Revenue
                    {getSortIcon('revenuePercentage')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('avgPricePerNight')}
                >
                  <div className="flex items-center justify-end">
                    Avg Price/Night
                    {getSortIcon('avgPricePerNight')}
                  </div>
                </TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('totalRevenue')}
                >
                  <div className="flex items-center justify-end">
                    Total Revenue (ex. VAT)
                    {getSortIcon('totalRevenue')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('source')}
                >
                  <div className="flex items-center">
                    Source
                    {getSortIcon('source')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('payment')}
                >
                  <div className="flex items-center">
                    Payment
                    {getSortIcon('payment')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nationalityRevenues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No data available for selected period
                  </TableCell>
                </TableRow>
              ) : (
                nationalityRevenues.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.nationality}</TableCell>
                    <TableCell className="text-right">{item.totalNights}</TableCell>
                    <TableCell className="text-right">{(item.revenuePercentage ?? 0).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">${(item.avgPricePerNight ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">${(item.totalRevenue ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{item.source}</TableCell>
                    <TableCell>{item.payment}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

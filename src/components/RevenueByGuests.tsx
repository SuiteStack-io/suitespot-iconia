import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface GuestRevenue {
  id: string;
  guestName: string;
  roomId: string;
  pricePerNight: number;
  total: number;
  nationality: string;
  nights: number;
}

type SortField = 'guestName' | 'roomId' | 'pricePerNight' | 'total' | 'nationality' | 'nights';
type SortOrder = 'asc' | 'desc';

interface RevenueByGuestsProps {
  mainDateRange?: DateRange;
}

export const RevenueByGuests = ({ mainDateRange }: RevenueByGuestsProps) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (mainDateRange?.from && mainDateRange?.to) {
      return mainDateRange;
    }
    return {
      from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      to: new Date(),
    };
  });

  // Sync with main date range when it changes
  useEffect(() => {
    if (mainDateRange?.from && mainDateRange?.to) {
      setDateRange(mainDateRange);
    }
  }, [mainDateRange?.from?.getTime(), mainDateRange?.to?.getTime()]);
  const [guestRevenues, setGuestRevenues] = useState<GuestRevenue[]>([]);
  const [filteredRevenues, setFilteredRevenues] = useState<GuestRevenue[]>([]);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [selectedNationality, setSelectedNationality] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    fetchGuestRevenues();
  }, [dateRange]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [guestRevenues, selectedNationality, sortField, sortOrder]);

  const fetchGuestRevenues = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to, 'yyyy-MM-dd');

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, guest_names, unit_id, price_per_night, total_price, guest_nationality, nights, units(unit_number)')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_out_date', endDate);

    if (reservations) {
      const revenues: GuestRevenue[] = reservations.flatMap((r) => 
        r.guest_names.map((name: string) => ({
          id: `${r.id}-${name}`,
          guestName: name,
          roomId: (r.units as any)?.unit_number || 'N/A',
          pricePerNight: r.price_per_night || 0,
          total: r.total_price || 0,
          nationality: r.guest_nationality || 'Unknown',
          nights: r.nights || 0,
        }))
      );

      setGuestRevenues(revenues);

      const uniqueNationalities = Array.from(
        new Set(revenues.map((r) => r.nationality).filter(Boolean))
      ).sort();
      setNationalities(uniqueNationalities);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...guestRevenues];

    if (selectedNationality !== 'all') {
      filtered = filtered.filter((r) => r.nationality === selectedNationality);
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredRevenues(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Revenue by Guests</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM dd, yyyy')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Select value={selectedNationality} onValueChange={setSelectedNationality}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by nationality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Nationalities</SelectItem>
                {nationalities.map((nat) => (
                  <SelectItem key={nat} value={nat}>
                    {nat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('guestName')}
                >
                  Guest Name {getSortIcon('guestName')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('roomId')}
                >
                  Suite Name {getSortIcon('roomId')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('nationality')}
                >
                  Nationality {getSortIcon('nationality')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('nights')}
                >
                  Total Nights {getSortIcon('nights')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('pricePerNight')}
                >
                  Price per Night {getSortIcon('pricePerNight')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('total')}
                >
                  Total {getSortIcon('total')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRevenues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No guest data for this period
                  </TableCell>
                </TableRow>
              ) : (
                filteredRevenues.map((revenue) => (
                  <TableRow key={revenue.id}>
                    <TableCell className="font-medium">{revenue.guestName}</TableCell>
                    <TableCell>{revenue.roomId}</TableCell>
                    <TableCell>{revenue.nationality}</TableCell>
                    <TableCell>{revenue.nights}</TableCell>
                    <TableCell>${revenue.pricePerNight.toFixed(2)}</TableCell>
                    <TableCell className="font-semibold">${revenue.total.toFixed(2)}</TableCell>
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

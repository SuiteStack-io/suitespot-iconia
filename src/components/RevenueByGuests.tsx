import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

interface GuestRevenue {
  id: string;
  guestName: string;
  roomId: string;
  pricePerNight: number;
  total: number;
  nationality: string;
}

type SortField = 'guestName' | 'roomId' | 'pricePerNight' | 'total';
type SortOrder = 'asc' | 'desc';

export const RevenueByGuests = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [guestRevenues, setGuestRevenues] = useState<GuestRevenue[]>([]);
  const [filteredRevenues, setFilteredRevenues] = useState<GuestRevenue[]>([]);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [selectedNationality, setSelectedNationality] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    fetchGuestRevenues();
  }, [currentMonth]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [guestRevenues, selectedNationality, sortField, sortOrder]);

  const fetchGuestRevenues = async () => {
    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, guest_names, unit_id, price_per_night, total_price, guest_nationality, units(unit_number)')
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

  const navigatePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const navigateNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Guests</CardTitle>
        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigatePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
              <Calendar className="h-4 w-4 mr-2" />
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={navigateNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium ml-2">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
          </div>

          <Select value={selectedNationality} onValueChange={setSelectedNationality}>
            <SelectTrigger className="w-[200px]">
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
                  Room ID {getSortIcon('roomId')}
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No guest data for this period
                  </TableCell>
                </TableRow>
              ) : (
                filteredRevenues.map((revenue) => (
                  <TableRow key={revenue.id}>
                    <TableCell className="font-medium">{revenue.guestName}</TableCell>
                    <TableCell>{revenue.roomId}</TableCell>
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

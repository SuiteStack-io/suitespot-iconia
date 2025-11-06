import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface RoomRevenue {
  roomId: string;
  roomName: string;
  roomType: string;
  area: string;
  terrace: string;
  bookings: number;
  revenue: number;
  occupancy: number;
}

export const RevenueByRoom = () => {
  const [revenueByRoom, setRevenueByRoom] = useState<RoomRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });

  useEffect(() => {
    fetchRevenueByRoom();

    const channel = supabase
      .channel('room-revenue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchRevenueByRoom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchRevenueByRoom = async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    const startDate = format(dateRange.from, 'yyyy-MM-dd');
    const endDate = format(dateRange.to, 'yyyy-MM-dd');
    
    // Calculate total days in the date range
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Fetch all units
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, name, unit_number, unit_size, unit_type')
      .order('unit_number', { ascending: true });

    if (unitsError) {
      console.error('Error fetching units:', unitsError);
      setLoading(false);
      return;
    }

    // Fetch reservations for the date range
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('unit_id, total_price, net_revenue, check_in_date, check_out_date, nights')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_out_date', endDate);

    if (reservationsError) {
      console.error('Error fetching reservations:', reservationsError);
      setLoading(false);
      return;
    }

    // Group reservations by unit
    const roomRevenueMap: Record<string, RoomRevenue> = {};

    units?.forEach((unit) => {
      const unitReservations = reservations?.filter(
        (r) => r.unit_id === unit.id
      ) || [];

      const totalRevenue = unitReservations.reduce(
        (sum, r) => sum + (r.net_revenue || r.total_price || 0),
        0
      );
      
      // Calculate total nights booked for this room
      const totalNightsBooked = unitReservations.reduce(
        (sum, r) => sum + (r.nights || 0),
        0
      );
      
      // Calculate occupancy percentage
      const occupancy = daysDiff > 0 ? (totalNightsBooked / daysDiff) * 100 : 0;

      // Use the full unit_type as room type
      const roomType = unit.unit_type || 'N/A';

      // Parse area and terrace from unit_size (e.g., "52m2+25m2" -> area: "52m2", terrace: "25m2")
      let area = 'N/A';
      let terrace = 'N/A';
      
      if (unit.unit_size) {
        const sizeMatch = unit.unit_size.match(/(\d+)\s*m2?\s*\+?\s*(\d+)?\s*m2?/);
        if (sizeMatch) {
          area = `${sizeMatch[1]}m²`;
          if (sizeMatch[2]) {
            terrace = `${sizeMatch[2]}m²`;
          }
        } else {
          // Handle formats like "75 m2" without terrace
          const simpleMatch = unit.unit_size.match(/(\d+)\s*m2?/);
          if (simpleMatch) {
            area = `${simpleMatch[1]}m²`;
          }
        }
      }

      roomRevenueMap[unit.id] = {
        roomId: unit.id,
        roomName: unit.name,
        roomType: unit.unit_number ? `${unit.unit_number}` : roomType,
        area,
        terrace,
        bookings: unitReservations.length,
        revenue: totalRevenue,
        occupancy,
      };
    });

    const revenueArray = Object.values(roomRevenueMap).sort(
      (a, b) => b.revenue - a.revenue
    );

    setRevenueByRoom(revenueArray);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Room</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const totals = revenueByRoom.reduce(
    (acc, room) => ({
      bookings: acc.bookings + room.bookings,
      revenue: acc.revenue + room.revenue,
    }),
    { bookings: 0, revenue: 0 }
  );

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Revenue by Room</CardTitle>
          <div className="flex gap-2">
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Suite Name</TableHead>
                <TableHead className="text-center">Room #</TableHead>
                <TableHead className="text-center">Area</TableHead>
                <TableHead className="text-center">Terrace</TableHead>
                <TableHead className="text-right">Occupancy</TableHead>
                <TableHead className="text-right">Number of Bookings</TableHead>
                <TableHead className="text-right font-semibold">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueByRoom.map((room) => (
                <TableRow key={room.roomId}>
                  <TableCell className="font-medium">{room.roomName}</TableCell>
                  <TableCell className="text-center">{room.roomType}</TableCell>
                  <TableCell className="text-center">{room.area}</TableCell>
                  <TableCell className="text-center">{room.terrace}</TableCell>
                  <TableCell className="text-right">
                    <span className={room.occupancy >= 70 ? 'text-green-600 font-semibold' : room.occupancy >= 40 ? 'text-amber-600' : 'text-red-600'}>
                      {room.occupancy.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{room.bookings}</TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">
                    ${room.revenue.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={6}>Total</TableCell>
                <TableCell className="text-right">{totals.bookings}</TableCell>
                <TableCell className="text-right text-green-600">
                  ${totals.revenue.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          <p>* Revenue shown is net revenue after commission</p>
        </div>
      </CardContent>
    </Card>
  );
};

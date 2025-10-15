import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Reservation {
  id: string;
  booking_reference: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  guest_names: string[];
  guest_nationality: string | null;
  status: string;
  units: { name: string } | null;
  source: string;
  price_per_night: number | null;
  total_price: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  net_revenue: number | null;
  currency: string | null;
}

const statusColors = {
  Upcoming: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'In-House': 'bg-green-100 text-green-800 hover:bg-green-100',
  'Checked-Out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  Cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export const ReservationsList = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchReservations();

    // Real-time updates
    const channel = supabase
      .channel('reservations-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterReservations();
  }, [reservations, searchQuery, statusFilter, unitFilter]);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, units(name)')
      .order('check_in_date', { ascending: false });

    if (!error && data) {
      setReservations(data as Reservation[]);
    }
  };

  const filterReservations = () => {
    let filtered = [...reservations];

    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.booking_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.guest_names.some((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (unitFilter !== 'all') {
      filtered = filtered.filter((r) => r.units?.name === unitFilter);
    }

    setFilteredReservations(filtered);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or booking reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Upcoming">Upcoming</SelectItem>
            <SelectItem value="In-House">In-House</SelectItem>
            <SelectItem value="Checked-Out">Checked-Out</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Units" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            <SelectItem value="101">Unit 101</SelectItem>
            <SelectItem value="102">Unit 102</SelectItem>
            <SelectItem value="103">Unit 103</SelectItem>
            <SelectItem value="104">Unit 104</SelectItem>
            <SelectItem value="105">Unit 105</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Guest Name(s)</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Nights</TableHead>
              <TableHead>Guests</TableHead>
              <TableHead>Nationality</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Price/Night</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground">
                  No reservations found
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((reservation) => (
                <TableRow
                  key={reservation.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/reservation/${reservation.id}`)}
                >
                  <TableCell className="font-medium">{reservation.units?.name || 'N/A'}</TableCell>
                  <TableCell>{reservation.guest_names.join(', ')}</TableCell>
                  <TableCell>{format(new Date(reservation.check_in_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{format(new Date(reservation.check_out_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell>{reservation.nights}</TableCell>
                  <TableCell>{reservation.number_of_guests}</TableCell>
                  <TableCell>{reservation.guest_nationality || 'N/A'}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[reservation.status as keyof typeof statusColors]}>
                      {reservation.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{reservation.source}</TableCell>
                  <TableCell className="text-right">
                    {reservation.price_per_night ? `$${reservation.price_per_night}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {reservation.total_price ? `$${reservation.total_price}` : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{reservation.booking_reference}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
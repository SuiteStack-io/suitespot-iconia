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
  units: { name: string; unit_number: string | null } | null;
  source: string;
  price_per_night: number | null;
  total_price: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  net_revenue: number | null;
  currency: string | null;
  created_at: string;
}

type SortField = 'units' | 'guest_names' | 'check_in_date' | 'check_out_date' | 'nights' | 'number_of_guests' | 'guest_nationality' | 'status' | 'source' | 'price_per_night' | 'total_price' | 'booking_reference' | 'created_at';
type SortOrder = 'asc' | 'desc';

const statusColors = {
  confirmed: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
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
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    fetchReservations();
    fetchUnits();

    // Real-time updates for reservations
    const reservationsChannel = supabase
      .channel('reservations-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('ReservationsList real-time update:', payload);
          fetchReservations();
        }
      )
      .subscribe((status) => {
        console.log('ReservationsList subscription status:', status);
      });

    // Real-time updates for units
    const unitsChannel = supabase
      .channel('units-changes-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
        },
        () => {
          fetchUnits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(unitsChannel);
    };
  }, []);

  useEffect(() => {
    filterReservations();
  }, [reservations, searchQuery, statusFilter, unitFilter, sortField, sortOrder]);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, units(name, unit_number)')
      .order('check_in_date', { ascending: false });

    if (!error && data) {
      setReservations(data as Reservation[]);
    }
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setUnits(data);
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

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === 'units') {
        aVal = a.units?.name || '';
        bVal = b.units?.name || '';
      } else if (sortField === 'guest_names') {
        aVal = a.guest_names.join(', ');
        bVal = b.guest_names.join(', ');
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredReservations(filtered);
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
            <SelectItem value="confirmed">Confirmed</SelectItem>
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
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.name}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('units')}
              >
                Suite Name {getSortIcon('units')}
              </TableHead>
              <TableHead>
                Room #
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('guest_names')}
              >
                Guest Name(s) {getSortIcon('guest_names')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('check_in_date')}
              >
                Check-in {getSortIcon('check_in_date')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('check_out_date')}
              >
                Check-out {getSortIcon('check_out_date')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('nights')}
              >
                Nights {getSortIcon('nights')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('number_of_guests')}
              >
                Guests {getSortIcon('number_of_guests')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('guest_nationality')}
              >
                Nationality {getSortIcon('guest_nationality')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                Status {getSortIcon('status')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('source')}
              >
                Source {getSortIcon('source')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('price_per_night')}
              >
                Price/Night {getSortIcon('price_per_night')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('total_price')}
              >
                Total {getSortIcon('total_price')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('booking_reference')}
              >
                Reference {getSortIcon('booking_reference')}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('created_at')}
              >
                Date Created {getSortIcon('created_at')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center text-muted-foreground">
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
                  <TableCell>{reservation.units?.unit_number || '-'}</TableCell>
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
                  <TableCell>{format(new Date(reservation.created_at), 'dd MMM yyyy')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
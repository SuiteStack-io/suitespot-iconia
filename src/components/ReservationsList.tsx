import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Search, Users, Check, CalendarIcon, Download, FileSpreadsheet, X, Mail, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

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
  group_id: string | null;
  unit_id: string;
  contact_email: string | null;
  confirmation_email_status: string | null;
  confirmation_email_sent_at: string | null;
  payment_method: string | null;
}

interface GroupedReservation extends Reservation {
  isGrouped: boolean;
  groupCount?: number;
  groupRooms?: Reservation[];
}

type SortField = 'units' | 'guest_names' | 'check_in_date' | 'check_out_date' | 'nights' | 'number_of_guests' | 'guest_nationality' | 'status' | 'source' | 'price_per_night' | 'total_price' | 'booking_reference' | 'created_at';
type SortOrder = 'asc' | 'desc';

const statusColors = {
  confirmed: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'checked-in': 'bg-green-100 text-green-800 hover:bg-green-100',
  'checked-out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  completed: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
  // Legacy status values for backwards compatibility
  Upcoming: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'In-House': 'bg-green-100 text-green-800 hover:bg-green-100',
  'Checked-Out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  Cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const statusLabels = {
  confirmed: 'Confirmed',
  'checked-in': 'Checked-In',
  'checked-out': 'Checked-Out',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ReservationsList = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<GroupedReservation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedGroup, setSelectedGroup] = useState<Reservation[] | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
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
  }, [reservations, searchQuery, statusFilter, unitFilter, sortField, sortOrder, dateRange]);

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, booking_reference, check_in_date, check_out_date, nights, number_of_guests, guest_names, guest_nationality, status, source, price_per_night, total_price, commission_rate, commission_amount, net_revenue, currency, created_at, group_id, unit_id, contact_email, confirmation_email_status, confirmation_email_sent_at, payment_method, units(name, unit_number)')
      .order('check_in_date', { ascending: false });

    if (!error && data) {
      setReservations(data as Reservation[]);
    }
  };

  const processGroupedReservations = (reservationsList: Reservation[]): GroupedReservation[] => {
    const groupMap = new Map<string, Reservation[]>();
    const processedReservations: GroupedReservation[] = [];
    const processedGroupIds = new Set<string>();

    // Group reservations by group_id
    reservationsList.forEach(res => {
      if (res.group_id) {
        if (!groupMap.has(res.group_id)) {
          groupMap.set(res.group_id, []);
        }
        groupMap.get(res.group_id)!.push(res);
      }
    });

    // Process reservations
    reservationsList.forEach(res => {
      if (res.group_id && groupMap.has(res.group_id)) {
        const groupRooms = groupMap.get(res.group_id)!;
        
        // Only add the first reservation from each group
        if (!processedGroupIds.has(res.group_id)) {
          processedGroupIds.add(res.group_id);
          processedReservations.push({
            ...res,
            isGrouped: true,
            groupCount: groupRooms.length,
            groupRooms: groupRooms,
          });
        }
      } else {
        // Single reservation (no group)
        processedReservations.push({
          ...res,
          isGrouped: false,
        });
      }
    });

    return processedReservations;
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

    // Date range filtering
    if (dateRange.from) {
      filtered = filtered.filter(r => new Date(r.check_in_date) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(r => new Date(r.check_in_date) <= dateRange.to!);
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

    const groupedFiltered = processGroupedReservations(filtered);
    setFilteredReservations(groupedFiltered);
  };

  const handleViewGroup = (groupRooms: Reservation[], e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroup(groupRooms);
    setShowGroupDialog(true);
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredReservations.map(r => r.id));
      setSelectedReservations(allIds);
    } else {
      setSelectedReservations(new Set());
    }
  };

  const handleSelectReservation = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedReservations);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedReservations(newSelected);
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedReservations.size === 0) {
      toast.error('Please select at least one reservation');
      return;
    }
    
    if (!bulkStatus) {
      toast.error('Please select a status');
      return;
    }

    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: bulkStatus })
        .in('id', Array.from(selectedReservations));

      if (error) {
        toast.error('Failed to update reservations');
        console.error('Bulk update error:', error);
      } else {
        toast.success(`Successfully updated ${selectedReservations.size} reservation(s)`);
        setSelectedReservations(new Set());
        setBulkStatus('');
        fetchReservations();
      }
    } catch (error) {
      toast.error('An error occurred while updating reservations');
      console.error('Bulk update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getExportData = () => {
    const dataToExport = selectedReservations.size > 0
      ? filteredReservations.filter(r => selectedReservations.has(r.id))
      : filteredReservations;

    return dataToExport.map(r => ({
      'Suite Name': r.units?.name || 'N/A',
      'Room #': r.units?.unit_number || '-',
      'Guest Name(s)': r.guest_names.join(', '),
      'Check-in': format(new Date(r.check_in_date), 'dd MMM yyyy'),
      'Check-out': format(new Date(r.check_out_date), 'dd MMM yyyy'),
      'Nights': r.nights,
      'Guests': r.number_of_guests,
      'Nationality': r.guest_nationality || 'N/A',
      'Status': statusLabels[r.status as keyof typeof statusLabels] || r.status,
      'Source': r.source,
      'Price/Night': r.price_per_night ? `$${Number(r.price_per_night).toFixed(2)}` : '-',
      'Total': r.total_price ? `$${Number(r.total_price).toFixed(2)}` : '-',
      'Reference': r.booking_reference,
      'Created': format(new Date(r.created_at), 'dd MMM yyyy'),
    }));
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('No reservations to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reservations');
    
    const filename = `reservations_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${data.length} reservation(s) to Excel`);
  };

  const handleExportCSV = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('No reservations to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservations_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    toast.success(`Exported ${data.length} reservation(s) to CSV`);
  };

  const handlePaymentMethodChange = async (reservationId: string, paymentMethod: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ payment_method: paymentMethod })
      .eq('id', reservationId);

    if (error) {
      toast.error('Failed to update payment method');
      console.error('Payment method update error:', error);
    } else {
      toast.success('Payment method updated');
      fetchReservations();
    }
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
            <SelectItem value="checked-in">Checked-In</SelectItem>
            <SelectItem value="checked-out">Checked-Out</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
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

      {/* Date Range and Export Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Date Range</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM dd, yyyy")
                  )
                ) : (
                  <span>Select date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                numberOfMonths={2}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {(dateRange.from || dateRange.to) && (
          <Button
            variant="outline"
            onClick={() => setDateRange({ from: undefined, to: undefined })}
            className="sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Dates
          </Button>
        )}

        {/* Export buttons - hidden on mobile */}
        <Button
          variant="default"
          onClick={handleExportExcel}
          className="hidden md:flex sm:w-auto"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
          {(selectedReservations.size > 0 || filteredReservations.length > 0) && (
            <Badge variant="secondary" className="ml-2">
              {selectedReservations.size > 0 ? selectedReservations.size : filteredReservations.length}
            </Badge>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleExportCSV}
          className="hidden md:flex sm:w-auto"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
          {(selectedReservations.size > 0 || filteredReservations.length > 0) && (
            <Badge variant="secondary" className="ml-2">
              {selectedReservations.size > 0 ? selectedReservations.size : filteredReservations.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedReservations.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {selectedReservations.size} reservation(s) selected
              </span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked-in">Checked-In</SelectItem>
                  <SelectItem value="checked-out">Checked-Out</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBulkStatusUpdate} 
                disabled={isUpdating || !bulkStatus}
                size="sm"
              >
                {isUpdating ? 'Updating...' : 'Update Status'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSelectedReservations(new Set())}
                size="sm"
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] min-w-[50px] max-w-[50px] sticky left-0 z-20 bg-background">
                <Checkbox
                  checked={selectedReservations.size === filteredReservations.length && filteredReservations.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead 
                className="w-[180px] min-w-[180px] max-w-[180px] cursor-pointer hover:bg-muted/50 sticky left-[50px] z-20 bg-background"
                onClick={() => handleSort('units')}
              >
                Suite Name {getSortIcon('units')}
              </TableHead>
              <TableHead className="w-[80px] min-w-[80px] max-w-[80px] sticky left-[230px] z-20 bg-background border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
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
              <TableHead>Email</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center text-muted-foreground">
                  No reservations found
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((reservation) => (
                <TableRow
                  key={reservation.id}
                  className="hover:bg-muted/50"
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="w-[50px] min-w-[50px] max-w-[50px] sticky left-0 z-10 bg-background">
                    <Checkbox
                      checked={selectedReservations.has(reservation.id)}
                      onCheckedChange={(checked) => handleSelectReservation(reservation.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell 
                    className="w-[180px] min-w-[180px] max-w-[180px] font-medium cursor-pointer sticky left-[50px] z-10 bg-background"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      {reservation.units?.name || 'N/A'}
                      {reservation.isGrouped && reservation.groupCount && (
                        <Badge 
                          variant="outline" 
                          className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                          onClick={(e) => handleViewGroup(reservation.groupRooms!, e)}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {reservation.groupCount} rooms
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell 
                    className="w-[80px] min-w-[80px] max-w-[80px] cursor-pointer sticky left-[230px] z-10 bg-background border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.isGrouped && reservation.groupCount ? (
                      <span className="text-muted-foreground text-xs">Multiple</span>
                    ) : (
                      reservation.units?.unit_number || '-'
                    )}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.guest_names?.length > 0 ? reservation.guest_names.join(', ') : 'N/A'}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {format(new Date(reservation.check_in_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {format(new Date(reservation.check_out_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.nights}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.number_of_guests}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.guest_nationality || 'N/A'}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    <Badge className={statusColors[reservation.status as keyof typeof statusColors]}>
                      {statusLabels[reservation.status as keyof typeof statusLabels] || reservation.status}
                    </Badge>
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.source}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.isGrouped && reservation.groupCount ? (
                      <span className="text-muted-foreground text-xs">Various</span>
                    ) : (
                      reservation.price_per_night ? `$${Number(reservation.price_per_night).toFixed(2)}` : '-'
                    )}
                  </TableCell>
                  <TableCell 
                    className="text-right font-medium cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.isGrouped && reservation.groupRooms ? (
                      <div>
                        ${reservation.groupRooms.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0).toFixed(2)}
                        <div className="text-xs text-muted-foreground">Combined</div>
                      </div>
                    ) : (
                      reservation.total_price ? `$${Number(reservation.total_price).toFixed(2)}` : '-'
                    )}
                  </TableCell>
                  <TableCell 
                    className="font-mono text-sm cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.booking_reference}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {format(new Date(reservation.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {!reservation.contact_email ? (
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        No email
                      </span>
                    ) : reservation.confirmation_email_status === 'sent' ? (
                      <span className="text-green-600 flex items-center gap-1" title={`Sent ${reservation.confirmation_email_sent_at ? format(new Date(reservation.confirmation_email_sent_at), 'dd MMM HH:mm') : ''}`}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">Sent</span>
                      </span>
                    ) : reservation.confirmation_email_status === 'failed' ? (
                      <span className="text-destructive flex items-center gap-1" title="Email failed to send">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">Failed</span>
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1" title="Email not yet sent">
                        <Mail className="h-3 w-3" />
                        <span className="text-xs">Pending</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={reservation.payment_method || ''}
                      onValueChange={(value) => handlePaymentMethodChange(reservation.id, value)}
                    >
                      <SelectTrigger className="w-[110px] h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="booking_com">Booking.com</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Group Details Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Multi-Room Booking Details</DialogTitle>
            <DialogDescription>
              This booking includes {selectedGroup?.length} rooms
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="space-y-4">
              {/* Group Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Guest Name</p>
                  <p className="font-semibold">{selectedGroup[0].guest_names.join(', ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Rooms</p>
                  <p className="font-semibold">{selectedGroup.length}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Check-in</p>
                  <p className="font-semibold">{format(new Date(selectedGroup[0].check_in_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Check-out</p>
                  <p className="font-semibold">{format(new Date(selectedGroup[0].check_out_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Combined Total</p>
                  <p className="font-semibold text-lg">
                    ${selectedGroup.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedGroup[0].status as keyof typeof statusColors]}>
                    {selectedGroup[0].status}
                  </Badge>
                </div>
              </div>

              {/* Individual Rooms */}
              <div className="space-y-2">
                <h3 className="font-semibold">Individual Rooms</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Suite Name</TableHead>
                        <TableHead>Room #</TableHead>
                        <TableHead className="text-right">Price/Night</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Booking Ref</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroup.map((room, index) => (
                        <TableRow key={room.id}>
                          <TableCell className="font-medium">Room {index + 1}</TableCell>
                          <TableCell>{room.units?.name || 'N/A'}</TableCell>
                          <TableCell>{room.units?.unit_number || '-'}</TableCell>
                          <TableCell className="text-right">
                            ${Number(room.price_per_night).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${Number(room.total_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{room.booking_reference}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowGroupDialog(false);
                                navigate(`/reservation/${room.id}`);
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
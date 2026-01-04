import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Wallet, CalendarIcon, X, Download, CheckCircle, Clock, Users, CheckCheck } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { SlideMenu } from '@/components/SlideMenu';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  net_revenue: number | null;
  source: string;
  payment_method: string | null;
  settled: string | null;
  commission_paid: string | null;
  commission_paid_at: string | null;
  price_per_night: number | null;
  nights: number | null;
  vat_exempt: boolean | null;
  units: { name: string; unit_number: string | null; booking_com_name: string | null } | null;
}

const Commissions = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [uniqueSources, setUniqueSources] = useState<string[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && userRole !== 'admin') {
      navigate('/admin');
      toast.error('Access denied. Admin only.');
    }
  }, [user, loading, userRole, navigate]);

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchReservations();
    }
  }, [user, userRole]);

  const fetchReservations = async () => {
    try {
      setIsLoading(true);

      // Fetch all reservations with commission (excluding booking.com and direct website)
      const { data, error } = await supabase
        .from('reservations')
        .select('id, booking_reference, guest_names, check_in_date, check_out_date, status, total_price, commission_rate, commission_amount, net_revenue, source, payment_method, settled, commission_paid, commission_paid_at, price_per_night, nights, vat_exempt, units(name, unit_number, booking_com_name)')
        .not('source', 'in', '("booking.com","direct website","Booking.com")')
        .not('commission_amount', 'is', null)
        .gt('commission_amount', 0)
        .is('cancelled_at', null)
        .order('check_in_date', { ascending: false });

      if (error) throw error;

      setReservations(data || []);

      // Get unique sources for filter
      const sources = [...new Set((data || []).map(r => r.source))].filter(Boolean).sort();
      setUniqueSources(sources);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load commissions data');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter reservations
  const getFilteredReservations = () => {
    let filtered = reservations;

    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(r => r.source === sourceFilter);
    }

    // Filter by date range
    if (dateRange?.from) {
      const to = dateRange.to || dateRange.from;
      filtered = filtered.filter(r => {
        const checkInDate = new Date(r.check_in_date);
        return checkInDate >= dateRange.from! && checkInDate <= to;
      });
    }

    return filtered;
  };

  const filteredReservations = getFilteredReservations();
  
  const unpaidCommissions = filteredReservations.filter(r => !r.commission_paid || r.commission_paid !== 'yes');
  const paidCommissions = filteredReservations.filter(r => r.commission_paid === 'yes');

  // Calculate commission: nights × price_per_night × 10%
  const calculateCommission = (r: Reservation) => {
    const nights = r.nights || 0;
    const pricePerNight = r.price_per_night || 0;
    return nights * pricePerNight * 0.10;
  };

  // For unpaid: recalculate commission; for paid: use stored commission_amount
  const totalUnpaid = unpaidCommissions.reduce((sum, r) => sum + calculateCommission(r), 0);
  const totalPaid = paidCommissions.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const grandTotal = totalUnpaid + totalPaid;

  // Calculate totals for selected reservations
  const selectedCommissions = unpaidCommissions.filter(r => selectedIds.has(r.id));
  const totalSelectedCommission = selectedCommissions.reduce((sum, r) => sum + calculateCommission(r), 0);

  const handleQuickFilter = (type: 'thisMonth' | 'lastMonth' | 'all') => {
    const now = new Date();
    if (type === 'thisMonth') {
      setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    } else if (type === 'lastMonth') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
    } else {
      setDateRange(undefined);
    }
  };

  const handleCommissionStatus = async (reservationId: string, status: 'yes' | 'no') => {
    try {
      setUpdating(reservationId);
      
      const paidAt = status === 'yes' ? new Date().toISOString() : null;
      
      const { error } = await supabase
        .from('reservations')
        .update({ 
          commission_paid: status === 'yes' ? 'yes' : null,
          commission_paid_at: paidAt
        })
        .eq('id', reservationId);

      if (error) throw error;

      // Update local state
      setReservations(prev => 
        prev.map(r => 
          r.id === reservationId 
            ? { ...r, commission_paid: status === 'yes' ? 'yes' : null, commission_paid_at: paidAt }
            : r
        )
      );

      toast.success(`Commission marked as ${status === 'yes' ? 'paid' : 'unpaid'}`);
    } catch (error) {
      console.error('Error updating commission status:', error);
      toast.error('Failed to update commission status');
    } finally {
      setUpdating(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(unpaidCommissions.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkMarkPaid = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setBulkUpdating(true);
      const paidAt = new Date().toISOString();
      const ids = Array.from(selectedIds);
      
      const { error } = await supabase
        .from('reservations')
        .update({ 
          commission_paid: 'yes',
          commission_paid_at: paidAt
        })
        .in('id', ids);

      if (error) throw error;

      // Update local state
      setReservations(prev => 
        prev.map(r => 
          selectedIds.has(r.id) 
            ? { ...r, commission_paid: 'yes', commission_paid_at: paidAt }
            : r
        )
      );

      toast.success(`${selectedIds.size} commission(s) marked as paid`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk updating commissions:', error);
      toast.error('Failed to update commissions');
    } finally {
      setBulkUpdating(false);
    }
  };

  const exportToExcel = () => {
    const calcVAT = (totalPrice: number, vatExempt: boolean = false) => {
      if (vatExempt) {
        return { netAmount: totalPrice, vatAmount: 0 };
      }
      const netAmount = totalPrice / 1.14;
      const vatAmount = totalPrice - netAmount;
      return { netAmount, vatAmount };
    };

    const formatUnpaidRow = (r: Reservation) => {
      const vat = calcVAT(r.total_price || 0, r.vat_exempt || false);
      return {
        'Team Member': r.source,
        'Booking Reference': r.booking_reference,
        'Suite': r.units?.booking_com_name || r.units?.name || 'Unassigned',
        'Room #': r.units?.unit_number || '-',
        'Price/Night': r.price_per_night || 0,
        'Nights': r.nights || 0,
        'Guest': r.guest_names?.[0] || 'N/A',
        'Check-in': format(new Date(r.check_in_date), 'MMM d, yyyy'),
        'Check-out': format(new Date(r.check_out_date), 'MMM d, yyyy'),
        'Net Revenue': vat.netAmount,
        'VAT (14%)': vat.vatAmount,
        'Commission': calculateCommission(r),
        'Status': 'Unpaid',
        'Paid On': '-',
      };
    };

    const formatPaidRow = (r: Reservation) => {
      const vat = calcVAT(r.total_price || 0, r.vat_exempt || false);
      return {
        'Team Member': r.source,
        'Booking Reference': r.booking_reference,
        'Suite': r.units?.booking_com_name || r.units?.name || 'Unassigned',
        'Room #': r.units?.unit_number || '-',
        'Price/Night': r.price_per_night || 0,
        'Nights': r.nights || 0,
        'Guest': r.guest_names?.[0] || 'N/A',
        'Check-in': format(new Date(r.check_in_date), 'MMM d, yyyy'),
        'Check-out': format(new Date(r.check_out_date), 'MMM d, yyyy'),
        'Net Revenue': vat.netAmount,
        'VAT (14%)': vat.vatAmount,
        'Commission': r.commission_amount || 0,
        'Status': 'Paid',
        'Paid On': r.commission_paid_at ? format(new Date(r.commission_paid_at), 'MMM d, yyyy') : '-',
      };
    };

    const wb = XLSX.utils.book_new();

    // Unpaid Commissions sheet
    const unpaidData = unpaidCommissions.map(formatUnpaidRow);
    if (unpaidData.length > 0) {
      unpaidData.push({ 
        'Team Member': 'TOTAL', 
        'Booking Reference': '', 
        'Suite': '', 
        'Room #': '', 
        'Price/Night': 0,
        'Nights': 0,
        'Guest': '', 
        'Check-in': '', 
        'Check-out': '', 
        'Net Revenue': unpaidCommissions.reduce((sum, r) => sum + calcVAT(r.total_price || 0, r.vat_exempt || false).netAmount, 0), 
        'VAT (14%)': unpaidCommissions.reduce((sum, r) => sum + calcVAT(r.total_price || 0, r.vat_exempt || false).vatAmount, 0),
        'Commission': totalUnpaid,
        'Status': '',
        'Paid On': ''
      });
    }
    const ws1 = XLSX.utils.json_to_sheet(unpaidData.length > 0 ? unpaidData : [{ Message: 'No unpaid commissions' }]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Unpaid Commissions');

    // Paid Commissions sheet
    const paidData = paidCommissions.map(formatPaidRow);
    if (paidData.length > 0) {
      paidData.push({ 
        'Team Member': 'TOTAL', 
        'Booking Reference': '', 
        'Suite': '', 
        'Room #': '', 
        'Price/Night': 0,
        'Nights': 0,
        'Guest': '', 
        'Check-in': '', 
        'Check-out': '', 
        'Net Revenue': paidCommissions.reduce((sum, r) => sum + calcVAT(r.total_price || 0, r.vat_exempt || false).netAmount, 0), 
        'VAT (14%)': paidCommissions.reduce((sum, r) => sum + calcVAT(r.total_price || 0, r.vat_exempt || false).vatAmount, 0),
        'Commission': totalPaid,
        'Status': '',
        'Paid On': ''
      });
    }
    const ws2 = XLSX.utils.json_to_sheet(paidData.length > 0 ? paidData : [{ Message: 'No paid commissions' }]);
    XLSX.utils.book_append_sheet(wb, ws2, 'Paid Commissions');

    // Summary by Team Member sheet
    const teamSummary = uniqueSources.map(source => {
      const sourceReservations = filteredReservations.filter(r => r.source === source);
      const unpaid = sourceReservations.filter(r => !r.commission_paid || r.commission_paid !== 'yes');
      const paid = sourceReservations.filter(r => r.commission_paid === 'yes');
      return {
        'Team Member': source,
        'Total Reservations': sourceReservations.length,
        'Unpaid Count': unpaid.length,
        'Unpaid Amount': unpaid.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
        'Paid Count': paid.length,
        'Paid Amount': paid.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
        'Total Commission': sourceReservations.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
      };
    });
    teamSummary.push({
      'Team Member': 'GRAND TOTAL',
      'Total Reservations': filteredReservations.length,
      'Unpaid Count': unpaidCommissions.length,
      'Unpaid Amount': totalUnpaid,
      'Paid Count': paidCommissions.length,
      'Paid Amount': totalPaid,
      'Total Commission': grandTotal,
    });
    const ws3 = XLSX.utils.json_to_sheet(teamSummary);
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary by Team Member');

    const fileName = `commissions-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Commission report exported successfully');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const calculateVAT = (totalPrice: number, vatExempt: boolean = false) => {
    if (vatExempt) {
      return { netAmount: totalPrice, vatAmount: 0 };
    }
    const netAmount = totalPrice / 1.14;
    const vatAmount = totalPrice - netAmount;
    return { netAmount, vatAmount };
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-2">
            <SlideMenu userRole={userRole} />
            
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin')}
              className="md:hidden"
              size="icon"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin')}
              className="hidden md:flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            
            <span className="text-sm text-muted-foreground">Back to Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Commissions Management</h1>
              <p className="text-sm text-muted-foreground">Track and manage team member commissions</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Commissions</CardTitle>
              <Clock className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">{formatCurrency(totalUnpaid)}</div>
              <p className="text-xs text-muted-foreground">
                {unpaidCommissions.length} reservations pending
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid Commissions</CardTitle>
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</div>
              <p className="text-xs text-muted-foreground">
                {paidCommissions.length} reservations completed
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{formatCurrency(grandTotal)}</div>
              <p className="text-xs text-muted-foreground">
                {uniqueSources.length} team members
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Filters</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFilter('thisMonth')}
                  className={cn(dateRange?.from && format(dateRange.from, 'MM-yyyy') === format(new Date(), 'MM-yyyy') && 'bg-primary/10')}
                >
                  This Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFilter('lastMonth')}
                >
                  Last Month
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickFilter('all')}
                  className={cn(!dateRange?.from && 'bg-primary/10')}
                >
                  All Time
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Team Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  {uniqueSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal w-full sm:w-auto",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {dateRange?.from && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDateRange(undefined)}
                  className="h-9 w-9"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              <div className="flex-1" />

              <Button onClick={exportToExcel} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export to Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Unpaid Commissions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Unpaid Commissions
                </CardTitle>
                <CardDescription>
                  {unpaidCommissions.length} reservations · Total: {formatCurrency(totalUnpaid)}
                </CardDescription>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected · Commission: <span className="font-semibold text-foreground">{formatCurrency(totalSelectedCommission)}</span>
                  </span>
                  <Button 
                    onClick={handleBulkMarkPaid} 
                    disabled={bulkUpdating}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark {selectedIds.size} as Paid
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {unpaidCommissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No unpaid commissions
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={unpaidCommissions.length > 0 && selectedIds.size === unpaidCommissions.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead className="hidden md:table-cell">Suite</TableHead>
                      <TableHead>Room #</TableHead>
                      <TableHead className="text-right">Price/Night</TableHead>
                      <TableHead className="text-center">Nights</TableHead>
                      <TableHead className="hidden md:table-cell">Guest</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-in</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-out</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">VAT (14%)</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidCommissions.map((reservation) => (
                      <TableRow
                        key={reservation.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/50",
                          selectedIds.has(reservation.id) && "bg-primary/5"
                        )}
                        onClick={() => navigate(`/reservation/${reservation.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(reservation.id)}
                            onCheckedChange={(checked) => handleSelectOne(reservation.id, !!checked)}
                            aria-label={`Select ${reservation.booking_reference}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{reservation.source}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{reservation.booking_reference}</TableCell>
                        <TableCell className="hidden md:table-cell">{reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}</TableCell>
                        <TableCell>{reservation.units?.unit_number || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(reservation.price_per_night || 0)}</TableCell>
                        <TableCell className="text-center">{reservation.nights || 0}</TableCell>
                        <TableCell className="hidden md:table-cell">{reservation.guest_names?.[0] || 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge 
                            variant={
                              reservation.status === 'checked-in' ? 'default' : 
                              reservation.status === 'completed' ? 'secondary' : 
                              'outline'
                            }
                            className={
                              reservation.status === 'checked-in' ? 'bg-green-500' : 
                              reservation.status === 'completed' ? 'bg-blue-500 text-white' : 
                              ''
                            }
                          >
                            {reservation.status === 'checked-in' ? 'Checked In' : 
                             reservation.status === 'completed' ? 'Completed' : 
                             reservation.status === 'confirmed' ? 'Confirmed' : 
                             reservation.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateVAT(reservation.total_price || 0, reservation.vat_exempt || false).netAmount)}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-muted-foreground">
                          {formatCurrency(calculateVAT(reservation.total_price || 0, reservation.vat_exempt || false).vatAmount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-amber-600">
                          {formatCurrency(calculateCommission(reservation))}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value="unpaid"
                            onValueChange={(value) => {
                              if (value === 'paid') {
                                handleCommissionStatus(reservation.id, 'yes');
                              }
                            }}
                            disabled={updating === reservation.id}
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unpaid">Unpaid</SelectItem>
                              <SelectItem value="paid">Mark Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell></TableCell>
                      <TableCell colSpan={5} className="font-semibold">Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell className="hidden lg:table-cell"></TableCell>
                      <TableCell className="hidden lg:table-cell"></TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(unpaidCommissions.reduce((sum, r) => sum + calculateVAT(r.total_price || 0, r.vat_exempt || false).netAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-muted-foreground">
                        {formatCurrency(unpaidCommissions.reduce((sum, r) => sum + calculateVAT(r.total_price || 0, r.vat_exempt || false).vatAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600">
                        {formatCurrency(totalUnpaid)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paid Commissions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  Paid Commissions
                </CardTitle>
                <CardDescription>
                  {paidCommissions.length} reservations · Total: {formatCurrency(totalPaid)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {paidCommissions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No paid commissions
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead className="hidden md:table-cell">Suite</TableHead>
                      <TableHead>Room #</TableHead>
                      <TableHead className="text-right">Price/Night</TableHead>
                      <TableHead className="text-center">Nights</TableHead>
                      <TableHead className="hidden md:table-cell">Guest</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-in</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-out</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">VAT (14%)</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="hidden md:table-cell">Paid On</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paidCommissions.map((reservation) => (
                      <TableRow
                        key={reservation.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/reservation/${reservation.id}`)}
                      >
                        <TableCell>
                          <Badge variant="outline">{reservation.source}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{reservation.booking_reference}</TableCell>
                        <TableCell className="hidden md:table-cell">{reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}</TableCell>
                        <TableCell>{reservation.units?.unit_number || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(reservation.price_per_night || 0)}</TableCell>
                        <TableCell className="text-center">{reservation.nights || 0}</TableCell>
                        <TableCell className="hidden md:table-cell">{reservation.guest_names?.[0] || 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge 
                            variant={
                              reservation.status === 'checked-in' ? 'default' : 
                              reservation.status === 'completed' ? 'secondary' : 
                              'outline'
                            }
                            className={
                              reservation.status === 'checked-in' ? 'bg-green-500' : 
                              reservation.status === 'completed' ? 'bg-blue-500 text-white' : 
                              ''
                            }
                          >
                            {reservation.status === 'checked-in' ? 'Checked In' : 
                             reservation.status === 'completed' ? 'Completed' : 
                             reservation.status === 'confirmed' ? 'Confirmed' : 
                             reservation.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(calculateVAT(reservation.total_price || 0, reservation.vat_exempt || false).netAmount)}</TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-muted-foreground">
                          {formatCurrency(calculateVAT(reservation.total_price || 0, reservation.vat_exempt || false).vatAmount)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(reservation.commission_amount || 0)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {reservation.commission_paid_at 
                            ? format(new Date(reservation.commission_paid_at), 'MMM dd, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value="paid"
                            onValueChange={(value) => {
                              if (value === 'unpaid') {
                                handleCommissionStatus(reservation.id, 'no');
                              }
                            }}
                            disabled={updating === reservation.id}
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="unpaid">Mark Unpaid</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-semibold">Total</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell className="hidden lg:table-cell"></TableCell>
                      <TableCell className="hidden lg:table-cell"></TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(paidCommissions.reduce((sum, r) => sum + calculateVAT(r.total_price || 0, r.vat_exempt || false).netAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-muted-foreground">
                        {formatCurrency(paidCommissions.reduce((sum, r) => sum + calculateVAT(r.total_price || 0, r.vat_exempt || false).vatAmount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(totalPaid)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell"></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Commissions;

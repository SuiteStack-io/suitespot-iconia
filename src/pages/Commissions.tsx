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
import { ArrowLeft, Wallet, CalendarIcon, X, Download, CheckCircle, Clock, Users } from 'lucide-react';
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
        .select('id, booking_reference, guest_names, check_in_date, check_out_date, status, total_price, commission_rate, commission_amount, net_revenue, source, payment_method, settled, commission_paid, units(name, unit_number, booking_com_name)')
        .not('source', 'in', '("booking.com","direct website","Booking.com")')
        .not('commission_amount', 'is', null)
        .gt('commission_amount', 0)
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

  const totalUnpaid = unpaidCommissions.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const totalPaid = paidCommissions.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const grandTotal = totalUnpaid + totalPaid;

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
      
      const { error } = await supabase
        .from('reservations')
        .update({ commission_paid: status === 'yes' ? 'yes' : null })
        .eq('id', reservationId);

      if (error) throw error;

      // Update local state
      setReservations(prev => 
        prev.map(r => 
          r.id === reservationId 
            ? { ...r, commission_paid: status === 'yes' ? 'yes' : null }
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

  const exportToExcel = () => {
    const formatRow = (r: Reservation) => ({
      'Team Member': r.source,
      'Booking Reference': r.booking_reference,
      'Suite': r.units?.booking_com_name || r.units?.name || 'Unassigned',
      'Room #': r.units?.unit_number || '-',
      'Guest': r.guest_names?.[0] || 'N/A',
      'Check-in': format(new Date(r.check_in_date), 'MMM d, yyyy'),
      'Check-out': format(new Date(r.check_out_date), 'MMM d, yyyy'),
      'Revenue': r.total_price || 0,
      'Commission': r.commission_amount || 0,
      'Status': r.commission_paid === 'yes' ? 'Paid' : 'Unpaid',
    });

    const wb = XLSX.utils.book_new();

    // Unpaid Commissions sheet
    const unpaidData = unpaidCommissions.map(formatRow);
    if (unpaidData.length > 0) {
      unpaidData.push({ 
        'Team Member': 'TOTAL', 
        'Booking Reference': '', 
        'Suite': '', 
        'Room #': '', 
        'Guest': '', 
        'Check-in': '', 
        'Check-out': '', 
        'Revenue': unpaidCommissions.reduce((sum, r) => sum + (r.total_price || 0), 0), 
        'Commission': totalUnpaid, 
        'Status': '' 
      });
    }
    const ws1 = XLSX.utils.json_to_sheet(unpaidData.length > 0 ? unpaidData : [{ Message: 'No unpaid commissions' }]);
    XLSX.utils.book_append_sheet(wb, ws1, 'Unpaid Commissions');

    // Paid Commissions sheet
    const paidData = paidCommissions.map(formatRow);
    if (paidData.length > 0) {
      paidData.push({ 
        'Team Member': 'TOTAL', 
        'Booking Reference': '', 
        'Suite': '', 
        'Room #': '', 
        'Guest': '', 
        'Check-in': '', 
        'Check-out': '', 
        'Revenue': paidCommissions.reduce((sum, r) => sum + (r.total_price || 0), 0), 
        'Commission': totalPaid, 
        'Status': '' 
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Unpaid Commissions
                </CardTitle>
                <CardDescription>
                  {unpaidCommissions.length} reservations · Total: {formatCurrency(totalUnpaid)}
                </CardDescription>
              </div>
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
                      <TableHead>Team Member</TableHead>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead className="hidden md:table-cell">Suite</TableHead>
                      <TableHead>Room #</TableHead>
                      <TableHead className="hidden md:table-cell">Guest</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-in</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-out</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unpaidCommissions.map((reservation) => (
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
                        <TableCell className="hidden md:table-cell">{reservation.guest_names?.[0] || 'N/A'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(reservation.total_price || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-amber-600">
                          {formatCurrency(reservation.commission_amount || 0)}
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
                      <TableCell colSpan={7} className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(unpaidCommissions.reduce((sum, r) => sum + (r.total_price || 0), 0))}
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
                      <TableHead className="hidden md:table-cell">Guest</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-in</TableHead>
                      <TableHead className="hidden lg:table-cell">Check-out</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
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
                        <TableCell className="hidden md:table-cell">{reservation.guest_names?.[0] || 'N/A'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(reservation.total_price || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(reservation.commission_amount || 0)}
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
                      <TableCell colSpan={7} className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(paidCommissions.reduce((sum, r) => sum + (r.total_price || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {formatCurrency(totalPaid)}
                      </TableCell>
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

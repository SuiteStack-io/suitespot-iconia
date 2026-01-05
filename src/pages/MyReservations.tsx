import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { DollarSign, TrendingUp, Calendar, ArrowLeft, Wallet, BarChart3, CalendarIcon, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { SlideMenu } from '@/components/SlideMenu';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number;
  commission_rate: number;
  commission_amount: number;
  commission_paid: string | null;
  net_revenue: number;
  source: string;
  payment_method: string | null;
  settled: string | null;
  vat_exempt: boolean | null;
  units: { name: string; unit_number: string | null } | null;
}

// VAT calculation helper - matches Commissions page
const calculateVAT = (totalPrice: number, vatExempt: boolean = false) => {
  if (vatExempt) {
    return { netAmount: totalPrice, vatAmount: 0 };
  }
  const netAmount = totalPrice / 1.14;
  const vatAmount = totalPrice - netAmount;
  return { netAmount, vatAmount };
};

// Calculate commission: 10% of Net Revenue (excludes VAT)
const calculateCommission = (totalPrice: number, vatExempt: boolean = false) => {
  const netRevenue = vatExempt ? totalPrice : totalPrice / 1.14;
  return netRevenue * 0.10;
};

const MyReservations = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filteredStats, setFilteredStats] = useState({
    totalReservations: 0,
    totalCommission: 0,
    totalNights: 0,
  });
  const [lifetimeStats, setLifetimeStats] = useState({
    totalCommission: 0,
    totalRevenue: 0,
    totalReservations: 0,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUserReservations();
    }
  }, [user]);

  // Filter reservations and calculate stats when dateRange changes
  useEffect(() => {
    if (!dateRange?.from) {
      setFilteredReservations(reservations);
      // Calculate current month stats as default
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyReservations = reservations.filter(res => {
        const checkInDate = new Date(res.check_in_date);
        return checkInDate.getMonth() === currentMonth && checkInDate.getFullYear() === currentYear;
      });
      calculateFilteredStats(monthlyReservations);
    } else {
      const filtered = reservations.filter(res => {
        const checkInDate = new Date(res.check_in_date);
        const from = dateRange.from!;
        const to = dateRange.to || dateRange.from!;
        return checkInDate >= from && checkInDate <= to;
      });
      setFilteredReservations(filtered);
      calculateFilteredStats(filtered);
    }
  }, [dateRange, reservations]);

  const calculateFilteredStats = (data: Reservation[]) => {
    const stats = data.reduce(
      (acc, res) => {
        const checkIn = new Date(res.check_in_date);
        const checkOut = new Date(res.check_out_date);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        
        // Use stored amount for paid commissions, recalculate for unpaid
        const commission = res.commission_paid === 'yes' 
          ? (res.commission_amount || 0)
          : calculateCommission(res.total_price || 0, res.vat_exempt || false);
        
        return {
          totalReservations: acc.totalReservations + 1,
          totalCommission: acc.totalCommission + commission,
          totalNights: acc.totalNights + nights,
        };
      },
      { totalReservations: 0, totalCommission: 0, totalNights: 0 }
    );
    setFilteredStats(stats);
  };

  const fetchUserReservations = async () => {
    try {
      setIsLoading(true);

      // Get user's full name from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      const fullName = profile?.full_name || '';
      setUserName(fullName);

      // Fetch reservations where source matches user's name
      const { data, error } = await supabase
        .from('reservations')
        .select('id, booking_reference, guest_names, check_in_date, check_out_date, status, total_price, commission_rate, commission_amount, commission_paid, net_revenue, source, payment_method, settled, vat_exempt, units(name, unit_number)')
        .eq('source', fullName)
        .order('check_in_date', { ascending: false });

      if (error) throw error;

      setReservations(data || []);

      // Calculate lifetime stats - use stored amount for paid, recalculate for unpaid
      const lifetime = (data || []).reduce(
        (acc, res) => {
          const commission = res.commission_paid === 'yes' 
            ? (res.commission_amount || 0)
            : calculateCommission(res.total_price || 0, res.vat_exempt || false);
          
          return {
            totalCommission: acc.totalCommission + commission,
            totalRevenue: acc.totalRevenue + (res.total_price || 0),
            totalReservations: acc.totalReservations + 1,
          };
        },
        { totalCommission: 0, totalRevenue: 0, totalReservations: 0 }
      );

      setLifetimeStats(lifetime);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDateRangeLabel = () => {
    if (!dateRange?.from) {
      return format(new Date(), 'MMMM yyyy');
    }
    if (!dateRange.to) {
      return format(dateRange.from, 'MMM dd, yyyy');
    }
    return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;
  };

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
            
            {/* Mobile back button - icon only */}
            <Button 
              variant="ghost" 
              onClick={() => navigate('/admin')}
              className="md:hidden"
              size="icon"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {/* Desktop back button with text */}
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
              <h1 className="text-2xl font-bold">My Commissions</h1>
              <p className="text-sm text-muted-foreground">Track your earnings and reservations</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Lifetime Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Commission Earned</CardTitle>
              <Wallet className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">${lifetimeStats.totalCommission.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Lifetime earnings from {lifetimeStats.totalReservations} reservations
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue Generated</CardTitle>
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">${lifetimeStats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Total value of all your bookings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-lg">Filter by Date Range</CardTitle>
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
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          </CardContent>
        </Card>

        {/* Filtered Period Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservations</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStats.totalReservations}</div>
              <p className="text-xs text-muted-foreground">
                {getDateRangeLabel()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${filteredStats.totalCommission.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Earned in period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Nights Booked</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredStats.totalNights}</div>
              <p className="text-xs text-muted-foreground">
                Across all rooms in period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Reservations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
            <CardDescription>
              {dateRange?.from 
                ? `Showing ${filteredReservations.length} reservations for selected period`
                : `Showing ${filteredReservations.length} reservations for ${format(new Date(), 'MMMM yyyy')}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredReservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reservations found for selected period
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead>Room #</TableHead>
                      <TableHead>Guest(s)</TableHead>
                      <TableHead className="hidden md:table-cell">Unit</TableHead>
                      <TableHead className="hidden md:table-cell">Check-in</TableHead>
                      <TableHead className="hidden md:table-cell">Check-out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Net Revenue</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">VAT (14%)</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Settled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReservations.map((reservation) => (
                      <TableRow
                        key={reservation.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/reservation/${reservation.id}`)}
                      >
                        <TableCell className="font-medium">
                          {reservation.booking_reference}
                        </TableCell>
                        <TableCell>{reservation.units?.unit_number || 'N/A'}</TableCell>
                        <TableCell>{reservation.guest_names.join(', ')}</TableCell>
                        <TableCell className="hidden md:table-cell">{reservation.units?.name || 'N/A'}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            reservation.status === 'confirmed' ? 'default' :
                            reservation.status === 'checked-in' ? 'secondary' :
                            reservation.status === 'checked-out' ? 'outline' :
                            'destructive'
                          }>
                            {reservation.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${calculateVAT(reservation.total_price || 0, reservation.vat_exempt || false).netAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-muted-foreground">
                          ${calculateVAT(reservation.total_price || 0, reservation.vat_exempt || false).vatAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                            ${reservation.commission_paid === 'yes' 
                              ? (reservation.commission_amount?.toFixed(2) || '0.00')
                              : calculateCommission(reservation.total_price || 0, reservation.vat_exempt || false).toFixed(2)
                            }
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reservation.payment_method === 'cash' ? 'Cash' : 
                             reservation.payment_method === 'credit_card' ? 'Credit Card' : 
                             reservation.payment_method === 'booking_com' ? 'Booking.com' :
                             'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {reservation.settled === 'booking_com' ? 'Booking.com' : 
                             reservation.settled === 'yes' ? 'Yes' : 
                             'No'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MyReservations;
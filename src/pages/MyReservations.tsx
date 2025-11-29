import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { SlideMenu } from '@/components/SlideMenu';

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
  net_revenue: number;
  source: string;
  units: { name: string } | null;
}

const MyReservations = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [monthlyStats, setMonthlyStats] = useState({
    totalReservations: 0,
    totalCommission: 0,
    totalNights: 0,
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
        .select('id, booking_reference, guest_names, check_in_date, check_out_date, status, total_price, commission_rate, commission_amount, net_revenue, source, units(name)')
        .eq('source', fullName)
        .order('check_in_date', { ascending: false });

      if (error) throw error;

      setReservations(data || []);

      // Calculate monthly stats (current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      const monthlyReservations = (data || []).filter(res => {
        const checkInDate = new Date(res.check_in_date);
        return checkInDate.getMonth() === currentMonth && checkInDate.getFullYear() === currentYear;
      });

      const stats = monthlyReservations.reduce(
        (acc, res) => {
          const checkIn = new Date(res.check_in_date);
          const checkOut = new Date(res.check_out_date);
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            totalReservations: acc.totalReservations + 1,
            totalCommission: acc.totalCommission + (res.commission_amount || 0),
            totalNights: acc.totalNights + nights,
          };
        },
        { totalReservations: 0, totalCommission: 0, totalNights: 0 }
      );

      setMonthlyStats(stats);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setIsLoading(false);
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
            <SlideMenu isAdmin={userRole === 'admin'} />
            
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
            
            <span>Back to Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold">My Reservations</h1>
          <p className="text-sm text-muted-foreground">View your reservations and commissions</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Monthly Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month's Reservations</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyStats.totalReservations}</div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), 'MMMM yyyy')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Commission</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${monthlyStats.totalCommission.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Earned this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Nights Booked</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthlyStats.totalNights}</div>
              <p className="text-xs text-muted-foreground">
                Across all rooms
              </p>
            </CardContent>
          </Card>
        </div>

        {/* All Reservations Table */}
        <Card>
          <CardHeader>
            <CardTitle>All My Reservations</CardTitle>
            <CardDescription>
              Showing all reservations assigned to {userName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reservations found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead>Guest(s)</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => (
                      <TableRow
                        key={reservation.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/reservation/${reservation.id}`)}
                      >
                        <TableCell className="font-medium">
                          {reservation.booking_reference}
                        </TableCell>
                        <TableCell>{reservation.guest_names.join(', ')}</TableCell>
                        <TableCell>{reservation.units?.name || 'N/A'}</TableCell>
                        <TableCell>
                          {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            reservation.status === 'confirmed' ? 'default' :
                            reservation.status === 'checked_in' ? 'secondary' :
                            reservation.status === 'checked_out' ? 'outline' :
                            'destructive'
                          }>
                            {reservation.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ${reservation.total_price?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          ${reservation.commission_amount?.toFixed(2) || '0.00'}
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

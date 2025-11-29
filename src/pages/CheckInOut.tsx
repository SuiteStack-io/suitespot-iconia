import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, ArrowLeft, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  guest_types: string[] | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  number_of_guests: number;
  units: { name: string; unit_number: string | null } | null;
}

const CheckInOut = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [departures, setDepartures] = useState<Reservation[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    
    fetchTodayReservations();
    
    // Real-time updates
    const channel = supabase
      .channel('checkinout-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchTodayReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loading, navigate]);

  const fetchTodayReservations = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch arrivals (check-in today, status = confirmed)
    const { data: arrivalsData } = await supabase
      .from('reservations')
      .select('id, booking_reference, guest_names, guest_types, check_in_date, check_out_date, status, number_of_guests, units(name, unit_number)')
      .eq('check_in_date', today)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });

    // Fetch departures (check-out today, status = checked-in)
    const { data: departuresData } = await supabase
      .from('reservations')
      .select('id, booking_reference, guest_names, guest_types, check_in_date, check_out_date, status, number_of_guests, units(name, unit_number)')
      .eq('check_out_date', today)
      .eq('status', 'checked-in')
      .order('created_at', { ascending: false });

    setArrivals(arrivalsData || []);
    setDepartures(departuresData || []);
  };

  const handleCheckIn = async (reservationId: string) => {
    setUpdating(reservationId);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'checked-in' })
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Guest checked in successfully',
      });

      fetchTodayReservations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleCheckOut = async (reservationId: string) => {
    setUpdating(reservationId);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'checked-out' })
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Guest checked out successfully',
      });

      fetchTodayReservations();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Check-In / Check-Out</h1>
          <p className="text-muted-foreground">
            Manage today's arrivals and departures
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Arrivals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-blue-600" />
                Today's Arrivals ({arrivals.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {arrivals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No arrivals today
                </p>
              ) : (
                arrivals.map((reservation) => (
                  <Card key={reservation.id} className="bg-accent/20">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {reservation.units?.unit_number && (
                          <p className="text-lg font-bold text-primary">
                            Room #{reservation.units.unit_number}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {reservation.booking_reference}
                            </p>
                            <div className="space-y-1 mt-1">
                              {reservation.guest_names.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <p className="text-sm">{name}</p>
                                  {reservation.guest_types && reservation.guest_types[idx] && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {reservation.guest_types[idx]}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {reservation.units?.name || 'No unit assigned'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.number_of_guests} guest{reservation.number_of_guests !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleCheckIn(reservation.id)}
                            disabled={updating === reservation.id}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Check In
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Today's Departures */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogOut className="h-5 w-5 text-orange-600" />
                Today's Departures ({departures.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {departures.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No departures today
                </p>
              ) : (
                departures.map((reservation) => (
                  <Card key={reservation.id} className="bg-accent/20">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {reservation.units?.unit_number && (
                          <p className="text-lg font-bold text-primary">
                            Room #{reservation.units.unit_number}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {reservation.booking_reference}
                            </p>
                            <div className="space-y-1 mt-1">
                              {reservation.guest_names.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <p className="text-sm">{name}</p>
                                  {reservation.guest_types && reservation.guest_types[idx] && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {reservation.guest_types[idx]}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {reservation.units?.name || 'No unit assigned'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.number_of_guests} guest{reservation.number_of_guests !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <Button
                            onClick={() => handleCheckOut(reservation.id)}
                            disabled={updating === reservation.id}
                            variant="outline"
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Check Out
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CheckInOut;

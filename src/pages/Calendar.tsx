import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Hotel, LogOut, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface Unit {
  id: string;
  unit_number: string;
  name: string;
  unit_type: string;
  unit_size: string;
}

interface Reservation {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_names: string[];
  booking_reference: string;
  status: string;
}

const Calendar = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchUnits();
      fetchReservations();
    }
  }, [user]);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('unit_number');
    
    if (!error && data) {
      setUnits(data);
      if (data.length > 0 && !selectedUnit) {
        setSelectedUnit(data[0].id);
      }
    }
  };

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*');
    
    if (!error && data) {
      setReservations(data);
    }
  };

  const getReservationForCell = (unitId: string, date: Date) => {
    return reservations.find(res => {
      const checkIn = new Date(res.check_in_date);
      const checkOut = new Date(res.check_out_date);
      return res.unit_id === unitId && date >= checkIn && date < checkOut;
    });
  };

  const isFirstDayOfReservation = (reservation: Reservation, date: Date) => {
    return isSameDay(new Date(reservation.check_in_date), date);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const monthDays = selectedUnit
    ? eachDayOfInterval({
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth),
      })
    : [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Hotel className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Room Calendar</h1>
              <p className="text-sm text-muted-foreground">Manage room bookings</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              Back to Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
            <TabsTrigger value="monthly">Monthly View</TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="mt-6">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous Week
                </Button>
                <h2 className="text-lg font-semibold">
                  {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                >
                  Next Week
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-muted text-left font-semibold">Room</th>
                      {weekDays.map(day => (
                        <th key={day.toISOString()} className="border p-2 bg-muted text-center min-w-[120px]">
                          <div className="font-semibold">{format(day, 'EEE')}</div>
                          <div className="text-sm text-muted-foreground">{format(day, 'MMM d')}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {units.map(unit => (
                      <tr key={unit.id}>
                        <td className="border p-2 bg-muted/50 font-medium">
                          <div>{unit.unit_number}</div>
                          <div className="text-xs text-muted-foreground">{unit.unit_type}</div>
                        </td>
                        {weekDays.map(day => {
                          const reservation = getReservationForCell(unit.id, day);
                          const isFirstDay = reservation && isFirstDayOfReservation(reservation, day);
                          
                          return (
                            <td key={`${unit.id}-${day.toISOString()}`} className="border p-1">
                              {reservation && (
                                <div
                                  className={cn(
                                    "h-full p-2 rounded text-xs",
                                    reservation.status === 'confirmed' ? "bg-primary/20 text-primary" : "bg-muted",
                                    isFirstDay && "font-semibold"
                                  )}
                                >
                                  {isFirstDay && (
                                    <>
                                      <div className="font-semibold">{reservation.guest_names[0]}</div>
                                      <div className="text-[10px] opacity-75">{reservation.booking_reference}</div>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
            <Card className="p-4">
              <div className="mb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {format(selectedMonth, 'MMMM yyyy')}
                  </h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {units.map(unit => (
                    <Button
                      key={unit.id}
                      variant={selectedUnit === unit.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedUnit(unit.id)}
                    >
                      {unit.unit_number}
                    </Button>
                  ))}
                </div>
              </div>

              {selectedUnit && (
                <div className="grid grid-cols-7 gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-center font-semibold text-sm p-2 bg-muted rounded">
                      {day}
                    </div>
                  ))}
                  
                  {monthDays.map((day, index) => {
                    const reservation = getReservationForCell(selectedUnit, day);
                    const isFirstDay = reservation && isFirstDayOfReservation(reservation, day);
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "border rounded p-2 min-h-[80px]",
                          reservation ? "bg-primary/10" : "bg-card"
                        )}
                      >
                        <div className="text-sm font-semibold mb-1">{format(day, 'd')}</div>
                        {reservation && isFirstDay && (
                          <div className="text-xs">
                            <div className="font-semibold text-primary">{reservation.guest_names[0]}</div>
                            <div className="text-[10px] opacity-75">{reservation.booking_reference}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Calendar;

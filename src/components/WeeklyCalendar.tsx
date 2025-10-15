import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfWeek, addDays, format, addWeeks, subWeeks, isWithinInterval, isSameDay } from 'date-fns';

interface Unit {
  id: string;
  unit_number: string | null;
  name: string;
}

interface Reservation {
  id: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  source: string;
}

export const WeeklyCalendar = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    fetchUnits();
    fetchReservations();

    // Set up real-time subscription for reservations
    const channel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
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

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, unit_number, name')
      .order('unit_number');
    
    if (error) {
      console.error('Error fetching units:', error);
      return;
    }
    setUnits(data || []);
  };

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, unit_id, check_in_date, check_out_date, status, source')
      .eq('status', 'confirmed');
    
    if (error) {
      console.error('Error fetching reservations:', error);
      return;
    }
    setReservations(data || []);
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  };

  const getReservationForDate = (date: Date, unitId: string) => {
    return reservations.find(reservation => {
      if (reservation.unit_id !== unitId) return false;
      
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      
      return isWithinInterval(date, { start: checkIn, end: checkOut }) || 
             isSameDay(date, checkIn) || 
             isSameDay(date, checkOut);
    });
  };

  const getSourceAbbreviation = (source: string) => {
    if (source.toLowerCase().includes('booking')) return 'B.com';
    if (source.toLowerCase().includes('direct')) return 'Direct';
    if (source.toLowerCase().includes('referral')) return 'Ref';
    return source.substring(0, 6);
  };

  const navigatePreviousWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const navigateNextWeek = () => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const weekDays = getWeekDays();
  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 0 }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Weekly Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigatePreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[200px] text-center">
              {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
            </div>
            <Button variant="outline" size="sm" onClick={navigateNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                Today
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card border border-border p-3 text-left font-semibold min-w-[120px]">
                  Room ID
                </th>
                {weekDays.map((day, index) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th 
                      key={index} 
                      className={`border border-border p-3 text-center font-semibold min-w-[100px] ${
                        isToday ? 'bg-primary text-primary-foreground' : ''
                      }`}
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div className={`text-sm font-normal ${isToday ? 'opacity-90' : 'text-muted-foreground'}`}>
                        {format(day, 'MMM d')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className="sticky left-0 z-10 bg-card border border-border p-3 font-medium">
                    {unit.unit_number || unit.name}
                  </td>
                  {weekDays.map((day, index) => {
                    const reservation = getReservationForDate(day, unit.id);
                    return (
                      <td
                        key={index}
                        className={`border border-border p-3 text-center ${
                          reservation
                            ? 'bg-red-500/80 text-white'
                            : 'bg-background'
                        }`}
                      >
                        {reservation && (
                          <div className="text-xs space-y-1">
                            <div>Reserved</div>
                            <div className="text-[10px] opacity-90">{getSourceAbbreviation(reservation.source)}</div>
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
      </CardContent>
    </Card>
  );
};

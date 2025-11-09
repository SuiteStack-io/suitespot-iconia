import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfWeek, addDays, format, addWeeks, subWeeks, isWithinInterval, isSameDay } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface Unit {
  id: string;
  unit_number: string | null;
  name: string;
  unit_type: string | null;
}

interface Reservation {
  id: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  source: string;
  guest_names: string[];
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  unit_id: string | null;
  reason: string | null;
}

export const WeeklyCalendar = () => {
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  useEffect(() => {
    fetchUnits();
    fetchReservations();
    fetchBlockedDates();

    // Set up real-time subscription for reservations
    const channel = supabase
      .channel('weekly-calendar-reservations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('WeeklyCalendar real-time update received:', payload);
          fetchReservations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates'
        },
        (payload) => {
          console.log('WeeklyCalendar blocked dates update:', payload);
          fetchBlockedDates();
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('WeeklyCalendar successfully subscribed to real-time updates');
        }
        if (err) {
          console.error('WeeklyCalendar subscription error:', err);
        }
      });

    return () => {
      console.log('WeeklyCalendar cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, unit_number, name, unit_type')
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
      .select('id, unit_id, check_in_date, check_out_date, status, source, guest_names')
      .eq('status', 'confirmed');
    
    if (error) {
      console.error('Error fetching reservations:', error);
      return;
    }
    setReservations(data || []);
  };

  const fetchBlockedDates = async () => {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('*');
    
    if (error) {
      console.error('Error fetching blocked dates:', error);
      return;
    }
    setBlockedDates(data || []);
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  };

  const isDateBlocked = (date: Date, unitId: string) => {
    return blockedDates.some(blocked => {
      const blockedDate = new Date(blocked.blocked_date);
      return isSameDay(date, blockedDate) && (blocked.unit_id === null || blocked.unit_id === unitId);
    });
  };

  const getReservationsForDate = (date: Date, unitId: string) => {
    const checkingOut = reservations.find(reservation => {
      if (reservation.unit_id !== unitId) return false;
      const checkOut = new Date(reservation.check_out_date);
      return isSameDay(date, checkOut);
    });

    const checkingIn = reservations.find(reservation => {
      if (reservation.unit_id !== unitId) return false;
      const checkIn = new Date(reservation.check_in_date);
      return isSameDay(date, checkIn);
    });

    const staying = reservations.find(reservation => {
      if (reservation.unit_id !== unitId) return false;
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      // Staying if date is between check-in and check-out (exclusive)
      return date > checkIn && date < checkOut;
    });

    return { checkingOut, checkingIn, staying };
  };

  const getSourceAbbreviation = (source: string) => {
    if (source.toLowerCase().includes('booking')) return 'B.com';
    if (source.toLowerCase().includes('direct')) return 'Direct';
    if (source.toLowerCase().includes('referral')) return 'Ref';
    return source.substring(0, 6);
  };

  const getReservationColor = (source: string) => {
    const lowerSource = source.toLowerCase();
    // Check admin/manager first before checking booking
    if (lowerSource.includes('admin') || lowerSource.includes('manager')) {
      return 'bg-green-500/80 text-white'; // Admin bookings green
    }
    if (lowerSource.includes('booking')) {
      return 'bg-[#003580] text-white'; // Booking.com brand blue
    }
    return 'bg-red-500/80 text-white'; // Direct website and other sources red
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
          <CardTitle className={isMobile ? "hidden" : ""}>Weekly Calendar</CardTitle>
          <div className={`flex items-center ${isMobile ? 'gap-1.5 w-full justify-between' : 'gap-2'}`}>
            {!isMobile && !isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                Today
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={navigatePreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className={`text-sm font-medium text-center ${isMobile ? 'flex-1' : 'min-w-[200px]'}`}>
              {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
            </div>
            <Button variant="outline" size="sm" onClick={navigateNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {isMobile && !isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} className="ml-1">
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
                  Suite Name
                </th>
                {weekDays.map((day, index) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th 
                      key={index} 
                      className={`border border-border p-3 text-center font-semibold min-w-[120px] ${
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
                  <td className="sticky left-0 z-10 bg-card border border-border p-3">
                    <div>
                      <div className="font-semibold">{unit.name} {unit.unit_number && `(${unit.unit_number})`}</div>
                      <div className="text-sm text-muted-foreground">{unit.unit_type}</div>
                    </div>
                  </td>
                  {weekDays.map((day, index) => {
                    const { checkingOut, checkingIn, staying } = getReservationsForDate(day, unit.id);
                    const blocked = isDateBlocked(day, unit.id);
                    const hasBothCheckOutAndIn = checkingOut && checkingIn;
                    
                    return (
                      <td
                        key={index}
                        className={`border border-border p-0 ${
                          blocked ? 'bg-black text-white' : !checkingOut && !checkingIn && !staying ? 'bg-background' : ''
                        }`}
                      >
                        {blocked ? (
                          <div className="p-2 text-center min-h-[60px] flex items-center justify-center">
                            <div className="text-xs space-y-1">
                              <div>Blocked</div>
                            </div>
                          </div>
                        ) : hasBothCheckOutAndIn ? (
                          // Split cell: top half for checkout, bottom half for check-in
                          <div className="flex flex-col h-full min-h-[60px]">
                            <div className={`flex-1 ${getReservationColor(checkingOut.source)} p-1 text-center border-b border-border/50`}>
                              <div className="text-xs space-y-0.5 break-words">
                                <div className="text-[10px] opacity-75">Check-out</div>
                                <div className="text-[10px] font-medium">{checkingOut.guest_names[0] || 'Guest'}</div>
                              </div>
                            </div>
                            <div className={`flex-1 ${getReservationColor(checkingIn.source)} p-1 text-center`}>
                              <div className="text-xs space-y-0.5 break-words">
                                <div className="text-[10px] opacity-75">Check-in</div>
                                <div className="text-[10px] font-medium">{checkingIn.guest_names[0] || 'Guest'}</div>
                              </div>
                            </div>
                          </div>
                        ) : checkingOut ? (
                          // Just checkout - split cell showing occupied until checkout
                          <div className="flex flex-col h-full min-h-[60px]">
                            <div className={`flex-1 ${getReservationColor(checkingOut.source)} p-1 text-center border-b border-border/50`}>
                              <div className="text-xs space-y-0.5 break-words">
                                <div>Reserved</div>
                                <div className="text-[10px] font-medium">{checkingOut.guest_names[0] || 'Guest'}</div>
                              </div>
                            </div>
                            <div className="flex-1 bg-background p-1 text-center">
                              <div className="text-xs opacity-50">Available</div>
                            </div>
                          </div>
                        ) : checkingIn ? (
                          // Just check-in - split cell showing available until check-in
                          <div className="flex flex-col h-full min-h-[60px]">
                            <div className="flex-1 bg-background p-1 text-center border-b border-border/50">
                              <div className="text-xs opacity-50">Available</div>
                            </div>
                            <div className={`flex-1 ${getReservationColor(checkingIn.source)} p-1 text-center`}>
                              <div className="text-xs space-y-0.5 break-words">
                                <div>Reserved</div>
                                <div className="text-[10px] font-medium">{checkingIn.guest_names[0] || 'Guest'}</div>
                              </div>
                            </div>
                          </div>
                        ) : staying ? (
                          // Staying (between check-in and checkout)
                          <div className={`${getReservationColor(staying.source)} p-2 text-center min-h-[60px] flex items-center justify-center`}>
                            <div className="text-xs space-y-1 break-words">
                              <div>Reserved</div>
                              <div className="text-[10px] opacity-90 font-medium">{staying.guest_names[0] || 'Guest'}</div>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      
      <div className="px-6 pb-6">
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-16 h-6 bg-[#003580] border rounded flex items-center justify-center text-white text-xs">B.com</div>
            <span>= Booking.com</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-6 bg-green-500/80 border rounded flex items-center justify-center text-white text-xs">Admin</div>
            <span>= Admin Booking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-6 bg-red-500/80 border rounded flex items-center justify-center text-white text-xs">Direct</div>
            <span>= Direct Website</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-16 h-6 bg-black border rounded flex items-center justify-center text-white text-xs">Block</div>
            <span>= Blocked</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

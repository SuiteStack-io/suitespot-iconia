import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

interface Unit {
  id: string;
  unit_number: string | null;
  name: string;
  booking_com_name: string | null;
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
  booking_reference: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  unit_id: string | null;
  reason: string | null;
}

export const WeeklyCalendar = () => {
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfDay(new Date()));
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  useEffect(() => {
    fetchUnits();
    fetchReservations();
    fetchBlockedDates();

    const channel = supabase
      .channel('weekly-calendar-reservations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchReservations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, () => fetchBlockedDates())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, unit_number, name, booking_com_name, unit_type')
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
        .select('id, unit_id, check_in_date, check_out_date, status, source, guest_names, booking_reference')
        .in('status', ['confirmed', 'checked-in', 'checked-out'])
        .is('cancelled_at', null);
    
    if (error) {
      console.error('Error fetching reservations:', error);
      return;
    }
    setReservations(data || []);
  };

  const fetchBlockedDates = async () => {
    const { data, error} = await supabase.from('blocked_dates').select('*');
    if (error) console.error('Error fetching blocked dates:', error);
    else setBlockedDates(data || []);
  };

  const getWeekDays = () => Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  const hasConflict = (date: Date, unitId: string) => {
    const conflictingReservations = reservations.filter(res => {
      if (res.unit_id !== unitId || !['confirmed', 'checked-in', 'checked-out'].includes(res.status)) return false;
      const checkIn = new Date(res.check_in_date);
      const checkOut = new Date(res.check_out_date);
      return date >= checkIn && date < checkOut;
    });
    return conflictingReservations.length > 1;
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
      return date > checkIn && date < checkOut;
    });

    // Check if checkingOut and checkingIn are part of the same extension
    // (one has -EXT, -EXT2, -EXT3, etc. suffix sharing the same base reference)
    const getBaseRef = (ref: string) => ref.replace(/-EXT\d*$/, '');
    const isExtension = checkingOut && checkingIn && 
      checkingOut.unit_id === checkingIn.unit_id &&
      /-EXT\d*$/.test(checkingIn.booking_reference) &&
      getBaseRef(checkingIn.booking_reference) === getBaseRef(checkingOut.booking_reference);

    return { checkingOut, checkingIn, staying, isExtension };
  };

  const getReservationColor = (source: string, status?: string) => {
    // Apply dimmed styling for completed/checked-out reservations
    const isDimmed = status === 'completed' || status === 'checked-out';
    const opacity = isDimmed ? 'opacity-50' : '';
    
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('admin') || lowerSource.includes('manager')) {
      return `bg-green-500/80 text-white ${opacity}`;
    }
    if (lowerSource.includes('booking')) {
      return `bg-[#003580] text-white ${opacity}`;
    }
    return `bg-red-500/80 text-white ${opacity}`;
  };

  const navigatePreviousWeek = () => setCurrentWeekStart(prev => addDays(prev, -7));
  const navigateNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfDay(new Date()));

  const weekDays = getWeekDays();
  const isCurrentWeek = isSameDay(currentWeekStart, startOfDay(new Date()));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={isMobile ? "hidden" : ""}>Weekly Calendar</CardTitle>
          <div className={`flex items-center ${isMobile ? 'gap-1.5 w-full justify-between' : 'gap-2'}`}>
            {!isMobile && !isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek}>Today</Button>
            )}
            <Button variant="outline" size="sm" onClick={navigatePreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className={`text-sm font-medium text-center ${isMobile ? 'flex-1' : 'min-w-[200px]'}`}>
              {format(weekDays[0], 'MMM d')} - {format(weekDays[13], 'MMM d, yyyy')}
            </div>
            <Button variant="outline" size="sm" onClick={navigateNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {isMobile && !isCurrentWeek && (
              <Button variant="outline" size="sm" onClick={goToCurrentWeek} className="ml-1">Today</Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 text-xs flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#003580] rounded" />
            <span>Booking.com</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/80 rounded" />
            <span>Admin Booking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500/80 rounded" />
            <span>Direct Website</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-black rounded" />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 border border-red-700 rounded animate-pulse" />
            <span className="font-medium">Double Booking Conflict</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-max">
            <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, 70px)` }}>
              <div className="font-medium text-sm p-2">Room Name</div>
              {weekDays.map((day, index) => {
                const isToday = isSameDay(day, new Date());
                return (
              <div
                key={index}
                className={`text-center text-xs p-2 rounded ${
                  isToday ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground'
                }`}
              >
                <div>{format(day, 'EEE')}</div>
                <div className="font-medium">{format(day, 'd')}</div>
                <div className="text-[10px]">{format(day, 'MMM')}</div>
              </div>
                );
              })}
            </div>

            {units.map((unit) => (
              <div
                key={unit.id}
                className="grid gap-1 mb-1"
                style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, 70px)` }}
              >
                <div className="flex items-center text-sm font-medium p-2 bg-muted/50 rounded">
                  <div>
                    <div>{unit.booking_com_name || unit.name}</div>
                    <div className="text-xs text-muted-foreground">#{unit.unit_number}</div>
                  </div>
                </div>
                {weekDays.map((day, index) => {
                  const { checkingOut, checkingIn, staying, isExtension } = getReservationsForDate(day, unit.id);
                  const blocked = isDateBlocked(day, unit.id);
                  const conflict = hasConflict(day, unit.id);
                  const hasBothCheckOutAndIn = checkingOut && checkingIn && !isExtension;
                  
                  return (
                    <div
                      key={index}
                      className={`h-14 border rounded transition-colors ${
                        conflict 
                          ? 'bg-red-600 border-red-700 animate-pulse cursor-pointer'
                          : blocked 
                          ? 'bg-black border-black hover:bg-gray-900'
                          : (checkingOut || checkingIn || staying)
                          ? 'border-border hover:opacity-80 cursor-pointer'
                          : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'
                      }`}
                    >
                      {conflict ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-white text-xs font-bold text-center">⚠️ CONFLICT</div>
                        </div>
                      ) : blocked ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-white text-xs">Blocked</div>
                        </div>
                      ) : isExtension && checkingIn ? (
                        // Extension day - show as continuous booking
                        <div className={`h-full flex items-center justify-center relative ${getReservationColor(checkingIn.source, checkingIn.status)}`}>
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                          {checkingIn.source?.toLowerCase().includes('booking') && (
                            <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                              B.com
                            </span>
                          )}
                        </div>
                      ) : hasBothCheckOutAndIn ? (
                        <div className="flex flex-col h-full">
                          <div className={`flex-1 flex items-center justify-center text-[10px] border-b ${getReservationColor(checkingOut.source, checkingOut.status)}`}>
                            OUT
                          </div>
                          <div className={`flex-1 flex items-center justify-center text-[10px] relative ${getReservationColor(checkingIn.source, checkingIn.status)}`}>
                            IN
                            {checkingIn.source?.toLowerCase().includes('booking') && (
                              <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                                B.com
                              </span>
                            )}
                          </div>
                        </div>
                      ) : checkingOut ? (
                        <div className={`h-full flex items-center justify-center text-xs relative ${getReservationColor(checkingOut.source, checkingOut.status)}`}>
                          OUT
                          {checkingOut.source?.toLowerCase().includes('booking') && (
                            <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                              B.com
                            </span>
                          )}
                        </div>
                      ) : checkingIn ? (
                        <div className={`h-full flex items-center justify-center text-xs relative ${getReservationColor(checkingIn.source, checkingIn.status)}`}>
                          IN
                          {checkingIn.source?.toLowerCase().includes('booking') && (
                            <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                              B.com
                            </span>
                          )}
                        </div>
                      ) : staying ? (
                        <div className={`h-full flex items-center justify-center relative ${getReservationColor(staying.source, staying.status)}`}>
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                          {staying.source?.toLowerCase().includes('booking') && (
                            <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                              B.com
                            </span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {units.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No units found. Add units to see availability.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

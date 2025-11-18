import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
    const { data, error} = await supabase.from('blocked_dates').select('*');
    if (error) console.error('Error fetching blocked dates:', error);
    else setBlockedDates(data || []);
  };

  const getWeekDays = () => Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  const hasConflict = (date: Date, unitId: string) => {
    const conflictingReservations = reservations.filter(res => {
      if (res.unit_id !== unitId || res.status !== 'confirmed') return false;
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
    const allReservations = reservations.filter(reservation => {
      if (reservation.unit_id !== unitId) return false;
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      return date >= checkIn && date < checkOut;
    });

    const checkingOut = allReservations.find(reservation => {
      const checkOut = new Date(reservation.check_out_date);
      return isSameDay(date, checkOut);
    });

    const checkingIn = allReservations.find(reservation => {
      const checkIn = new Date(reservation.check_in_date);
      return isSameDay(date, checkIn);
    });

    const staying = allReservations.find(reservation => {
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      return date > checkIn && date < checkOut;
    });

    return { checkingOut, checkingIn, staying, allReservations };
  };

  const handleCellClick = (reservations: Reservation[]) => {
    if (reservations.length > 0) {
      navigate(`/reservation/${reservations[0].id}`);
    }
  };

  const getReservationColor = (source: string) => {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('admin') || lowerSource.includes('manager')) {
      return 'bg-green-500/80 text-white';
    }
    if (lowerSource.includes('booking')) {
      return 'bg-[#003580] text-white';
    }
    return 'bg-red-500/80 text-white';
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
          <TooltipProvider>
            <div className="min-w-max">
              <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `160px repeat(${weekDays.length}, 70px)` }}>
                <div className="font-medium text-sm p-2">Suite Name</div>
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
                      <div>{unit.name}</div>
                      <div className="text-xs text-muted-foreground">#{unit.unit_number}</div>
                    </div>
                  </div>
                  {weekDays.map((day, index) => {
                    const { checkingOut, checkingIn, staying, allReservations } = getReservationsForDate(day, unit.id);
                    const blocked = isDateBlocked(day, unit.id);
                    const conflict = hasConflict(day, unit.id);
                    const hasBothCheckOutAndIn = checkingOut && checkingIn;
                    
                    return (
                      <Tooltip key={index}>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-14 border rounded transition-colors ${
                              conflict 
                                ? 'bg-red-600 border-red-700 animate-pulse cursor-pointer'
                                : blocked 
                                ? 'bg-black border-black hover:bg-gray-900 cursor-pointer'
                                : (checkingOut || checkingIn || staying)
                                ? 'border-border hover:opacity-80 cursor-pointer'
                                : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40'
                            }`}
                            onClick={() => handleCellClick(allReservations)}
                          >
                            {conflict ? (
                              <div className="flex items-center justify-center h-full">
                                <AlertCircle className="h-4 w-4 text-white" />
                              </div>
                            ) : blocked ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-white text-xs">Blocked</div>
                              </div>
                            ) : hasBothCheckOutAndIn ? (
                              <div className="flex flex-col h-full">
                                <div className={`flex-1 flex items-center justify-center text-[10px] border-b ${getReservationColor(checkingOut.source)}`}>
                                  OUT
                                </div>
                                <div className={`flex-1 flex items-center justify-center text-[10px] ${getReservationColor(checkingIn.source)}`}>
                                  IN
                                </div>
                              </div>
                            ) : checkingOut ? (
                              <div className={`h-full flex items-center justify-center text-xs ${getReservationColor(checkingOut.source)}`}>
                                OUT
                              </div>
                            ) : checkingIn ? (
                              <div className={`h-full flex items-center justify-center text-xs ${getReservationColor(checkingIn.source)}`}>
                                IN
                              </div>
                            ) : staying ? (
                              <div className={`h-full flex items-center justify-center ${getReservationColor(staying.source)}`}>
                                <CheckCircle className="h-4 w-4 text-white" />
                              </div>
                            ) : null}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <div className="font-medium">{format(day, 'MMM d, yyyy')}</div>
                            {conflict ? (
                              <div className="text-red-500 font-semibold">
                                ⚠️ DOUBLE BOOKING CONFLICT!
                                <div className="mt-1">
                                  {allReservations.map((r, idx) => (
                                    <div key={idx} className="text-xs">
                                      • {r.guest_names[0]}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : blocked ? (
                              <div className="text-yellow-500">Blocked</div>
                            ) : (checkingOut || checkingIn || staying) ? (
                              <div>
                                <div className="text-blue-600 dark:text-blue-400">
                                  {checkingOut && checkingIn ? 'Check-out & Check-in' : checkingOut ? 'Check-out' : checkingIn ? 'Check-in' : 'Occupied'}
                                </div>
                                {allReservations.map((r, idx) => (
                                  <div key={idx} className="text-xs mt-1">
                                    {r.guest_names[0]}
                                    <br />
                                    {r.source}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-green-600 dark:text-green-400">Available</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </TooltipProvider>
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

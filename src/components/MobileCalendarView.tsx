import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, addDays } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";

interface Unit {
  id: string;
  name: string;
  unit_number: string;
}

interface Reservation {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  booking_reference: string;
  guest_names: string[];
  status: string;
  source: string;
  channel?: string;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  unit_id: string | null;
  reason: string | null;
}

interface DayData {
  date: Date;
  bookingCount: number;
  hasConflict: boolean;
  isBlocked: boolean;
  reservations: Reservation[];
}

export const MobileCalendarView = () => {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      triggerHaptic();
      setCurrentMonth(addMonths(currentMonth, 1));
    },
    onSwipedRight: () => {
      triggerHaptic();
      setCurrentMonth(addMonths(currentMonth, -1));
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('mobile-calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth]);

  const fetchData = async () => {
    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('status', 'available')
      .order('unit_number');
    if (unitsData) setUnits(unitsData);

    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(addMonths(currentMonth, 2)), 'yyyy-MM-dd');

    const { data: reservationsData } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'confirmed')
      .or(`and(check_in_date.lte.${endDate},check_out_date.gte.${startDate})`);
    if (reservationsData) setReservations(reservationsData);

    const { data: blockedData } = await supabase
      .from('blocked_dates')
      .select('*');
    if (blockedData) setBlockedDates(blockedData);
  };

  const getDayData = (date: Date): DayData => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const isBlocked = blockedDates.some(b => 
      isSameDay(new Date(b.blocked_date), date)
    );

    const dayReservations = reservations.filter(r => {
      const checkIn = new Date(r.check_in_date);
      const checkOut = new Date(r.check_out_date);
      const isCheckInDay = isSameDay(date, checkIn);
      const isStayingDay = date > checkIn && date < checkOut;
      return isCheckInDay || isStayingDay;
    });

    // Check for conflicts (multiple bookings on same unit)
    const bookingsByUnit = new Map<string, Reservation[]>();
    dayReservations.forEach(r => {
      if (!bookingsByUnit.has(r.unit_id)) {
        bookingsByUnit.set(r.unit_id, []);
      }
      bookingsByUnit.get(r.unit_id)!.push(r);
    });

    const hasConflict = Array.from(bookingsByUnit.values()).some(bookings => bookings.length > 1);

    return {
      date,
      bookingCount: dayReservations.length,
      hasConflict,
      isBlocked,
      reservations: dayReservations,
    };
  };

  const getCellClassName = (dayData: DayData, date: Date) => {
    const baseClasses = "min-h-16 p-1 flex flex-col items-start justify-start border border-border relative";
    const today = isSameDay(date, new Date());
    const isCurrentMonth = isSameMonth(date, currentMonth);

    if (!isCurrentMonth) {
      return `${baseClasses} bg-muted/30 text-muted-foreground`;
    }

    if (dayData.hasConflict) {
      return `${baseClasses} bg-destructive/20 border-destructive animate-pulse cursor-pointer`;
    }

    if (dayData.isBlocked) {
      return `${baseClasses} bg-muted text-muted-foreground cursor-default`;
    }

    if (dayData.bookingCount > 0) {
      const intensity = Math.min(dayData.bookingCount / units.length, 1);
      const pinkShade = intensity > 0.7 ? 'bg-pink-200 dark:bg-pink-900/40' : 
                        intensity > 0.4 ? 'bg-pink-100 dark:bg-pink-900/20' : 
                        'bg-pink-50 dark:bg-pink-900/10';
      return `${baseClasses} ${pinkShade} ${today ? 'ring-2 ring-warning' : ''} cursor-pointer`;
    }

    return `${baseClasses} bg-background ${today ? 'ring-2 ring-warning' : ''}`;
  };

  const handleDayClick = (dayData: DayData) => {
    if (dayData.bookingCount > 0 || dayData.hasConflict) {
      setSelectedDay(dayData);
      setSheetOpen(true);
    }
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div key={format(monthDate, 'yyyy-MM')} className="mb-6">
        <h3 className="text-lg font-semibold mb-3">{format(monthDate, 'MMMM yyyy')}</h3>
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="bg-muted p-2 text-center text-xs font-medium">
              {day}
            </div>
          ))}
          {days.map(date => {
            const dayData = getDayData(date);
            return (
              <div
                key={date.toISOString()}
                className={getCellClassName(dayData, date)}
                onClick={() => handleDayClick(dayData)}
              >
                <span className="text-xs font-medium">{format(date, 'd')}</span>
                {dayData.hasConflict && (
                  <AlertTriangle className="h-3 w-3 text-destructive absolute top-1 right-1" />
                )}
                {dayData.bookingCount > 0 && (
                  <span className="text-[10px] text-muted-foreground mt-auto">
                    {dayData.bookingCount} {dayData.bookingCount === 1 ? 'booking' : 'bookings'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getSourceColor = (reservation: Reservation) => {
    const source = reservation.channel || reservation.source || '';
    if (source.toLowerCase().includes('booking')) return 'bg-blue-500';
    if (source.toLowerCase().includes('airbnb')) return 'bg-pink-500';
    if (source.toLowerCase().includes('direct')) return 'bg-green-500';
    return 'bg-muted';
  };

  return (
    <div className="pb-6" {...swipeHandlers}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 py-3 border-b">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Render 3 months */}
      {[0, 1, 2].map(offset => renderMonth(addMonths(currentMonth, offset)))}

      {/* Day Details Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedDay && format(selectedDay.date, 'EEEE, MMMM d, yyyy')}
            </SheetTitle>
          </SheetHeader>
          {selectedDay && (
            <div className="mt-4 space-y-3">
              {selectedDay.hasConflict && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Double Booking Conflict Detected
                  </div>
                </div>
              )}
              
              {units.map(unit => {
                const unitReservations = selectedDay.reservations.filter(r => r.unit_id === unit.id);
                if (unitReservations.length === 0) return null;

                return (
                  <div key={unit.id} className="border rounded-lg p-3 space-y-2">
                    <div className="font-semibold text-sm">{unit.name}</div>
                    {unitReservations.map(reservation => {
                      const isCheckIn = isSameDay(selectedDay.date, new Date(reservation.check_in_date));
                      const isCheckOut = isSameDay(addDays(selectedDay.date, 1), new Date(reservation.check_out_date));
                      
                      return (
                        <div
                          key={reservation.id}
                          className="bg-muted/50 rounded p-2 space-y-1 cursor-pointer hover:bg-muted"
                          onClick={() => navigate(`/reservation/${reservation.id}`)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{reservation.guest_names[0]}</span>
                            <Badge className={`${getSourceColor(reservation)} text-white text-xs`}>
                              {reservation.channel || reservation.source}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isCheckIn && '✓ Check-in'}
                            {isCheckOut && '✓ Check-out'}
                            {!isCheckIn && !isCheckOut && 'Staying'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Ref: {reservation.booking_reference}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

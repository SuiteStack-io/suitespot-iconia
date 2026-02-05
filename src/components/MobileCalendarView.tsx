import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertTriangle, Building2, Hash } from "lucide-react";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, addDays } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { ReservationQuickActions } from "./ReservationQuickActions";

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  status?: string;
  booking_com_name?: string | null;
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
  group_id?: string | null;
  created_at: string;
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
  const [extensionReservationIds, setExtensionReservationIds] = useState<Set<string>>(new Set());
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [sortByRoomType, setSortByRoomType] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendarSortByRoomType');
    return saved === 'true';
  });
  const navigate = useNavigate();
  const todayRef = useRef<HTMLDivElement>(null);

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
  }, [currentMonth, sortByRoomType]);

  useEffect(() => {
    localStorage.setItem('calendarSortByRoomType', String(sortByRoomType));
  }, [sortByRoomType]);

  // Scroll to today's date on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchData = async () => {
    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('status', 'available');
    
    if (unitsData) {
      // Sort based on user preference
      const sortedUnits = unitsData.sort((a, b) => {
        if (sortByRoomType) {
          const nameA = (a.booking_com_name || a.name || '').toLowerCase();
          const nameB = (b.booking_com_name || b.name || '').toLowerCase();
          
          if (nameA !== nameB) {
            return nameA.localeCompare(nameB);
          }
        }
        return (a.unit_number || '').localeCompare(b.unit_number || '');
      });
      setUnits(sortedUnits);
    }

    const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(addMonths(currentMonth, 2)), 'yyyy-MM-dd');

      const { data: reservationsData } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
        .is('cancelled_at', null)
        .or(`and(check_in_date.lte.${endDate},check_out_date.gte.${startDate})`);
    if (reservationsData) {
      setReservations(reservationsData);
      
      // Detect extension reservations (same group_id, same unit, sequential dates)
      const groupedReservations = new Map<string, typeof reservationsData>();
      reservationsData.forEach(r => {
        if (r.group_id && r.unit_id) {
          const group = groupedReservations.get(r.group_id) || [];
          group.push(r);
          groupedReservations.set(r.group_id, group);
        }
      });

      const extensionIds = new Set<string>();
      groupedReservations.forEach((groupReservations) => {
        if (groupReservations.length > 1) {
          // Group by unit_id (only same-room bookings can be extensions)
          const byUnit = new Map<string, typeof groupReservations>();
          groupReservations.forEach(r => {
            if (r.unit_id) {
              const unitReservations = byUnit.get(r.unit_id) || [];
              unitReservations.push(r);
              byUnit.set(r.unit_id, unitReservations);
            }
          });
          
          // For each unit with multiple reservations, check for sequential dates
          byUnit.forEach((unitReservations) => {
            if (unitReservations.length > 1) {
              const sorted = [...unitReservations].sort(
                (a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()
              );
              
              for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1];
                const curr = sorted[i];
                if (new Date(prev.check_out_date).getTime() === new Date(curr.check_in_date).getTime()) {
                  extensionIds.add(curr.id);
                }
              }
            }
          });
        }
      });
      setExtensionReservationIds(extensionIds);
    }

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
      // For completed/checked-out reservations, also show on checkout day
      const isCheckoutDayForCompleted = 
        (r.status === 'completed' || r.status === 'checked-out') && 
        isSameDay(date, checkOut);
      return isCheckInDay || isStayingDay || isCheckoutDayForCompleted;
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
    const baseClasses = "min-h-16 p-1 flex flex-col items-start justify-start border border-border/50 relative bg-white dark:bg-card";
    const today = isSameDay(date, new Date());
    const isCurrentMonth = isSameMonth(date, currentMonth);
    const isSelected = selectedDay && isSameDay(date, selectedDay.date);

    if (!isCurrentMonth) {
      return `${baseClasses} !bg-muted/30 text-muted-foreground`;
    }

    if (dayData.hasConflict) {
      return `${baseClasses} !bg-destructive/20 !border-destructive animate-pulse cursor-pointer`;
    }

    if (dayData.isBlocked) {
      return `${baseClasses} !bg-muted text-muted-foreground cursor-default`;
    }

    // Only show pink/red background when ALL rooms are sold out
    const allRoomsSoldOut = dayData.bookingCount >= units.length;
    
    if (allRoomsSoldOut) {
      const todayBorder = today ? '!ring-2 !ring-[#0066CC] !ring-inset' : '';
      const selectedBg = isSelected ? '!bg-yellow-200 dark:!bg-yellow-900/40' : '';
      return `${baseClasses} ${selectedBg || '!bg-[#FFB3BA] dark:!bg-pink-900/40'} ${todayBorder} cursor-pointer`;
    }

    const todayBorder = today ? '!ring-2 !ring-[#0066CC] !ring-inset' : '';
    const selectedBg = isSelected ? '!bg-yellow-200 dark:!bg-yellow-900/40' : '';
    return `${baseClasses} ${selectedBg} ${todayBorder}`;
  };

  const handleDayClick = (dayData: DayData) => {
    if (dayData.bookingCount > 0 || dayData.hasConflict) {
      setSelectedDay(dayData);
      setSheetOpen(true);
    }
  };

  const handleReservationClick = (reservation: Reservation, unit: Unit) => {
    setSelectedReservation(reservation);
    setSelectedUnit(unit);
    setQuickActionsOpen(true);
  };

  const handleMoveComplete = () => {
    fetchData();
    setSheetOpen(false);
  };

  const renderMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Group days into weeks for continuous ribbon rendering
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div key={format(monthDate, 'yyyy-MM')} className="mb-6 bg-muted/30 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">{format(monthDate, 'MMMM yyyy')}</h3>
        <div className="border border-border/50 rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium border-b border-border/50">
                {day}
              </div>
            ))}
          </div>
          
          {/* Week rows */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 relative">
              {week.map((date, dayIndex) => {
                const dayData = getDayData(date);
                const isCurrentMonth = isSameMonth(date, monthDate);
                const today = isSameDay(date, new Date());
                const isSelected = selectedDay && isSameDay(date, selectedDay.date);
                
                // Check if this is part of a consecutive booking sequence
                const prevDay = dayIndex > 0 ? week[dayIndex - 1] : null;
                const nextDay = dayIndex < 6 ? week[dayIndex + 1] : null;
                const prevDayData = prevDay ? getDayData(prevDay) : null;
                const nextDayData = nextDay ? getDayData(nextDay) : null;
                
                const hasBooking = dayData.bookingCount > 0;
                const prevHasBooking = prevDayData && prevDayData.bookingCount > 0;
                const nextHasBooking = nextDayData && nextDayData.bookingCount > 0;
                
                const isStartOfSequence = hasBooking && !prevHasBooking;
                const isEndOfSequence = hasBooking && !nextHasBooking;
                const isMiddleOfSequence = hasBooking && prevHasBooking && nextHasBooking;
                const isSingleDay = hasBooking && !prevHasBooking && !nextHasBooking;

                // Calculate available rooms
                const availableRooms = units.length - dayData.bookingCount;
                const hasPartialAvailability = dayData.bookingCount > 0 && dayData.bookingCount < units.length;

                return (
                  <div
                    key={date.toISOString()}
                    ref={today ? todayRef : null}
                    className={getCellClassName(dayData, date)}
                    onClick={() => handleDayClick(dayData)}
                  >
                    <span className="text-sm font-medium relative z-10">{format(date, 'd')}</span>
                    {dayData.hasConflict && (
                      <AlertTriangle className="h-3 w-3 text-destructive absolute top-1 right-1 z-10" />
                    )}
                    
                    {/* Available rooms indicator for partial availability */}
                    {hasPartialAvailability && isCurrentMonth && (
                      <span className="absolute bottom-6 right-1 text-[9px] font-semibold bg-green-500 text-white px-1.5 py-0.5 rounded-full z-10">
                        {availableRooms} left
                      </span>
                    )}
                    
                    {/* Blue ribbon for bookings */}
                    {hasBooking && isCurrentMonth && (
                      <div 
                        className={`absolute bottom-0 left-0 right-0 h-5 bg-[#0066CC] flex items-center justify-center z-0
                          ${isStartOfSequence || isSingleDay ? 'rounded-l' : ''}
                          ${isEndOfSequence || isSingleDay ? 'rounded-r' : ''}
                        `}
                      >
                        <span className="text-[9px] font-semibold text-white px-1">
                          {dayData.bookingCount} bo...
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getSourceColor = (reservation: Reservation) => {
    const source = reservation.channel || reservation.source || '';
    const isDimmed = reservation.status === 'completed' || reservation.status === 'checked-out';
    const opacity = isDimmed ? 'opacity-50' : '';
    
    if (source.toLowerCase().includes('booking')) return `bg-blue-500 ${opacity}`;
    if (source.toLowerCase().includes('airbnb')) return `bg-pink-500 ${opacity}`;
    if (source.toLowerCase().includes('direct')) return `bg-green-500 ${opacity}`;
    return `bg-muted ${opacity}`;
  };

  return (
    <div className="pb-6" {...swipeHandlers}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 py-3 border-b">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button 
            variant={sortByRoomType ? "default" : "outline"}
            size="sm" 
            onClick={() => setSortByRoomType(!sortByRoomType)}
            title={sortByRoomType ? "Sorted by room type" : "Sorted by room number"}
          >
            {sortByRoomType ? <Building2 className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
          </Button>
        </div>
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
              
              {units.map((unit, index) => {
                const unitReservations = selectedDay.reservations.filter(r => r.unit_id === unit.id);
                if (unitReservations.length === 0) return null;

                const currentRoomType = unit.booking_com_name || unit.name;
                const previousUnit = index > 0 ? units[index - 1] : null;
                const previousRoomType = previousUnit ? (previousUnit.booking_com_name || previousUnit.name) : null;
                const showSeparator = sortByRoomType && (index === 0 || currentRoomType !== previousRoomType);
                const roomTypeCount = units.filter(u => (u.booking_com_name || u.name) === currentRoomType).length;

                return (
                  <div key={unit.id}>
                    {showSeparator && (
                      <div className="flex items-center gap-2 py-2 px-2 bg-muted/50 border-y border-border mb-2 -mx-4">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-muted-foreground">
                          {currentRoomType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({roomTypeCount} {roomTypeCount === 1 ? 'room' : 'rooms'})
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    <div className="border rounded-lg p-3 space-y-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="font-semibold text-sm text-primary hover:underline cursor-pointer w-fit">
                          {unit.booking_com_name || unit.name}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" align="start" className="w-auto p-3">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Room Name: </span>
                          <span className="font-medium">{unit.name}</span>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {unitReservations.map(reservation => {
                      const isCheckIn = isSameDay(selectedDay.date, new Date(reservation.check_in_date));
                      const isCheckOut = isSameDay(addDays(selectedDay.date, 1), new Date(reservation.check_out_date));
                      
                      return (
                        <div
                          key={reservation.id}
                          className={`bg-muted/50 rounded p-2 space-y-1 cursor-pointer hover:bg-muted ${reservation.status === 'completed' || reservation.status === 'checked-out' ? 'opacity-60' : ''}`}
                          onClick={() => handleReservationClick(reservation, unit)}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{reservation.guest_names[0]}</span>
                            {extensionReservationIds.has(reservation.id) && (
                              <Badge className="bg-purple-500 text-white text-xs">
                                EXT
                              </Badge>
                            )}
                            {(reservation.status === 'completed' || reservation.status === 'checked-out') && (
                              <Badge variant="secondary" className="text-xs">
                                {reservation.status.replace('-', ' ')}
                              </Badge>
                            )}
                            <Badge className={`${getSourceColor(reservation)} text-black text-xs`}>
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
                  </div>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ReservationQuickActions
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        reservation={selectedReservation}
        currentUnit={selectedUnit}
        onMoveComplete={handleMoveComplete}
      />
    </div>
  );
};

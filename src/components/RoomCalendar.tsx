import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, addMonths } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertTriangle, Building2, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { ReservationQuickActions } from './ReservationQuickActions';

interface Unit {
  id: string;
  unit_number: string;
  name: string;
  unit_type: string;
  status?: string;
  booking_com_name?: string | null;
}

interface Reservation {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_names: string[];
  status: string;
  booking_reference: string;
  source: string;
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
  availableRooms: number;
  isSoldOut: boolean;
  hasConflict: boolean;
  reservations: Reservation[];
}

export const RoomCalendar = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedLocation, setSelectedLocation] = useState<'ICONIA' | 'Almaza Bay'>('ICONIA');
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [iconiaCount, setIconiaCount] = useState(0);
  const [almazaBayCount, setAlmazaBayCount] = useState(0);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [sortByRoomType, setSortByRoomType] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendarSortByRoomType');
    return saved === 'true';
  });

  useEffect(() => {
    fetchUnitCounts();
    fetchUnits();
    fetchReservations();
    fetchBlockedDates();

    const channel = supabase
      .channel('room-calendar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => fetchReservations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_dates' }, () => fetchBlockedDates())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => {
        fetchUnits();
        fetchUnitCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedLocation, sortByRoomType]);

  useEffect(() => {
    localStorage.setItem('calendarSortByRoomType', String(sortByRoomType));
  }, [sortByRoomType]);

  const fetchUnitCounts = async () => {
    // Fetch ICONIA count
    const { count: iconiaTotal } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('location', 'ICONIA')
      .eq('status', 'available');
    
    // Fetch Almaza Bay count
    const { count: almazaTotal } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('location', 'Almaza Bay')
      .eq('status', 'available');
    
    setIconiaCount(iconiaTotal || 0);
    setAlmazaBayCount(almazaTotal || 0);
  };

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('id, unit_number, name, unit_type, booking_com_name')
      .eq('location', selectedLocation)
      .eq('status', 'available');
    
    if (error) {
      console.error('Error fetching units:', error);
      return;
    }
    
    // Sort based on user preference
    const sortedUnits = (data || []).sort((a, b) => {
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
  };

  const fetchReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .in('status', ['confirmed', 'checked-in', 'checked-out']);
    
    if (error) {
      console.error('Error fetching reservations:', error);
      return;
    }
    setReservations(data || []);
  };

  const fetchBlockedDates = async () => {
    const { data, error } = await supabase.from('blocked_dates').select('*');
    if (error) console.error('Error fetching blocked dates:', error);
    else setBlockedDates(data || []);
  };

  const getWeekDays = () => Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  const hasConflict = (date: Date, unitId: string) => {
    // Only check if the unit is in the current location
    const unitInCurrentLocation = units.some(u => u.id === unitId);
    if (!unitInCurrentLocation) return false;
    
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

    return { checkingOut, checkingIn, staying };
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

  const renderGuestName = (guestName: string) => {
    const nameParts = guestName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    
    return (
      <>
        <span className="text-[10px] text-white font-medium text-center leading-tight block">
          {firstName}
        </span>
        {lastName && (
          <span className="text-[10px] text-white font-medium text-center leading-tight block">
            {lastName}
          </span>
        )}
      </>
    );
  };

  const navigatePreviousWeek = () => setCurrentWeekStart(prev => addDays(prev, -7));
  const navigateNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7));
  const goToCurrentWeek = () => setCurrentWeekStart(startOfDay(new Date()));

  const navigatePreviousMonth = () => setCurrentMonth(prev => addMonths(prev, -1));
  const navigateNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToCurrentMonth = () => setCurrentMonth(startOfMonth(new Date()));

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
    fetchReservations();
    setSheetOpen(false);
  };

  const getSourceColor = (reservation: Reservation) => {
    const source = reservation.source || '';
    if (source.toLowerCase().includes('booking')) return 'bg-blue-500';
    if (source.toLowerCase().includes('airbnb')) return 'bg-pink-500';
    if (source.toLowerCase().includes('direct')) return 'bg-green-500';
    return 'bg-muted';
  };

  const getDayData = (date: Date): DayData => {
    const dayReservations = reservations.filter(r => {
      // Only include reservations for units in the current location
      const unitInCurrentLocation = units.some(u => u.id === r.unit_id);
      if (!unitInCurrentLocation) return false;
      
      const checkIn = new Date(r.check_in_date);
      const checkOut = new Date(r.check_out_date);
      const isCheckInDay = isSameDay(date, checkIn);
      const isStayingDay = date > checkIn && date < checkOut;
      return isCheckInDay || isStayingDay;
    });

    const bookingsByUnit = new Map<string, Reservation[]>();
    dayReservations.forEach(r => {
      if (!bookingsByUnit.has(r.unit_id)) {
        bookingsByUnit.set(r.unit_id, []);
      }
      bookingsByUnit.get(r.unit_id)!.push(r);
    });

    const hasConflict = Array.from(bookingsByUnit.values()).some(bookings => bookings.length > 1);
    const bookingCount = dayReservations.length;
    const availableRooms = units.length - bookingCount;
    const isSoldOut = bookingCount >= units.length;

    return {
      date,
      bookingCount,
      availableRooms,
      isSoldOut,
      hasConflict,
      reservations: dayReservations,
    };
  };

  const weekDays = getWeekDays();
  const isCurrentWeek = isSameDay(currentWeekStart, startOfDay(new Date()));
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // Desktop Monthly Calendar View
  const renderMonthlyCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div>
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-sm font-semibold p-2 border-b">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((date, dayIndex) => {
              const dayData = getDayData(date);
              const isCurrentMonthDay = isSameMonth(date, currentMonth);
              const isToday = isSameDay(date, new Date());
              
              return (
                <div
                  key={dayIndex}
                  className={`min-h-[120px] border rounded-lg p-2 relative ${
                    !isCurrentMonthDay 
                      ? 'bg-muted/30 text-muted-foreground' 
                      : dayData.isSoldOut 
                      ? 'bg-[#FFB3BA] dark:bg-pink-900/40'
                      : 'bg-white dark:bg-card'
                  } ${isToday ? 'ring-2 ring-[#0066CC]' : ''} ${
                    dayData.bookingCount > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                  }`}
                  onClick={() => handleDayClick(dayData)}
                >
                  {/* Day number */}
                  <div className="text-sm font-semibold mb-1">{format(date, 'd')}</div>
                  
                  {/* Availability badge */}
                  {isCurrentMonthDay && dayData.bookingCount > 0 && dayData.bookingCount < units.length && (
                    <div className="text-xs text-center mb-1">
                      {dayData.availableRooms} left to sell
                    </div>
                  )}

                  {/* Blue booking ribbon */}
                  {isCurrentMonthDay && dayData.bookingCount > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#0066CC] text-white text-center py-1 rounded-b-lg">
                      <div className="text-xs font-semibold">
                        {dayData.bookingCount} booking{dayData.bookingCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className={isMobile ? "hidden" : ""}>Room Calendar</CardTitle>
            {!isMobile && (
              <Tabs value={selectedLocation} onValueChange={(value) => setSelectedLocation(value as 'ICONIA' | 'Almaza Bay')}>
                <TabsList>
                  <TabsTrigger value="ICONIA">
                    ICONIA <span className="ml-1.5 text-xs opacity-70">({iconiaCount})</span>
                  </TabsTrigger>
                  <TabsTrigger value="Almaza Bay">
                    Almaza Bay <span className="ml-1.5 text-xs opacity-70">({almazaBayCount})</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
          
          {isMobile && (
            <Tabs value={selectedLocation} onValueChange={(value) => setSelectedLocation(value as 'ICONIA' | 'Almaza Bay')} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="ICONIA" className="text-xs sm:text-sm">
                  ICONIA <span className="ml-1 opacity-70">({iconiaCount})</span>
                </TabsTrigger>
                <TabsTrigger value="Almaza Bay" className="text-xs sm:text-sm">
                  Almaza Bay <span className="ml-1 opacity-70">({almazaBayCount})</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          
          <div className={`flex items-center ${isMobile ? 'gap-1.5 w-full justify-between' : 'gap-2'}`}>
            {!isMobile ? (
              <>
                {!isCurrentMonth && (
                  <Button variant="outline" size="sm" onClick={goToCurrentMonth}>Today</Button>
                )}
                <Button variant="outline" size="sm" onClick={navigatePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium text-center min-w-[200px]">
                  {format(currentMonth, 'MMMM yyyy')}
                </div>
                <Button variant="outline" size="sm" onClick={navigateNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                {!isCurrentWeek && (
                  <Button variant="outline" size="sm" onClick={goToCurrentWeek}>Today</Button>
                )}
                <Button variant="outline" size="sm" onClick={navigatePreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium text-center flex-1">
                  {format(weekDays[0], 'MMM d')} - {format(weekDays[13], 'MMM d, yyyy')}
                </div>
                <Button variant="outline" size="sm" onClick={navigateNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isMobile ? (
          // Desktop: Monthly Calendar Grid
          renderMonthlyCalendar()
        ) : (
          // Mobile: 2-week Timeline View
          <>
            <div className="flex gap-4 mb-4 text-xs flex-wrap items-center justify-between">
              <div className="flex gap-4 flex-wrap">
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
              <Button 
                variant={sortByRoomType ? "default" : "outline"}
                size="sm" 
                onClick={() => setSortByRoomType(!sortByRoomType)}
                title={sortByRoomType ? "Sorted by room type" : "Sorted by room number"}
              >
                {sortByRoomType ? (
                  <>
                    <Building2 className="h-4 w-4 mr-1" />
                    By Type
                  </>
                ) : (
                  <>
                    <Hash className="h-4 w-4 mr-1" />
                    By Number
                  </>
                )}
              </Button>
            </div>

            <div className="overflow-x-auto">
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
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="flex items-center text-sm font-medium p-2 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors">
                          <div>
                            <div className="text-primary hover:underline">{unit.booking_com_name || unit.name}</div>
                            <div className="text-xs text-muted-foreground">#{unit.unit_number}</div>
                          </div>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" align="start" className="w-auto p-3">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Suite Name: </span>
                          <span className="font-medium">{unit.name}</span>
                        </div>
                      </PopoverContent>
                    </Popover>
                    {weekDays.map((day, index) => {
                      const { checkingOut, checkingIn, staying } = getReservationsForDate(day, unit.id);
                      const blocked = isDateBlocked(day, unit.id);
                      const conflict = hasConflict(day, unit.id);
                      const hasBothCheckOutAndIn = checkingOut && checkingIn;
                      
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
                            <div className={`h-full flex flex-col items-center justify-center ${getReservationColor(checkingIn.source)} px-1`}>
                              {renderGuestName(checkingIn.guest_names[0])}
                            </div>
                          ) : staying ? (
                            <div className={`h-full flex flex-col items-center justify-center ${getReservationColor(staying.source)} px-1`}>
                              {renderGuestName(staying.guest_names[0])}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {units.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No units found. Add units to see availability.
          </div>
        )}
      </CardContent>

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
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="font-semibold text-sm text-primary hover:underline cursor-pointer w-fit">
                          {unit.booking_com_name || unit.name}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" align="start" className="w-auto p-3">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Suite Name: </span>
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
                          className="bg-muted/50 rounded p-2 space-y-1 cursor-pointer hover:bg-muted"
                          onClick={() => handleReservationClick(reservation, { ...unit, status: 'available' })}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{reservation.guest_names[0]}</span>
                            <Badge className={`${getSourceColor(reservation)} text-black text-xs`}>
                              {reservation.source}
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

      <ReservationQuickActions
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        reservation={selectedReservation}
        currentUnit={selectedUnit}
        onMoveComplete={handleMoveComplete}
      />
    </Card>
  );
};

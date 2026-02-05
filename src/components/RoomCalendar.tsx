import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, startOfDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, addMonths, isLastDayOfMonth, isFirstDayOfMonth, isBefore } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { ChevronLeft, ChevronRight, AlertTriangle, Building2, Hash, ArrowRight, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  availableUnits: Unit[];
  blockedUnits: { unit: Unit; reason: string | null }[];
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
    return saved === null ? true : saved === 'true';
  });
  const [roomNameFilter, setRoomNameFilter] = useState('');
  const [roomNumberFilter, setRoomNumberFilter] = useState('');

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
      .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
      .is('cancelled_at', null);
    
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
      const checkIn = startOfDay(new Date(res.check_in_date));
      const checkOut = startOfDay(new Date(res.check_out_date));
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
      const checkOut = startOfDay(new Date(reservation.check_out_date));
      return isSameDay(date, checkOut);
    });

    const checkingIn = reservations.find(reservation => {
      if (reservation.unit_id !== unitId) return false;
      const checkIn = startOfDay(new Date(reservation.check_in_date));
      return isSameDay(date, checkIn);
    });

    const staying = reservations.find(reservation => {
      if (reservation.unit_id !== unitId) return false;
      const checkIn = startOfDay(new Date(reservation.check_in_date));
      const checkOut = startOfDay(new Date(reservation.check_out_date));
      return date > checkIn && date < checkOut;
    });

    // Check if checkingOut and checkingIn are part of the same extension
    // (one has -EXT suffix of the other's booking reference)
    const isExtension = checkingOut && checkingIn && 
      checkingOut.unit_id === checkingIn.unit_id &&
      (
        checkingIn.booking_reference === `${checkingOut.booking_reference}-EXT` ||
        (checkingIn.booking_reference.includes('-EXT') && 
          checkingIn.booking_reference.replace('-EXT', '') === checkingOut.booking_reference)
      );

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
    // Allow clicking any day to see available/blocked/booked rooms
    setSelectedDay(dayData);
    setSheetOpen(true);
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
    const isDimmed = reservation.status === 'completed' || reservation.status === 'checked-out';
    const opacity = isDimmed ? 'opacity-50' : '';
    
    if (source.toLowerCase().includes('booking')) return `bg-blue-500 ${opacity}`;
    if (source.toLowerCase().includes('airbnb')) return `bg-pink-500 ${opacity}`;
    if (source.toLowerCase().includes('direct')) return `bg-green-500 ${opacity}`;
    return `bg-muted ${opacity}`;
  };

  // Filter units based on room name and room number
  const filteredUnits = units.filter(unit => {
    const roomName = unit.booking_com_name || unit.name || '';
    const roomNumber = unit.unit_number || '';
    const nameMatch = roomNameFilter === '' || roomNameFilter === 'all' || roomName === roomNameFilter;
    const numberMatch = roomNumberFilter === '' || roomNumberFilter === 'all' || roomNumber === roomNumberFilter;
    return nameMatch && numberMatch;
  });

  // Get rooms filtered by room type for the room number dropdown
  const roomsForNumberFilter = roomNameFilter === '' || roomNameFilter === 'all'
    ? units
    : units.filter(u => (u.booking_com_name || u.name || '') === roomNameFilter);

  const getDayData = (date: Date): DayData => {
    const dayReservations = reservations.filter(r => {
      // Only include reservations for units in the filtered list
      const unitInFilteredList = filteredUnits.some(u => u.id === r.unit_id);
      if (!unitInFilteredList) return false;
      
      const checkIn = startOfDay(new Date(r.check_in_date));
      const checkOut = startOfDay(new Date(r.check_out_date));
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

    // Get blocked unit IDs for this date
    const blockedUnitIds = blockedDates
      .filter(bd => isSameDay(new Date(bd.blocked_date), date))
      .map(bd => bd.unit_id);
    
    // Get blocked units with reasons
    const blockedUnitsForDay = filteredUnits
      .filter(u => blockedUnitIds.includes(u.id))
      .map(u => ({
        unit: u,
        reason: blockedDates.find(bd => bd.unit_id === u.id && isSameDay(new Date(bd.blocked_date), date))?.reason || null
      }));
    
    // Get booked unit IDs
    const bookedUnitIds = dayReservations.map(r => r.unit_id);
    
    // Get available units (not booked AND not blocked)
    const availableUnitsForDay = filteredUnits.filter(u => 
      !bookedUnitIds.includes(u.id) && !blockedUnitIds.includes(u.id)
    );
    
    // Correct calculation: available = total - booked - blocked
    const availableRooms = availableUnitsForDay.length;
    const isSoldOut = availableRooms === 0;

    return {
      date,
      bookingCount,
      availableRooms,
      isSoldOut,
      hasConflict,
      reservations: dayReservations,
      availableUnits: availableUnitsForDay,
      blockedUnits: blockedUnitsForDay,
    };
  };

  const weekDays = getWeekDays();
  const isCurrentWeek = isSameDay(currentWeekStart, startOfDay(new Date()));
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  // Helper to get cross-month bookings with details
  const getCrossMonthBookings = (date: Date, monthDate: Date) => {
    const nextMonthStart = addMonths(startOfMonth(monthDate), 1);
    const prevMonthEnd = addDays(startOfMonth(monthDate), -1);
    
    // Get bookings that continue to next month
    const bookingsContinuingNext = reservations.filter(r => {
      const unitInFilteredList = filteredUnits.some(u => u.id === r.unit_id);
      if (!unitInFilteredList) return false;
      
      const checkIn = startOfDay(new Date(r.check_in_date));
      const checkOut = startOfDay(new Date(r.check_out_date));
      const isActiveOnDate = date >= checkIn && date < checkOut;
      const extendsIntoNextMonth = checkOut > nextMonthStart;
      
      return isActiveOnDate && extendsIntoNextMonth && isSameMonth(date, monthDate);
    });
    
    // Get bookings that started in previous month
    const bookingsFromPrev = reservations.filter(r => {
      const unitInFilteredList = filteredUnits.some(u => u.id === r.unit_id);
      if (!unitInFilteredList) return false;
      
      const checkIn = startOfDay(new Date(r.check_in_date));
      const checkOut = startOfDay(new Date(r.check_out_date));
      const isActiveOnDate = date >= checkIn && date < checkOut;
      const startedPrevMonth = checkIn <= prevMonthEnd;
      
      return isActiveOnDate && startedPrevMonth && isSameMonth(date, monthDate);
    });
    
    return { 
      continuesNext: bookingsContinuingNext.length > 0,
      continuesFromPrev: bookingsFromPrev.length > 0,
      bookingsContinuingNext,
      bookingsFromPrev
    };
  };

  // Desktop Monthly Calendar View - renders a specific month
  const renderMonthlyCalendar = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="mb-8">
        {/* Month Header */}
        <h3 className="text-lg font-semibold mb-4 text-center border-b pb-2">
          {format(monthDate, 'MMMM yyyy')}
        </h3>
        
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
              const isCurrentMonthDay = isSameMonth(date, monthDate);
              const isToday = isSameDay(date, new Date());
              const isPast = isBefore(date, startOfDay(new Date()));
              const crossMonth = getCrossMonthBookings(date, monthDate);
              const isMonthEnd = isLastDayOfMonth(date);
              const isMonthStart = isFirstDayOfMonth(date);
              
              return (
                <div
                  key={dayIndex}
                  className={`min-h-[120px] border rounded-lg p-2 relative ${
                    !isCurrentMonthDay 
                      ? 'bg-muted/30 text-muted-foreground' 
                      : dayData.isSoldOut 
                        ? 'bg-[#FFB3BA] dark:bg-pink-900/40'
                        : isPast
                          ? 'bg-gray-100 dark:bg-gray-800/50'
                          : 'bg-white dark:bg-card'
                  } ${isToday ? 'ring-2 ring-[#0066CC]' : ''} ${
                    dayData.bookingCount > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
                  }`}
                  onClick={() => handleDayClick(dayData)}
                >
                  {/* Day number */}
                  <div className="text-sm font-semibold mb-1 relative z-10">{format(date, 'd')}</div>
                  
                  {/* Cross-month continuation indicator - from previous month */}
                  {isCurrentMonthDay && isMonthStart && crossMonth.continuesFromPrev && dayData.bookingCount > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute top-1 right-1 cursor-help">
                            <div className="flex items-center gap-0.5 bg-amber-500 text-white text-[9px] px-1 py-0.5 rounded">
                              <ArrowLeft className="h-2.5 w-2.5" />
                              <span>cont.</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px]">
                          <div className="text-xs">
                            <p className="font-semibold mb-1">Continuing from previous month:</p>
                            {crossMonth.bookingsFromPrev.map((r, i) => (
                              <div key={r.id} className={i > 0 ? 'mt-1 pt-1 border-t' : ''}>
                                <p className="font-medium">{r.guest_names[0]}</p>
                                <p className="text-muted-foreground">
                                  {format(new Date(r.check_in_date), 'MMM d')} → {format(new Date(r.check_out_date), 'MMM d')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  {/* Sold Out text - centered in cell */}
                  {isCurrentMonthDay && dayData.isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-sm font-bold text-red-700/80">Sold Out</span>
                    </div>
                  )}

                  {/* Availability badge - show when some rooms unavailable but not sold out */}
                  {isCurrentMonthDay && !dayData.isSoldOut && dayData.availableRooms < filteredUnits.length && dayData.availableRooms > 0 && (
                    <div className="text-xs text-center mb-1">
                      {dayData.availableRooms} left to sell
                    </div>
                  )}

                  {/* Green ribbon - all rooms available (no bookings, no blocked) */}
                  {isCurrentMonthDay && dayData.bookingCount === 0 && dayData.availableRooms === filteredUnits.length && filteredUnits.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-green-600/90 text-white text-center py-1 rounded-b-lg">
                      <span className="text-xs font-medium">{filteredUnits.length} room{filteredUnits.length !== 1 ? 's' : ''} available</span>
                    </div>
                  )}

                  {/* Amber ribbon - partial availability (some blocked but no bookings) */}
                  {isCurrentMonthDay && dayData.bookingCount === 0 && dayData.availableRooms > 0 && dayData.availableRooms < filteredUnits.length && (
                    <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-white text-center py-1 rounded-b-lg">
                      <span className="text-xs font-medium">{dayData.availableRooms} available</span>
                    </div>
                  )}

                  {/* Blue booking ribbon with cross-month indicator */}
                  {isCurrentMonthDay && dayData.bookingCount > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-[#0066CC] text-white text-center py-1 rounded-b-lg">
                      <div className="flex items-center justify-center gap-1 text-xs font-semibold">
                        {/* Arrow from previous month */}
                        {crossMonth.continuesFromPrev && !isMonthStart && (
                          <ArrowLeft className="h-3 w-3 text-amber-300" />
                        )}
                        <span>{dayData.bookingCount} booking{dayData.bookingCount > 1 ? 's' : ''}</span>
                        {/* Arrow to next month with tooltip */}
                        {crossMonth.continuesNext && isMonthEnd && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <ArrowRight className="h-3 w-3 text-amber-300 animate-pulse cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[250px]">
                                <div className="text-xs">
                                  <p className="font-semibold mb-1">Continues to next month:</p>
                                  {crossMonth.bookingsContinuingNext.map((r, i) => (
                                    <div key={r.id} className={i > 0 ? 'mt-1 pt-1 border-t' : ''}>
                                      <p className="font-medium">{r.guest_names[0]}</p>
                                      <p className="text-muted-foreground">
                                        {format(new Date(r.check_in_date), 'MMM d')} → {format(new Date(r.check_out_date), 'MMM d')}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Connector line indicator at month boundary */}
                  {isCurrentMonthDay && isMonthEnd && crossMonth.continuesNext && dayData.bookingCount > 0 && (
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-10">
                      <div className="w-0.5 h-4 bg-amber-500" />
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

  // Render two consecutive months stacked vertically
  const renderTwoMonthsCalendar = () => {
    const firstMonth = currentMonth;
    const secondMonth = addMonths(currentMonth, 1);
    
    return (
      <div className="space-y-2">
        {renderMonthlyCalendar(firstMonth)}
        {renderMonthlyCalendar(secondMonth)}
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
                <div className="text-sm font-medium text-center min-w-[280px]">
                  {format(currentMonth, 'MMMM yyyy')} - {format(addMonths(currentMonth, 1), 'MMMM yyyy')}
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

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select 
              value={roomNameFilter} 
              onValueChange={(value) => {
                setRoomNameFilter(value);
                // Reset room number filter if current selection is no longer valid
                if (roomNumberFilter && roomNumberFilter !== 'all') {
                  const matchingUnits = value === 'all' 
                    ? units 
                    : units.filter(u => (u.booking_com_name || u.name || '') === value);
                  const validNumbers = matchingUnits.map(u => u.unit_number);
                  if (!validNumbers.includes(roomNumberFilter)) {
                    setRoomNumberFilter('all');
                  }
                }
              }}
            >
              <SelectTrigger className="w-[200px] h-9 bg-background">
                <SelectValue placeholder="All Room Types" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Room Types</SelectItem>
                {[...new Set(units.map(u => u.booking_com_name || u.name))].sort().map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roomNumberFilter} onValueChange={setRoomNumberFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-background">
                <SelectValue placeholder="All Rooms" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Rooms</SelectItem>
                {[...new Set(roomsForNumberFilter.map(u => u.unit_number))].filter(Boolean).sort().map(num => (
                  <SelectItem key={num} value={num!}>#{num}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(roomNameFilter !== 'all' || roomNumberFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRoomNameFilter('all');
                  setRoomNumberFilter('all');
                }}
                className="h-9 px-3 text-muted-foreground hover:text-foreground"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isMobile ? (
          // Desktop: Two months stacked vertically
          renderTwoMonthsCalendar()
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

                {filteredUnits.map((unit, index) => {
                  const currentRoomType = unit.booking_com_name || unit.name;
                  const previousUnit = index > 0 ? filteredUnits[index - 1] : null;
                  const previousRoomType = previousUnit ? (previousUnit.booking_com_name || previousUnit.name) : null;
                  const showSeparator = sortByRoomType && (index === 0 || currentRoomType !== previousRoomType);
                  const roomTypeCount = filteredUnits.filter(u => (u.booking_com_name || u.name) === currentRoomType).length;

                  return (
                    <div key={unit.id}>
                      {showSeparator && (
                        <div 
                          className="flex items-center gap-2 py-2 px-2 bg-muted/50 border-y border-border mb-1 rounded"
                        >
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
                      <div
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
                          <span className="text-muted-foreground">Room Name: </span>
                          <span className="font-medium">{unit.name}</span>
                        </div>
                      </PopoverContent>
                    </Popover>
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
                            // Extension day - show as continuous booking (same as "staying")
                            <div className={`h-full flex flex-col items-center justify-center ${getReservationColor(checkingIn.source, checkingIn.status)} px-1`}>
                              {renderGuestName(checkingIn.guest_names[0])}
                            </div>
                          ) : hasBothCheckOutAndIn ? (
                            <div className="flex flex-col h-full">
                              <div className={`flex-1 flex items-center justify-center text-[10px] border-b ${getReservationColor(checkingOut.source, checkingOut.status)}`}>
                                OUT
                              </div>
                              <div className={`flex-1 flex items-center justify-center text-[10px] ${getReservationColor(checkingIn.source, checkingIn.status)}`}>
                                IN
                              </div>
                            </div>
                          ) : checkingOut ? (
                            /* Checkout-only - available for same-day turnover */
                            <div className="h-full flex flex-col overflow-hidden rounded">
                              {/* Top half - departing guest with reservation color */}
                              <div className={`flex-1 flex items-center justify-center ${getReservationColor(checkingOut.source, checkingOut.status)} px-1 overflow-hidden`}>
                                <span className="text-[9px] truncate">
                                  {checkingOut.guest_names[0]}
                                </span>
                              </div>
                              {/* Bottom half - available indicator */}
                              <div className="flex-1 flex items-center justify-center text-[9px] bg-green-700/85 text-white font-semibold gap-0.5">
                                <CheckCircle className="h-2.5 w-2.5" />
                                FREE
                              </div>
                            </div>
                          ) : checkingIn ? (
                            <div className={`h-full flex flex-col items-center justify-center ${getReservationColor(checkingIn.source, checkingIn.status)} px-1`}>
                              {renderGuestName(checkingIn.guest_names[0])}
                            </div>
                          ) : staying ? (
                            <div className={`h-full flex flex-col items-center justify-center ${getReservationColor(staying.source, staying.status)} px-1`}>
                              {renderGuestName(staying.guest_names[0])}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {filteredUnits.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            {units.length === 0 
              ? 'No units found. Add units to see availability.'
              : 'No rooms match your filter criteria.'}
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
            <div className="mt-4 space-y-4">
              {selectedDay.hasConflict && (
                <div className="bg-destructive/10 border border-destructive rounded-lg p-3">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Double Booking Conflict Detected
                  </div>
                </div>
              )}
              
              {/* Booked Rooms Section */}
              {selectedDay.reservations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-blue-600 flex items-center gap-1">
                    📅 Booked Rooms ({selectedDay.bookingCount})
                  </h4>
                  <div className="space-y-3">
                    {units.map(unit => {
                      const unitReservations = selectedDay.reservations.filter(r => r.unit_id === unit.id);
                      if (unitReservations.length === 0) return null;

                      return (
                        <div key={unit.id} className="border rounded-lg p-3 space-y-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="font-semibold text-sm text-primary hover:underline cursor-pointer w-fit">
                                {unit.booking_com_name || unit.name} - #{unit.unit_number}
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
                                onClick={() => handleReservationClick(reservation, { ...unit, status: 'available' })}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{reservation.guest_names[0]}</span>
                                  {(reservation.status === 'completed' || reservation.status === 'checked-out') && (
                                    <Badge variant="secondary" className="text-xs">
                                      {reservation.status.replace('-', ' ')}
                                    </Badge>
                                  )}
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
                </div>
              )}

              {/* Available Rooms Section */}
              {selectedDay.availableUnits.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-green-600 flex items-center gap-1">
                    ✓ Available Rooms ({selectedDay.availableUnits.length})
                  </h4>
                  <div className="grid gap-2">
                    {selectedDay.availableUnits.map(unit => (
                      <div key={unit.id} className="border border-green-200 bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                        <div className="font-medium text-sm">{unit.booking_com_name || unit.name}</div>
                        <div className="text-xs text-muted-foreground">Room #{unit.unit_number}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocked Rooms Section */}
              {selectedDay.blockedUnits.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-red-600 flex items-center gap-1">
                    🚫 Blocked Rooms ({selectedDay.blockedUnits.length})
                  </h4>
                  <div className="grid gap-2">
                    {selectedDay.blockedUnits.map(({ unit, reason }) => (
                      <div key={unit.id} className="border border-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                        <div className="font-medium text-sm">{unit.booking_com_name || unit.name}</div>
                        <div className="text-xs text-muted-foreground">Room #{unit.unit_number}</div>
                        {reason && <div className="text-xs text-red-600 mt-1">{reason}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No data message */}
              {selectedDay.reservations.length === 0 && selectedDay.availableUnits.length === 0 && selectedDay.blockedUnits.length === 0 && (
                <div className="text-center text-muted-foreground py-4">
                  No room data available for this date.
                </div>
              )}
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

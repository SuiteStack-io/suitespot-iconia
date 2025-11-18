import { useState, useEffect } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Unit {
  id: string;
  unit_number: string;
  name: string;
  unit_type: string;
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

export const RoomCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  useEffect(() => {
    fetchUnits();
    fetchReservations();
    fetchBlockedDates();

    // Set up real-time subscription for reservations
    const channel = supabase
      .channel('room-calendar-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('RoomCalendar real-time update:', payload);
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
          console.log('RoomCalendar blocked dates update:', payload);
          fetchBlockedDates();
        }
      )
      .subscribe((status) => {
        console.log('RoomCalendar subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUnits = async () => {
    const { data } = await supabase
      .from('units')
      .select('id, unit_number, name, unit_type')
      .order('unit_number');
    
    if (data) setUnits(data);
  };

  const fetchReservations = async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('status', 'confirmed');
    
    if (data) setReservations(data);
  };

  const fetchBlockedDates = async () => {
    const { data } = await supabase
      .from('blocked_dates')
      .select('*');
    
    if (data) setBlockedDates(data);
  };

  const getDaysInView = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  };

  const getReservationForDateAndUnit = (date: Date, unitId: string) => {
    return reservations.find(res => {
      const checkIn = new Date(res.check_in_date);
      const checkOut = new Date(res.check_out_date);
      return res.unit_id === unitId && date >= checkIn && date < checkOut;
    });
  };

  const hasConflict = (date: Date, unitId: string) => {
    // Check if there are multiple confirmed reservations for the same unit on the same date
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

  const navigatePrevious = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const days = getDaysInView();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={navigatePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center">
            <h2 className="text-xl font-bold">
              {viewMode === 'week' 
                ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={goToToday}>
            <CalendarIcon className="h-4 w-4 mr-2" />
            Today
          </Button>
        </div>
        
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month')}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="p-4 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border border-border bg-muted/50 p-3 text-left font-semibold min-w-[120px] sticky left-0 z-10">
                Room
              </th>
              {days.map((day) => (
                <th 
                  key={day.toISOString()} 
                  className={`border border-border p-3 text-center font-semibold min-w-[${viewMode === 'week' ? '140' : '100'}px] ${
                    isSameDay(day, new Date()) ? 'bg-primary/10' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm">{format(day, 'EEE')}</span>
                    <span className="text-lg">{format(day, viewMode === 'week' ? 'd MMM' : 'd')}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.id} className="hover:bg-muted/30 transition-colors">
                <td className="border border-border p-3 bg-background sticky left-0 z-10">
                  <div>
                    <div className="font-semibold">{unit.name} {unit.unit_number && `(${unit.unit_number})`}</div>
                    <div className="text-sm text-muted-foreground">{unit.unit_type}</div>
                  </div>
                </td>
                {days.map((day) => {
                  const reservation = getReservationForDateAndUnit(day, unit.id);
                  const blocked = isDateBlocked(day, unit.id);
                  const conflict = hasConflict(day, unit.id);
                  
                  return (
                    <td 
                      key={day.toISOString()} 
                      className={`border p-2 text-center ${
                        conflict
                          ? 'border-red-600 border-4 bg-red-600/90 text-white animate-pulse'
                          : blocked
                          ? 'bg-black text-white border-border'
                          : reservation
                          ? `${getReservationColor(reservation.source)} border-border`
                          : isSameDay(day, new Date()) 
                          ? 'bg-primary/5 border-border' 
                          : 'bg-background border-border'
                      }`}
                    >
                      {conflict ? (
                        <div className="text-xs space-y-1 break-words font-bold">
                          <div>⚠️ CONFLICT</div>
                          <div className="text-[10px]">DOUBLE BOOKING!</div>
                        </div>
                      ) : blocked ? (
                        <div className="text-xs space-y-1 break-words">
                          <div>Blocked</div>
                        </div>
                      ) : reservation ? (
                        <div className="text-xs space-y-1 break-words">
                          <div>Reserved</div>
                          <div className="text-[10px] opacity-90 font-medium">
                            {reservation.guest_names[0] || 'Guest'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-20 h-6 bg-red-600 border-4 border-red-600 rounded flex items-center justify-center text-white text-xs font-bold animate-pulse">⚠️</div>
          <span className="font-semibold text-red-600">= CONFLICT (Double Booking)</span>
        </div>
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
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">—</span>
          <span>= Available</span>
        </div>
      </div>
    </div>
  );
};

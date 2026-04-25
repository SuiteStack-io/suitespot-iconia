import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Calendar as CalendarIcon, Download, FileSpreadsheet, FileText, GripVertical, ArrowUpDown, Hash, Building2, Lock, Maximize2, Minimize2, Trash2, DollarSign, TrendingUp } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, getDaysInMonth, eachDayOfInterval, startOfDay, differenceInDays, parseISO, subDays, addMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ReservationQuickActions } from "./ReservationQuickActions";
import { CreateReservationDialog } from "./CreateReservationDialog";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";
import { usePropertyId, withPropertyFilter } from "@/hooks/usePropertyFilter";
import { isLateCheckoutFeeRow } from "@/lib/reservationFilters";

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  status: string;
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
  source?: string;
  price_per_night?: number | null;
  net_revenue?: number | null;
  total_price?: number | null;
  commission_amount?: number | null;
  group_id?: string | null;
  arrival_time?: string | null;
  notes?: string | null;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  unit_id: string | null;
  reason: string | null;
}

interface DayAvailability {
  date: Date;
  isAvailable: boolean;
  hasConflict: boolean;
  isBlocked: boolean;
  reservations: Reservation[];
  checkingOutReservation?: Reservation;
  checkingInReservation?: Reservation;
  isTurnoverDay: boolean;
  isAvailableForTurnover: boolean; // checkout exists but no check-in - available for same-day booking
  isExtensionContinuation?: boolean; // same guest extending in same room
  extensionReservation?: Reservation; // the continuing reservation
}


type ViewMode = 'weekly' | 'monthly';

// Helper function to count blocked dates for a unit within a date range
const getBlockedDatesCount = (unitId: string, blockedDates: BlockedDate[], startDate: Date, endDate: Date): number => {
  return blockedDates.filter(bd => {
    if (bd.unit_id !== unitId) return false;
    const blockedDate = startOfDay(new Date(bd.blocked_date));
    return blockedDate >= startDate && blockedDate <= endDate;
  }).length;
};

// Droppable Unit Row Component
const DroppableUnitRow = ({ unit, children }: { unit: Unit; children: React.ReactNode }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: unit.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${isOver ? 'bg-primary/10 ring-2 ring-primary ring-inset rounded' : ''}`}
    >
      {children}
    </div>
  );
};

// Draggable Reservation Cell Component
const DraggableReservationCell = ({
  reservation,
  availability,
  unit,
  getCellClassName,
  onClick,
  isExtended,
  isCheckIn,
}: {
  reservation: Reservation;
  availability: DayAvailability;
  unit: Unit;
  getCellClassName: (availability: DayAvailability) => string;
  onClick: () => void;
  isExtended?: boolean;
  isCheckIn?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: reservation.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 100 : undefined,
      }
    : undefined;

  const fullName = reservation.guest_names[0] || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`h-14 border rounded transition-colors cursor-grab active:cursor-grabbing ${getCellClassName(availability)} ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex flex-col items-center justify-center h-full px-1 overflow-hidden relative">
        {isExtended && (
          <span className="absolute top-0 right-0 text-[6px] bg-purple-500 text-white px-0.5 rounded-bl font-semibold leading-tight">
            EXT
          </span>
        )}
        {isCheckIn && !isExtended && (
          <span className="absolute top-0 right-0 text-[6px] bg-emerald-600 text-white px-0.5 rounded-bl font-semibold leading-tight">
            CHECK IN
          </span>
        )}
        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
          {firstName}
        </span>
        {lastName && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
            {lastName}
          </span>
        )}
        {reservation.source?.toLowerCase().includes('booking') && (
          <span className="absolute bottom-0 right-0 text-[6px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
            booking.com
          </span>
        )}
      </div>
    </div>
  );
};

// Split Turnover Cell Component - shows departing and arriving guest
const SplitTurnoverCell = ({
  checkingOutReservation,
  checkingInReservation,
  onClick,
}: {
  checkingOutReservation: Reservation;
  checkingInReservation: Reservation;
  onClick: () => void;
}) => {
  const departingName = checkingOutReservation.guest_names[0]?.split(' ')[0] || 'Guest';
  const arrivingName = checkingInReservation.guest_names[0]?.split(' ')[0] || 'Guest';

  return (
    <div 
      className="h-14 border rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
      onClick={onClick}
    >
      {/* Top half - departing guest (muted/faded) */}
      <div className="h-1/2 bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border-b border-orange-200 dark:border-orange-800">
        <span className="text-[9px] text-orange-600 dark:text-orange-400 font-medium truncate px-1 flex items-center gap-0.5">
          <span className="opacity-70">↑</span> {departingName}
        </span>
      </div>
      {/* Bottom half - arriving guest (bold/active) */}
      <div className="h-1/2 bg-blue-200 dark:bg-blue-800/50 flex items-center justify-center relative">
        <span className="text-[9px] text-blue-700 dark:text-blue-300 font-semibold truncate px-1 flex items-center gap-0.5">
          <span className="opacity-70">↓</span> {arrivingName}
        </span>
        {checkingInReservation.source?.toLowerCase().includes('booking') && (
          <span className="absolute bottom-0 right-0 text-[6px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
            booking.com
          </span>
        )}
      </div>
    </div>
  );
};

// Helper function to format large numbers compactly for mobile
const formatCompactNumber = (num: number): string => {
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') 
      ? formatted.slice(0, -2) + 'k' 
      : formatted + 'k';
  }
  return num.toLocaleString();
};

export const AvailabilityCalendar = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [extensionReservationIds, setExtensionReservationIds] = useState<Set<string>>(new Set());
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfDay(new Date()));
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('calendarViewMode');
    return (saved as ViewMode) || 'weekly';
  });
  const [conflicts, setConflicts] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [lastMove, setLastMove] = useState<{
    reservationId: string;
    originalUnitId: string;
    guestName: string;
    timestamp: number;
  } | null>(null);
  const propertyId = usePropertyId();
  const [sortByRoomType, setSortByRoomType] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendarSortByRoomType');
    return saved === null ? true : saved === 'true';
  });
  const [blockedDateDialogOpen, setBlockedDateDialogOpen] = useState(false);
  const [selectedBlockedDateInfo, setSelectedBlockedDateInfo] = useState<{
    unitId: string;
    unitName: string;
    unitNumber: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    daysCount: number;
  } | null>(null);
  const [deletingBlockedDates, setDeletingBlockedDates] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel'>('pdf');
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(undefined);
  const navigate = useNavigate();
  const { toast, dismiss } = useToast();
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { userRole, hasPermission } = useAuth();
  
  // Metrics state for Occupancy and RevPAR
  const [occupancyRate, setOccupancyRate] = useState<number>(0);
  const [revPAR, setRevPAR] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalGrossRevenue, setTotalGrossRevenue] = useState<number>(0);
  const [bookedNights, setBookedNights] = useState<number>(0);
  const [totalAvailableNights, setTotalAvailableNights] = useState<number>(0);
  const [showOccupancyModal, setShowOccupancyModal] = useState(false);
  const [showRevPARModal, setShowRevPARModal] = useState(false);

  interface UnitMetrics {
    unitId: string;
    unitName: string;
    unitNumber: string;
    bookedNights: number;
    availableNights: number;
    occupancyRate: number;
    netRevenue: number;
    revPAR: number;
    isBlocked?: boolean;
  }
  const [unitMetrics, setUnitMetrics] = useState<UnitMetrics[]>([]);

  // Force monthly view on mobile
  useEffect(() => {
    if (isMobile) {
      setViewMode('monthly');
    }
  }, [isMobile]);

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  // Swipe handlers for mobile navigation - optimized for touch scrolling
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      setCurrentWeekStart(addDays(currentWeekStart, 14));
    },
    onSwipedRight: () => {
      setCurrentWeekStart(addDays(currentWeekStart, -14));
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: false,
    delta: 80, // Require 80px minimum swipe distance to avoid interfering with scroll
    swipeDuration: 250, // Maximum time for swipe gesture
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Disable drag-and-drop on mobile
  const effectiveSensors = isMobile ? [] : sensors;

  // For mobile: show 30 days back and 60 days forward from today (scrollable)
  // For desktop: use monthly or weekly view as before
  const displayDays = isMobile 
    ? eachDayOfInterval({ start: subDays(new Date(), 30), end: addDays(new Date(), 60) })
    : viewMode === 'monthly' 
      ? eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
      : Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  // Ref for calendar scroll container to auto-scroll to today on mobile
  const calendarScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to today on mobile
  useEffect(() => {
    if (isMobile && calendarScrollRef.current) {
      // Calculate position: 30 days * 71px (70px column + 1px gap) + offset for unit column (160px)
      const todayPosition = 30 * 71; // 30 days from start to today
      setTimeout(() => {
        calendarScrollRef.current?.scrollTo({ left: todayPosition, behavior: 'auto' });
      }, 100);
    }
  }, [isMobile]);

  useEffect(() => {
    localStorage.setItem('calendarViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('calendarSortByRoomType', String(sortByRoomType));
  }, [sortByRoomType]);

  useEffect(() => {
    fetchData();
    
    // Real-time subscription
    const channel = supabase
      .channel('availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWeekStart, currentMonth, viewMode, propertyId, sortByRoomType]);

  const fetchData = async () => {
    // Fetch units filtered by location
    const { data: unitsData } = await withPropertyFilter(supabase
      .from('units')
      .select('*')
      .eq('status', 'available'), propertyId);

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

    // Fetch reservations for date range
    const startDate = viewMode === 'monthly' 
      ? format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      : format(currentWeekStart, 'yyyy-MM-dd');
    const endDate = viewMode === 'monthly'
      ? format(endOfMonth(currentMonth), 'yyyy-MM-dd')
      : format(addDays(currentWeekStart, 13), 'yyyy-MM-dd');

    const { data: reservationsData } = await withPropertyFilter(supabase
      .from('reservations')
      .select('*')
      .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
      .is('cancelled_at', null)
      .or(`and(check_in_date.lte.${endDate},check_out_date.gte.${startDate})`), propertyId);

    if (reservationsData) {
      setReservations(reservationsData);
      detectConflicts(reservationsData);
      
      // Group reservations by group_id to find extensions
      const groupedReservations = new Map<string, typeof reservationsData>();
      reservationsData.forEach(r => {
        if (r.group_id && r.unit_id) {
          const group = groupedReservations.get(r.group_id) || [];
          group.push(r);
          groupedReservations.set(r.group_id, group);
        }
      });

      // Find extension reservation IDs
      // An extension must be: same group_id, same unit_id, and sequential dates
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
              // Sort by check_in_date
              const sorted = [...unitReservations].sort(
                (a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()
              );
              
              // Helper to extract base confirmation number (removes -A, -B suffix)
              const getBaseConfirmation = (confirmationNumber: string) => 
                confirmationNumber.replace(/-[A-Z]$/, '');

              // Check if they're sequential (checkout = next check-in)
              for (let i = 1; i < sorted.length; i++) {
                const prev = sorted[i - 1];
                const curr = sorted[i];
                
                // If check_out of previous = check_in of current, check if it's an extension
                if (new Date(prev.check_out_date).getTime() === new Date(curr.check_in_date).getTime()) {
                  // Check if they share the same base confirmation number (split booking)
                  const prevBase = getBaseConfirmation(prev.booking_reference || '');
                  const currBase = getBaseConfirmation(curr.booking_reference || '');
                  
                  // Only mark as extension if they have different base confirmation numbers
                  // Same base = split booking segments, different base = true extension
                  if (prevBase !== currBase || !prevBase) {
                    extensionIds.add(curr.id);
                  }
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
    
    if (blockedData) {
      setBlockedDates(blockedData);
    }
  };

  const detectConflicts = (reservationsList: Reservation[]) => {
    const conflictSet = new Set<string>();

    // Exclude late-checkout fee rows (booking_reference ends "-LC", same-day).
    // They are billing entries linked to the original reservation, not real stays.
    const realReservations = reservationsList.filter(r => !isLateCheckoutFeeRow(r));

    // Group by unit and date
    const bookingsByUnitDate = new Map<string, Reservation[]>();

    realReservations.forEach(reservation => {
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      
      // Generate all dates for this reservation using isSameDay for accuracy
      const dates = eachDayOfInterval({ start: checkIn, end: addDays(checkOut, -1) });
      
      dates.forEach(d => {
        const dateKey = format(d, 'yyyy-MM-dd');
        const key = `${reservation.unit_id}-${dateKey}`;
        
        if (!bookingsByUnitDate.has(key)) {
          bookingsByUnitDate.set(key, []);
        }
        bookingsByUnitDate.get(key)!.push(reservation);
      });
    });

    // Check for conflicts (multiple bookings on same unit/date)
    bookingsByUnitDate.forEach((bookings, key) => {
      if (bookings.length > 1) {
        conflictSet.add(key);
      }
    });

    setConflicts(conflictSet);
  };

  // Calculate Occupancy and RevPAR metrics based on view mode
  const calculateMetrics = () => {
    if (units.length === 0) {
      setOccupancyRate(0);
      setRevPAR(0);
      setTotalRevenue(0);
      setBookedNights(0);
      setTotalAvailableNights(0);
      return;
    }

    // Get date range based on view mode
    const startDate = viewMode === 'monthly' 
      ? startOfMonth(currentMonth) 
      : currentWeekStart;
    const endDate = viewMode === 'monthly'
      ? endOfMonth(currentMonth)
      : addDays(currentWeekStart, 13);
    
    const daysInPeriod = differenceInDays(endDate, startDate) + 1;
    
    // Calculate available nights dynamically based on blocked_dates
    // Each unit's available nights = total days - blocked days in period
    let availableNights = 0;
    units.forEach(unit => {
      const blockedCount = getBlockedDatesCount(unit.id, blockedDates, startDate, endDate);
      availableNights += (daysInPeriod - blockedCount);
    });
    
    // Calculate booked nights and net revenue from reservations
    let totalBookedNights = 0;
    let periodRevenue = 0;
    let periodGrossRevenue = 0;
    
    reservations.forEach(reservation => {
      // Only count reservations for units in current location
      if (!units.find(u => u.id === reservation.unit_id)) return;
      
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      
      // Calculate overlap with current period
      const overlapStart = checkIn > startDate ? checkIn : startDate;
      const overlapEnd = checkOut < endDate ? checkOut : addDays(endDate, 1);
      
      if (overlapStart < overlapEnd) {
        const nightsInPeriod = differenceInDays(overlapEnd, overlapStart);
        const totalNights = differenceInDays(checkOut, checkIn);
        totalBookedNights += nightsInPeriod;
        
        // Calculate net revenue dynamically instead of reading from database
        const calculatedNetRevenue = (reservation.total_price || 0) - (reservation.commission_amount || 0);
        const proportionalNetRevenue = totalNights > 0 
          ? (calculatedNetRevenue / totalNights) * nightsInPeriod 
          : 0;
        periodRevenue += proportionalNetRevenue;
        
        // Calculate gross revenue from total_price (proportional for partial periods)
        const grossRevenue = reservation.total_price || 0;
        const proportionalGrossRevenue = totalNights > 0 
          ? (grossRevenue / totalNights) * nightsInPeriod 
          : 0;
        periodGrossRevenue += proportionalGrossRevenue;
      }
    });
    
    const occupancy = availableNights > 0 
      ? (totalBookedNights / availableNights) * 100 
      : 0;
    
    const revpar = availableNights > 0 
      ? periodRevenue / availableNights 
      : 0;
    
    // Calculate per-unit metrics for breakdown (include all units, but blocked ones show 0 available)
    const perUnitMetrics: UnitMetrics[] = units.map(unit => {
      const unitBlockedCount = getBlockedDatesCount(unit.id, blockedDates, startDate, endDate);
      const unitAvailableNights = daysInPeriod - unitBlockedCount;
      const isBlocked = unitAvailableNights === 0;
      let unitBookedNights = 0;
      let unitRevenue = 0;
      
      reservations.forEach(reservation => {
        if (reservation.unit_id !== unit.id) return;
        
        const checkIn = new Date(reservation.check_in_date);
        const checkOut = new Date(reservation.check_out_date);
        
        const overlapStart = checkIn > startDate ? checkIn : startDate;
        const overlapEnd = checkOut < endDate ? checkOut : addDays(endDate, 1);
        
        if (overlapStart < overlapEnd) {
          const nightsInPeriod = differenceInDays(overlapEnd, overlapStart);
          const totalNights = differenceInDays(checkOut, checkIn);
          unitBookedNights += nightsInPeriod;
          
          // Calculate net revenue dynamically instead of reading from database
          const calculatedNetRevenue = (reservation.total_price || 0) - (reservation.commission_amount || 0);
          unitRevenue += totalNights > 0 
            ? (calculatedNetRevenue / totalNights) * nightsInPeriod 
            : 0;
        }
      });
      
      return {
        unitId: unit.id,
        unitName: unit.booking_com_name || unit.name,
        unitNumber: unit.unit_number || '',
        bookedNights: unitBookedNights,
        availableNights: unitAvailableNights,
        occupancyRate: unitAvailableNights > 0 
          ? (unitBookedNights / unitAvailableNights) * 100 
          : 0,
        netRevenue: unitRevenue,
        revPAR: unitAvailableNights > 0 
          ? unitRevenue / unitAvailableNights 
          : 0,
        isBlocked,
      };
    });
    
    setUnitMetrics(perUnitMetrics);
    setOccupancyRate(occupancy);
    setRevPAR(revpar);
    setTotalRevenue(periodRevenue);
    setTotalGrossRevenue(periodGrossRevenue);
    setBookedNights(totalBookedNights);
    setTotalAvailableNights(availableNights);
  };

  // Recalculate metrics when data changes (including blocked dates)
  useEffect(() => {
    calculateMetrics();
  }, [units, reservations, blockedDates, viewMode, currentWeekStart, currentMonth]);

  const isDateBlocked = (date: Date, unitId: string) => {
    return blockedDates.some(blocked => {
      const blockedDate = new Date(blocked.blocked_date);
      return isSameDay(date, blockedDate) && 
             (blocked.unit_id === null || blocked.unit_id === unitId);
    });
  };

  const getDayAvailability = (unit: Unit, date: Date): DayAvailability => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const isBlocked = isDateBlocked(date, unit.id);
    
    const dayReservations = reservations.filter(r => {
      if (r.unit_id !== unit.id) return false;
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

    // Find check-out reservation (departing today) - any status
    const checkingOutReservation = reservations.find(r => 
      r.unit_id === unit.id && isSameDay(new Date(r.check_out_date), date)
    );
    
    // Find check-in reservation (arriving today) - confirmed or checked-in
    const checkingInReservation = reservations.find(r => 
      r.unit_id === unit.id && 
      isSameDay(new Date(r.check_in_date), date) &&
      (r.status === 'confirmed' || r.status === 'checked-in')
    );
    
    // Check if this is an extension (same group_id, same unit, same guest continuing)
    const isExtensionContinuation = !!(
      checkingOutReservation && 
      checkingInReservation &&
      checkingOutReservation.group_id &&
      checkingOutReservation.group_id === checkingInReservation.group_id &&
      checkingOutReservation.unit_id === checkingInReservation.unit_id &&
      checkingOutReservation.guest_names[0] === checkingInReservation.guest_names[0]
    );
    
    // Only mark as turnover if it's NOT an extension continuation
    const isTurnoverDay = !!checkingOutReservation && !!checkingInReservation && !isExtensionContinuation;
    
    // Available for same-day turnover: checkout exists but no check-in scheduled
    const isAvailableForTurnover = !!checkingOutReservation && !checkingInReservation;

    const conflictKey = `${unit.id}-${dateKey}`;
    const hasConflict = conflicts.has(conflictKey);

    return {
      date,
      isAvailable: dayReservations.length === 0 && !isBlocked,
      hasConflict,
      isBlocked,
      reservations: dayReservations,
      checkingOutReservation: isExtensionContinuation ? undefined : checkingOutReservation,
      checkingInReservation: isExtensionContinuation ? undefined : checkingInReservation,
      isTurnoverDay,
      isAvailableForTurnover,
      isExtensionContinuation,
      extensionReservation: isExtensionContinuation ? checkingInReservation : undefined,
    };
  };

  const getCellClassName = (availability: DayAvailability) => {
    if (availability.hasConflict) {
      return "bg-red-600 border-red-700 hover:bg-red-700 animate-pulse cursor-pointer";
    }
    if (availability.isBlocked) {
      return "bg-muted text-muted-foreground border border-border cursor-pointer hover:bg-muted/80";
    }
    if (!availability.isAvailable) {
      return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/40 cursor-pointer";
    }
    return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40";
  };

  // Helper to check if a reservation is an extension (not the original)
  const isExtensionReservation = (reservation: Reservation): boolean => {
    return extensionReservationIds.has(reservation.id);
  };

  // Get the full date range for a blocked period
  const getBlockedDateRange = (date: Date, unitId: string) => {
    // Find all blocked dates for this unit with the same reason
    const clickedBlockedDate = blockedDates.find(b => 
      isSameDay(parseISO(b.blocked_date), date) && 
      (b.unit_id === null || b.unit_id === unitId)
    );
    
    if (!clickedBlockedDate) return null;
    
    const reason = clickedBlockedDate.reason;
    const targetUnitId = clickedBlockedDate.unit_id;
    
    // Get all blocked dates for this unit with the same reason
    const relevantBlocked = blockedDates
      .filter(b => 
        (b.unit_id === targetUnitId) && 
        b.reason === reason
      )
      .sort((a, b) => a.blocked_date.localeCompare(b.blocked_date));
    
    if (relevantBlocked.length === 0) return null;
    
    // Find the consecutive range containing the clicked date
    const clickedDateStr = format(date, 'yyyy-MM-dd');
    let startIdx = relevantBlocked.findIndex(b => b.blocked_date === clickedDateStr);
    let endIdx = startIdx;
    
    if (startIdx === -1) return null;
    
    // Expand backwards to find start of range
    while (startIdx > 0) {
      const prevDate = parseISO(relevantBlocked[startIdx - 1].blocked_date);
      const currentDate = parseISO(relevantBlocked[startIdx].blocked_date);
      const diff = differenceInDays(currentDate, prevDate);
      if (diff === 1) {
        startIdx--;
      } else {
        break;
      }
    }
    
    // Expand forwards to find end of range
    while (endIdx < relevantBlocked.length - 1) {
      const currentDate = parseISO(relevantBlocked[endIdx].blocked_date);
      const nextDate = parseISO(relevantBlocked[endIdx + 1].blocked_date);
      const diff = differenceInDays(nextDate, currentDate);
      if (diff === 1) {
        endIdx++;
      } else {
        break;
      }
    }
    
    const startDate = relevantBlocked[startIdx].blocked_date;
    const endDate = relevantBlocked[endIdx].blocked_date;
    const daysCount = endIdx - startIdx + 1;
    
    return { startDate, endDate, reason, daysCount };
  };

  const handleBlockedCellClick = (date: Date, unit: Unit) => {
    const blockInfo = getBlockedDateRange(date, unit.id);
    if (!blockInfo) return;
    
    setSelectedBlockedDateInfo({
      unitId: unit.id,
      unitName: unit.booking_com_name || unit.name,
      unitNumber: unit.unit_number || '',
      startDate: blockInfo.startDate,
      endDate: blockInfo.endDate,
      reason: blockInfo.reason,
      daysCount: blockInfo.daysCount,
    });
    setBlockedDateDialogOpen(true);
  };

  const handleDeleteBlockedDates = async () => {
    if (!selectedBlockedDateInfo) return;
    
    setDeletingBlockedDates(true);
    try {
      // Find all blocked date IDs matching the unit, date range, and reason
      const startDate = parseISO(selectedBlockedDateInfo.startDate);
      const endDate = parseISO(selectedBlockedDateInfo.endDate);
      
      const idsToDelete = blockedDates
        .filter(bd => {
          const bdDate = parseISO(bd.blocked_date);
          return bd.unit_id === selectedBlockedDateInfo.unitId &&
                 bdDate >= startDate &&
                 bdDate <= endDate &&
                 bd.reason === selectedBlockedDateInfo.reason;
        })
        .map(bd => bd.id);
      
      if (idsToDelete.length === 0) {
        toast({ title: "No blocked dates found to delete", variant: "destructive" });
        return;
      }
      
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .in('id', idsToDelete);
      
      if (error) throw error;
      
      // Update local state
      setBlockedDates(prev => prev.filter(bd => !idsToDelete.includes(bd.id)));
      setDeleteConfirmOpen(false);
      setBlockedDateDialogOpen(false);
      setSelectedBlockedDateInfo(null);
      
      toast({ 
        title: "Blocked dates deleted", 
        description: `Removed ${idsToDelete.length} blocked date${idsToDelete.length > 1 ? 's' : ''}` 
      });
    } catch (error) {
      console.error('Error deleting blocked dates:', error);
      toast({ title: "Failed to delete blocked dates", variant: "destructive" });
    } finally {
      setDeletingBlockedDates(false);
    }
  };

  const handlePrevious = () => {
    if (viewMode === 'monthly') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    } else {
      setCurrentWeekStart(addDays(currentWeekStart, -7));
    }
  };

  const handleNext = () => {
    if (viewMode === 'monthly') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    } else {
      setCurrentWeekStart(addDays(currentWeekStart, 7));
    }
  };

  const handleToday = () => {
    const today = startOfDay(new Date());
    if (viewMode === 'monthly') {
      setCurrentMonth(startOfMonth(today));
    } else {
      setCurrentWeekStart(today);
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'weekly' ? 'monthly' : 'weekly');
  };

  const handleExportClick = (type: 'pdf' | 'excel') => {
    setExportType(type);
    setExportDateRange({
      from: displayDays[0],
      to: displayDays[displayDays.length - 1]
    });
    setExportDialogOpen(true);
  };

  const handleExportConfirm = () => {
    if (exportType === 'pdf') {
      exportToPDF();
    } else {
      exportToExcel();
    }
    setExportDialogOpen(false);
  };

  const handleCellClick = (availability: DayAvailability, unit: Unit, date: Date) => {
    if (availability.isBlocked) {
      handleBlockedCellClick(date, unit);
      return;
    }
    if (availability.reservations.length === 0) {
      return;
    }
    setSelectedReservation(availability.reservations[0]);
    setSelectedUnit(unit);
    setQuickActionsOpen(true);
  };

  const handleMoveComplete = () => {
    fetchData();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const reservation = reservations.find(r => r.id === active.id);
    if (reservation) {
      setActiveReservation(reservation);
    }
  };

  const handleUndoMove = async () => {
    if (!lastMove) return;
    
    const timeSinceMove = Date.now() - lastMove.timestamp;
    if (timeSinceMove > 10000) {
      toast({
        title: "Undo Expired",
        description: "The undo window has expired (10 seconds).",
        variant: "destructive",
      });
      setLastMove(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ unit_id: lastMove.originalUnitId })
        .eq('id', lastMove.reservationId);

      if (error) throw error;

      const originalUnit = units.find(u => u.id === lastMove.originalUnitId);
      toast({
        title: "Move Undone",
        description: `${lastMove.guestName} moved back to ${originalUnit?.name} #${originalUnit?.unit_number}`,
      });

      setLastMove(null);
      fetchData();
    } catch (error) {
      console.error('Error undoing move:', error);
      toast({
        title: "Undo Failed",
        description: "Failed to undo the move. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveReservation(null);

    if (!over || !active) return;

    const reservationId = active.id as string;
    const targetUnitId = over.id as string;
    const reservation = reservations.find(r => r.id === reservationId);

    if (!reservation || reservation.unit_id === targetUnitId) return;

    const originalUnitId = reservation.unit_id;

    // Check for conflicts in target unit
    const hasConflict = reservations.some(r => {
      if (r.unit_id !== targetUnitId || r.id === reservationId) return false;
      const rCheckIn = new Date(r.check_in_date);
      const rCheckOut = new Date(r.check_out_date);
      const resCheckIn = new Date(reservation.check_in_date);
      const resCheckOut = new Date(reservation.check_out_date);
      return resCheckIn < rCheckOut && resCheckOut > rCheckIn;
    });

    if (hasConflict) {
      toast({
        title: "Cannot Move",
        description: "Target room has conflicting reservations for these dates.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('reservations')
        .update({ unit_id: targetUnitId })
        .eq('id', reservationId);

      if (error) throw error;

      const targetUnit = units.find(u => u.id === targetUnitId);
      const originalUnit = units.find(u => u.id === originalUnitId);
      const guestName = reservation.guest_names[0] || 'Guest';

      // Calculate nights
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      const nightsCount = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      // Send room change notification email
      try {
        await supabase.functions.invoke('send-room-change-notification', {
          body: {
            reservation_id: reservation.id,
            booking_reference: reservation.booking_reference,
            guest_names: reservation.guest_names,
            check_in_date: reservation.check_in_date,
            check_out_date: reservation.check_out_date,
            old_unit_name: originalUnit?.name,
            old_unit_number: originalUnit?.unit_number,
            new_unit_name: targetUnit?.name,
            new_unit_number: targetUnit?.unit_number,
            nights: nightsCount,
            source: reservation.source,
          }
        });
        console.log("Room change notification sent successfully");
      } catch (notifyError) {
        console.error("Failed to send room change notification:", notifyError);
        // Don't throw - the move was successful, notification is secondary
      }

      // Store the move for undo
      setLastMove({
        reservationId,
        originalUnitId: originalUnitId!,
        guestName,
        timestamp: Date.now(),
      });

      // Show toast with undo button
      const toastId = toast({
        title: "Reservation Moved",
        description: `${guestName} moved to ${targetUnit?.name} #${targetUnit?.unit_number}`,
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              handleUndoMove();
              dismiss(toastId.id);
            }}
          >
            Undo
          </Button>
        ),
        duration: 10000,
      });

      // Clear lastMove after 10 seconds
      setTimeout(() => {
        setLastMove(prev => {
          if (prev && prev.reservationId === reservationId) {
            return null;
          }
          return prev;
        });
      }, 10000);

      fetchData();
    } catch (error) {
      console.error('Error moving reservation:', error);
      toast({
        title: "Move Failed",
        description: "Failed to move reservation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const exportToPDF = async () => {
    if (!exportDateRange?.from || !exportDateRange?.to) return;
    
    setExporting(true);
    // Helper function to detect Arabic text
    const containsArabic = (text: string): boolean => {
      return /[\u0600-\u06FF]/.test(text);
    };

    // Load Arabic font for PDF
    const loadArabicFont = async (pdf: jsPDF): Promise<boolean> => {
      try {
        const response = await fetch('/fonts/Amiri-Regular.ttf');
        if (!response.ok) throw new Error('Arabic font fetch failed');
        const buffer = await response.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        pdf.addFileToVFS('Amiri-Regular.ttf', base64);
        pdf.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        return true;
      } catch (error) {
        console.error('Failed to load Arabic font:', error);
        return false;
      }
    };

    // Load Playfair Display font for PDF
    const loadPlayfairFont = async (pdf: jsPDF): Promise<boolean> => {
      try {
        const regularResponse = await fetch('/fonts/PlayfairDisplay-Regular.ttf');
        if (!regularResponse.ok) throw new Error('Playfair font fetch failed');
        const regularBuffer = await regularResponse.arrayBuffer();
        const regularBase64 = btoa(
          new Uint8Array(regularBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        pdf.addFileToVFS('PlayfairDisplay-Regular.ttf', regularBase64);
        pdf.addFont('PlayfairDisplay-Regular.ttf', 'Playfair Display', 'normal');
        
        const boldResponse = await fetch('/fonts/PlayfairDisplay-Bold.ttf');
        if (!boldResponse.ok) throw new Error('Playfair Bold font fetch failed');
        const boldBuffer = await boldResponse.arrayBuffer();
        const boldBase64 = btoa(
          new Uint8Array(boldBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        pdf.addFileToVFS('PlayfairDisplay-Bold.ttf', boldBase64);
        pdf.addFont('PlayfairDisplay-Bold.ttf', 'Playfair Display', 'bold');
        
        return true;
      } catch (error) {
        console.error('Failed to load Playfair Display font:', error);
        return false;
      }
    };

    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      const pageWidth = doc.internal.pageSize.width;
      
      // Load fonts
      const hasArabicFont = await loadArabicFont(doc);
      const hasPlayfairFont = await loadPlayfairFont(doc);
      
      const exportDays = eachDayOfInterval({ start: exportDateRange.from, end: exportDateRange.to });
      
      // Fetch reservations specifically for the export date range
      const startDate = format(exportDateRange.from, 'yyyy-MM-dd');
      const endDate = format(exportDateRange.to, 'yyyy-MM-dd');
      
      const { data: exportReservations } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
        .is('cancelled_at', null)
        .lte('check_in_date', endDate)
        .gte('check_out_date', startDate);
      
      // Local function to get availability using fetched export data
      const getExportDayAvailability = (unit: Unit, date: Date): DayAvailability => {
        const isBlocked = isDateBlocked(date, unit.id);
        
        const dayReservations = (exportReservations || []).filter((r: Reservation) => {
          if (r.unit_id !== unit.id) return false;
          // Skip late-checkout fee rows — they're billing entries, not stays.
          if (isLateCheckoutFeeRow(r)) return false;
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          const isCheckInDay = isSameDay(date, checkIn);
          const isStayingDay = date > checkIn && date < checkOut;
          const isCheckoutDayForCompleted = 
            (r.status === 'completed' || r.status === 'checked-out') && 
            isSameDay(date, checkOut);
          return isCheckInDay || isStayingDay || isCheckoutDayForCompleted;
        });

        // Check for actual conflicts - only count reservations staying overnight
        // A turnover day (one checking out, one checking in) is NOT a conflict
        const stayingOvernight = dayReservations.filter((r: Reservation) => {
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          // Guest is staying overnight if date >= checkIn AND date < checkOut
          return date >= checkIn && date < checkOut;
        });
        const hasConflict = stayingOvernight.length > 1;

        return {
          date,
          isAvailable: dayReservations.length === 0 && !isBlocked,
          hasConflict,
          isBlocked,
          reservations: dayReservations,
          isTurnoverDay: false,
          isAvailableForTurnover: false, // Not relevant for PDF export
        };
      };
      
      // Load and add SuiteSpot logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve) => {
        logoImg.onload = () => {
          // Add logo (15mm width, maintain aspect ratio)
          const logoWidth = 15;
          const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
          doc.addImage(logoImg, 'PNG', 14, 10, logoWidth, logoHeight);
          resolve();
        };
        logoImg.onerror = () => {
          console.warn('Failed to load logo');
          resolve();
        };
        logoImg.src = '/suitespot-logo-3.png';
      });
      
      // Title and date range (next to logo) - Playfair Display font
      doc.setFontSize(24);
      if (hasPlayfairFont) {
        doc.setFont('Playfair Display', 'normal');
      } else {
        doc.setFont('helvetica', 'bold');
      }
      doc.text('Unit Availability Calendar', 45, 16);
      
      doc.setFontSize(11);
      if (hasPlayfairFont) {
        doc.setFont('Playfair Display', 'normal');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.text(`${format(exportDateRange.from, 'MMMM d, yyyy')} - ${format(exportDateRange.to, 'MMMM d, yyyy')}`, 45, 24);
      
      // Generated timestamp (right side)
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageWidth - 14, 12, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      
      // Add conflict warning if any
      let startY = 35;
      if (totalConflicts > 0) {
        doc.setFontSize(10);
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.text(`⚠️ ${totalConflicts} CONFLICT${totalConflicts > 1 ? 'S' : ''} DETECTED`, 14, 32);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        startY = 38;
      }

      // Calculate metrics for export date range
      const exportDaysCount = differenceInDays(exportDateRange.to, exportDateRange.from) + 1;
      
      // Calculate available nights dynamically based on blocked_dates
      let exportAvailableNights = 0;
      units.forEach(unit => {
        const blockedCount = getBlockedDatesCount(unit.id, blockedDates, exportDateRange.from, exportDateRange.to);
        exportAvailableNights += (exportDaysCount - blockedCount);
      });
      
      let exportBookedNights = 0;
      let exportRevenue = 0;
      
      (exportReservations || []).forEach((r: Reservation) => {
        // Only count reservations for units in current location
        if (!units.find(u => u.id === r.unit_id)) return;
        
        const checkIn = new Date(r.check_in_date);
        const checkOut = new Date(r.check_out_date);
        const overlapStart = checkIn > exportDateRange.from ? checkIn : exportDateRange.from;
        const overlapEnd = checkOut < exportDateRange.to ? checkOut : addDays(exportDateRange.to, 1);
        
        if (overlapStart < overlapEnd) {
          const nightsInPeriod = differenceInDays(overlapEnd, overlapStart);
          const totalNights = differenceInDays(checkOut, checkIn);
          exportBookedNights += nightsInPeriod;
          
          // Use net_revenue with proration (matching calendar card logic)
          const netRevenue = r.net_revenue || 0;
          const proportionalNetRevenue = totalNights > 0 
            ? (netRevenue / totalNights) * nightsInPeriod 
            : 0;
          exportRevenue += proportionalNetRevenue;
        }
      });
      
      const exportOccupancy = exportAvailableNights > 0 
        ? (exportBookedNights / exportAvailableNights) * 100 
        : 0;
      const exportRevPAR = exportAvailableNights > 0 
        ? exportRevenue / exportAvailableNights 
        : 0;

      // Add Occupancy Summary
      doc.setFontSize(11);
      if (hasPlayfairFont) {
        doc.setFont('Playfair Display', 'normal');
      } else {
        doc.setFont('helvetica', 'bold');
      }
      doc.text('Summary:', 14, startY);

      const summaryY = startY + 5;
      doc.text(`Occupancy Rate: ${exportOccupancy.toFixed(1)}%`, 14, summaryY);
      doc.text(`Booked Nights: ${exportBookedNights}/${exportAvailableNights}`, 70, summaryY);
      
      startY = summaryY + 10;

      // Prepare table data with booking.com name + room number
      // Format dates as multi-line: Day of week, Day number, Month
      const headers = ['Room', ...exportDays.map(day => 
        `${format(day, 'EEEEE')}\n${format(day, 'd')}\n${format(day, 'MMM')}`
      )];
      
      // Group units by room type for separator headers
      const sortedUnits = [...units].sort((a, b) => {
        const nameA = a.booking_com_name || a.name || '';
        const nameB = b.booking_com_name || b.name || '';
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return (a.unit_number || '').localeCompare(b.unit_number || '');
      });
      
      // Create availability matrix for cell coloring (aligned with sortedUnits)
      const availabilityMatrix: string[][] = sortedUnits.map(unit => {
        return exportDays.map(day => {
          const availability = getExportDayAvailability(unit, day);
          if (availability.hasConflict) return 'conflict';
          if (availability.isBlocked) return 'blocked';
          if (!availability.isAvailable) {
            // Check if this is the last night of stay (checkout next day)
            const isCheckoutDay = availability.reservations?.some((r: Reservation) => {
              const checkOut = new Date(r.check_out_date);
              const dayAfter = new Date(day);
              dayAfter.setDate(dayAfter.getDate() + 1);
              return isSameDay(dayAfter, checkOut);
            });
            return isCheckoutDay ? 'checkout' : 'booked';
          }
          return 'available';
        });
      });
      
      // Pre-calculate reservation spans for merged cells
      const reservationSpans: Map<string, Array<{
        reservationId: string;
        guestName: string;
        startDayIndex: number;
        endDayIndex: number;
        colSpan: number;
      }>> = new Map();

      sortedUnits.forEach((unit) => {
        const unitReservations = (exportReservations || []).filter(
          (r: Reservation) => r.unit_id === unit.id && r.status !== 'cancelled'
        );
        
        const spans: Array<{
          reservationId: string;
          guestName: string;
          startDayIndex: number;
          endDayIndex: number;
          colSpan: number;
        }> = [];
        
        unitReservations.forEach((r: Reservation) => {
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          
          let startIdx = -1, endIdx = -1;
          exportDays.forEach((day, idx) => {
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const checkInStart = new Date(checkIn);
            checkInStart.setHours(0, 0, 0, 0);
            const checkOutStart = new Date(checkOut);
            checkOutStart.setHours(0, 0, 0, 0);
            
            const inRange = dayStart >= checkInStart && dayStart < checkOutStart;
            if (inRange) {
              if (startIdx === -1) startIdx = idx;
              endIdx = idx;
            }
          });
          
          if (startIdx !== -1) {
            spans.push({
              reservationId: r.id,
              guestName: r.guest_names?.[0] || 'Booked',
              startDayIndex: startIdx,
              endDayIndex: endIdx,
              colSpan: endIdx - startIdx + 1
            });
          }
        });
        
        reservationSpans.set(unit.id, spans);
      });
      
      // Build table data with room type separator rows
      type CellContent = string | { content: string; colSpan: number };
      const tableData: CellContent[][] = [];
      const separatorRowIndices: number[] = [];
      let currentRoomType = '';
      
      sortedUnits.forEach((unit) => {
        const roomType = unit.booking_com_name || unit.name || 'Unknown';
        
        // Add separator row when room type changes
        if (roomType !== currentRoomType) {
          const roomCount = sortedUnits.filter(u => (u.booking_com_name || u.name) === roomType).length;
          const separatorRow: CellContent[] = [`${roomType} (${roomCount} room${roomCount > 1 ? 's' : ''})`, ...exportDays.map(() => '')];
          separatorRowIndices.push(tableData.length);
          tableData.push(separatorRow);
          currentRoomType = roomType;
        }
        
        // Room row: room number only (since room type is in separator)
        const roomNumber = unit.unit_number ? `#${unit.unit_number}` : unit.name;
        const row: CellContent[] = [roomNumber];
        
        // Get reservation spans for this unit
        const spans = reservationSpans.get(unit.id) || [];
        
        // Build row with merged cells for reservations
        let dayIdx = 0;
        while (dayIdx < exportDays.length) {
          const day = exportDays[dayIdx];
          const availability = getExportDayAvailability(unit, day);
          
          // Check if this is the start of a reservation span
          const spanStart = spans.find(s => s.startDayIndex === dayIdx);
          
        if (availability.hasConflict) {
          // Conflict: just show "Conflict" text
          row.push('Conflict');
          dayIdx++;
          } else if (spanStart && !availability.isBlocked) {
            // Start of reservation span: create merged cell
            row.push({ content: spanStart.guestName, colSpan: spanStart.colSpan });
            dayIdx += spanStart.colSpan; // Skip the merged days
          } else if (availability.isBlocked) {
            // Blocked: empty cell (styling handles black fill)
            row.push('');
            dayIdx++;
          } else {
            // Available: empty cell
            row.push('');
            dayIdx++;
          }
        }
        tableData.push(row);
      });
      
      // Map original unit indices to table row indices (accounting for separators)
      const unitToTableRowMap: number[] = [];
      let separatorCount = 0;
      sortedUnits.forEach((_, idx) => {
        while (separatorRowIndices.includes(idx + separatorCount)) {
          separatorCount++;
        }
        unitToTableRowMap.push(idx + separatorCount);
      });

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: startY,
        theme: 'grid',
        styles: { 
          fontSize: 5, 
          cellPadding: 1,
          halign: 'center',
          valign: 'middle',
          minCellHeight: 6,
          overflow: 'ellipsize',
        },
        headStyles: { 
          fillColor: [55, 65, 81], // gray-700
          textColor: 255,
          fontSize: 5,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: 1,
          minCellHeight: 12,
        },
        columnStyles: (() => {
          const pageWidth = doc.internal.pageSize.getWidth();
          const roomColumnWidth = 30;
          const margins = 28; // 14 left + 14 right
          const availableWidth = pageWidth - roomColumnWidth - margins;
          const dayColumnWidth = availableWidth / exportDays.length;
          
          const styles: { [key: number]: any } = {
            0: { 
              fontStyle: 'bold', 
              cellWidth: roomColumnWidth,
              halign: 'left',
              fontSize: 5,
            }
          };
          
          // Set fixed equal width for all day columns
          for (let i = 1; i <= exportDays.length; i++) {
            styles[i] = { cellWidth: dayColumnWidth };
          }
          
          return styles;
        })(),
        didParseCell: (data) => {
          // Calculate today's column index
          const today = startOfDay(new Date());
          const todayDayIndex = exportDays.findIndex(day => isSameDay(day, today));
          const todayTableColumnIndex = todayDayIndex >= 0 ? todayDayIndex + 1 : -1; // +1 for Room column
          
          // Handle header section - highlight today's column
          if (data.section === 'head') {
            if (todayTableColumnIndex > 0 && data.column.index === todayTableColumnIndex) {
              data.cell.styles.fillColor = [31, 41, 55]; // gray-800 (dark)
              data.cell.styles.textColor = [255, 255, 255]; // white
              data.cell.styles.fontStyle = 'bold';
            }
            return;
          }
          
          // Check for Arabic text and use Amiri font
          const cellText = Array.isArray(data.cell.text) ? data.cell.text.join('') : String(data.cell.text);
          if (hasArabicFont && containsArabic(cellText)) {
            data.cell.styles.font = 'Amiri';
            data.cell.styles.fontSize = 6; // Slightly larger for Arabic readability
          }
          
          const rowIndex = data.row.index;
          
          // Style separator rows
          if (separatorRowIndices.includes(rowIndex)) {
            data.cell.styles.fillColor = [229, 231, 235]; // gray-200
            data.cell.styles.textColor = [55, 65, 81]; // gray-700
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 7;
            return;
          }
          
          // Skip first column for availability coloring
          if (data.column.index === 0) return;
          
          // Find the unit index for this row
          const unitIndex = unitToTableRowMap.findIndex((tableRow, idx) => {
            // Count separators before this unit
            const separatorsBefore = separatorRowIndices.filter(s => s <= tableRow).length;
            return tableRow === rowIndex;
          });
          
          // Alternative: calculate unit index by subtracting separator rows before this row
          const separatorsBefore = separatorRowIndices.filter(s => s < rowIndex).length;
          const actualUnitIndex = rowIndex - separatorsBefore;
          const dayIndex = data.column.index - 1;
          
          // Check if this is today's column
          const isToday = todayTableColumnIndex > 0 && data.column.index === todayTableColumnIndex;
          
          if (actualUnitIndex >= 0 && actualUnitIndex < availabilityMatrix.length && 
              dayIndex >= 0 && dayIndex < availabilityMatrix[actualUnitIndex].length) {
            const status = availabilityMatrix[actualUnitIndex][dayIndex];
            
            switch (status) {
              case 'conflict':
                data.cell.styles.fillColor = [254, 202, 202]; // red-200
                data.cell.styles.textColor = [153, 27, 27]; // red-800
                data.cell.styles.fontStyle = 'bold';
                break;
              case 'blocked':
                data.cell.styles.fillColor = [0, 0, 0]; // Pure black
                data.cell.styles.textColor = [0, 0, 0]; // Black text (invisible)
                break;
              case 'checkout':
                data.cell.styles.fillColor = [165, 180, 252]; // indigo-300
                data.cell.styles.textColor = [30, 64, 175]; // blue-800
                break;
              case 'booked':
                data.cell.styles.fillColor = [191, 219, 254]; // blue-200
                data.cell.styles.textColor = [30, 64, 175]; // blue-800
                break;
              case 'available':
                data.cell.styles.fillColor = [220, 252, 231]; // green-200
                data.cell.styles.textColor = [22, 101, 52]; // green-800
                break;
            }
          }
          
          // Add black vertical lines on sides for today's column
          if (isToday) {
            data.cell.styles.lineColor = [0, 0, 0]; // Black
            data.cell.styles.lineWidth = { top: 0, bottom: 0, left: 0.5, right: 0.5 };
          }
        }
      });

      // Add visual color legend with colored rectangles
      const finalY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Legend:', 14, finalY);
      doc.setFont('helvetica', 'normal');
      
      const legendY = finalY + 5;
      const legendSpacing = 45;
      
      // Available - green
      doc.setFillColor(220, 252, 231);
      doc.rect(14, legendY - 3, 8, 5, 'F');
      doc.setDrawColor(180, 180, 180);
      doc.rect(14, legendY - 3, 8, 5, 'S');
      doc.setFontSize(8);
      doc.text('Available', 24, legendY);
      
      // Booked - blue
      doc.setFillColor(191, 219, 254);
      doc.rect(14 + legendSpacing, legendY - 3, 8, 5, 'F');
      doc.rect(14 + legendSpacing, legendY - 3, 8, 5, 'S');
      doc.text('Booked', 24 + legendSpacing, legendY);
      
      // Checkout - indigo
      doc.setFillColor(165, 180, 252);
      doc.rect(14 + legendSpacing * 2, legendY - 3, 8, 5, 'F');
      doc.rect(14 + legendSpacing * 2, legendY - 3, 8, 5, 'S');
      doc.text('Checkout', 24 + legendSpacing * 2, legendY);
      
      // Blocked - dark gray
      doc.setFillColor(55, 65, 81);
      doc.rect(14 + legendSpacing * 3, legendY - 3, 8, 5, 'F');
      doc.rect(14 + legendSpacing * 3, legendY - 3, 8, 5, 'S');
      doc.text('Blocked', 24 + legendSpacing * 3, legendY);
      

      // Save
      const filename = `availability-calendar-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);

      toast({
        title: "Export Successful",
        description: `Calendar exported as ${filename}`,
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const exportToExcel = () => {
    if (!exportDateRange?.from || !exportDateRange?.to) return;
    
    setExporting(true);
    try {
      const exportDays = eachDayOfInterval({ start: exportDateRange.from, end: exportDateRange.to });
      
      // Prepare worksheet data
      const wsData: any[][] = [];
      
      // Title row
      const title = `Unit Availability - ${format(exportDateRange.from, 'MMM d')} to ${format(exportDateRange.to, 'MMM d, yyyy')}`;
      wsData.push([title]);
      
      // Conflict warning
      if (totalConflicts > 0) {
        wsData.push([`⚠️ ${totalConflicts} CONFLICT${totalConflicts > 1 ? 'S' : ''} DETECTED`]);
      }
      wsData.push([]); // Empty row
      
      // Headers
      const headers = ['Unit', ...exportDays.map(day => format(day, 'MMM d, yyyy'))];
      wsData.push(headers);
      
      // Data rows
      units.forEach(unit => {
        const row: any[] = [unit.name];
        exportDays.forEach(day => {
          const availability = getDayAvailability(unit, day);
          if (availability.hasConflict) {
            const guests = availability.reservations.map(r => r.guest_names[0]).join(' & ');
            row.push(`⚠️ CONFLICT: ${guests}`);
          } else if (availability.isBlocked) {
            const blockedInfo = blockedDates.find(b => 
              isSameDay(new Date(b.blocked_date), day) && 
              (b.unit_id === null || b.unit_id === unit.id)
            );
            row.push(`Blocked: ${blockedInfo?.reason || 'No reason'}`);
          } else if (!availability.isAvailable) {
            const reservation = availability.reservations[0];
            row.push(`Booked: ${reservation.guest_names[0]} (${reservation.booking_reference})`);
          } else {
            row.push('Available');
          }
        });
        wsData.push(row);
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      const colWidths = [{ wch: 30 }, ...exportDays.map(() => ({ wch: 25 }))];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Availability');

      // Save file
      const filename = `availability-calendar-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast({
        title: "Export Successful",
        description: `Calendar exported as ${filename}`,
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel file",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const totalConflicts = conflicts.size;

  return (
    <Card className={`w-full transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none overflow-auto' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Unit Availability Calendar
            </CardTitle>
            <CardDescription>
              Real-time availability across all units with conflict detection
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {totalConflicts > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {totalConflicts} Conflict{totalConflicts > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Fullscreen Header - Only date range and exit button */}
        {isFullscreen && (
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="text-lg font-semibold">
              {viewMode === 'monthly' 
                ? format(currentMonth, 'MMMM yyyy')
                : `${format(displayDays[0], 'MMM d')} - ${format(displayDays[displayDays.length - 1], 'MMM d, yyyy')}`
              }
            </span>
            <div className="flex items-center gap-2">
              {/* Desktop-only navigation arrows in fullscreen */}
              {!isMobile && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -14))}
                    title="Previous 2 weeks"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 14))}
                    title="Next 2 weeks"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen (Esc)"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Navigation - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevious}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex gap-2 items-center flex-wrap">
              {viewMode === 'weekly' && !isSameDay(currentWeekStart, startOfDay(new Date())) && (
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
              )}
              {viewMode === 'monthly' && !isSameDay(currentMonth, startOfMonth(new Date())) && (
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
              )}
              <span className="text-base font-semibold flex items-center">
                {viewMode === 'monthly' 
                  ? format(currentMonth, 'MMMM yyyy')
                  : `${format(displayDays[0], 'MMM d')} - ${format(displayDays[displayDays.length - 1], 'MMM d, yyyy')}`
                }
              </span>
            </div>
            <div className="flex gap-2 items-center">
              {!isMobile && (
                <Button variant="outline" size="sm" onClick={toggleViewMode}>
                  {viewMode === 'monthly' ? 'Weekly View' : 'Monthly View'}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleNext}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Occupancy & RevPAR Cards - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex flex-col md:flex-row gap-4 mb-4 flex-wrap items-stretch">
            {/* Occupancy Rate Card */}
            <Card 
              className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex-1 min-w-[200px] md:max-w-[300px]"
              onClick={() => setShowOccupancyModal(true)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Occupancy
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {occupancyRate.toFixed(1)}%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {bookedNights} of {totalAvailableNights} room nights
              </p>
            </Card>
            
            {/* RevPAR Card - Permission gated */}
            {hasPermission('can_view_revenue') && (
              <Card 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex-1 min-w-[200px] md:max-w-[300px]"
                onClick={() => setShowRevPARModal(true)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} RevPAR
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      ${Math.ceil(revPAR).toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Total Net Revenue: ${Math.ceil(totalRevenue).toLocaleString()}
                </p>
              </Card>
            )}
            
            {/* Spacer to push button to right */}
            <div className="flex-1" />
            
            {/* Create Reservation Button */}
            <CreateReservationDialog />
          </div>
        )}

        {/* Legend - Hidden in fullscreen */}
        {!isFullscreen && (
          <div className="flex gap-4 mb-4 text-xs flex-wrap items-center justify-between">
            <div className="flex gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded" />
                <span>Booked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted border border-border rounded" />
                <span>Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 border border-red-700 rounded animate-pulse" />
                <span className="font-medium">Double Booking Conflict</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExportClick('pdf')}
                disabled={exporting}
              >
                <FileText className="h-4 w-4 mr-1" />
                Export PDF
              </Button>
              {!isMobile && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExportClick('excel')}
                  disabled={exporting}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Export Excel
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Calendar Grid with Side Navigation */}
        <div className="flex items-stretch gap-2">
          {/* Left Arrow - Desktop only, hidden in fullscreen */}
          {!isMobile && !isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -14))}
              className="flex-shrink-0 h-auto min-h-[100px] w-10 hover:bg-muted self-center"
              title="Previous 2 weeks"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {/* Calendar Grid - Optimized for mobile touch scrolling */}
          <div 
            ref={calendarScrollRef}
            {...(isMobile ? {} : {})}
            className={`overflow-x-auto relative flex-1 ${isMobile ? 'touch-pan-x overscroll-x-contain' : ''}`}
            style={{ 
              ...(isFullscreen && { 
                maxHeight: 'calc(100vh - 80px)', 
                overflowY: 'auto' 
              }),
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <DndContext sensors={effectiveSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <TooltipProvider>
              <div className="min-w-max">
                {/* Header Row - Sticky */}
                <div className={`grid gap-1 mb-2 pb-1 ${isFullscreen ? 'sticky top-0 z-20 bg-card' : ''}`} style={{ gridTemplateColumns: `${isMobile ? 64 : 160}px repeat(${displayDays.length}, 70px)` }}>
                  <div className="font-medium text-sm p-2 sticky left-0 bg-card z-30 border-r border-border">Unit</div>
                  {displayDays.map((day) => {
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={`text-center text-xs p-2 rounded ${
                          isToday
                            ? 'bg-primary text-primary-foreground font-semibold border-l-2 border-r-2 border-t-2 border-primary'
                            : 'bg-card text-muted-foreground'
                        }`}
                      >
                        <div>{format(day, 'EEE')}</div>
                        <div className="font-medium">{format(day, 'd')}</div>
                        <div className="text-[10px]">{format(day, 'MMM')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Unit Rows */}
                {units.map((unit, index) => {
                  const currentRoomType = unit.booking_com_name || unit.name;
                  const previousUnit = index > 0 ? units[index - 1] : null;
                  const previousRoomType = previousUnit ? (previousUnit.booking_com_name || previousUnit.name) : null;
                  const showSeparator = sortByRoomType && (index === 0 || currentRoomType !== previousRoomType);
                  const roomTypeCount = units.filter(u => (u.booking_com_name || u.name) === currentRoomType).length;

                  return (
                    <div key={unit.id}>
                      {/* Room type separator - full-width, sticky pill on the left */}
                      {showSeparator && (
                        <div className="grid grid-cols-1 mb-1 border-y border-border">
                          <div className="flex items-center gap-2 py-2 px-2 sticky left-0 z-20 bg-muted w-fit max-w-full">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                              {currentRoomType}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ({roomTypeCount})
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Room row */}
                      <DroppableUnitRow unit={unit}>
                    <div
                      className={`grid gap-1 mb-1 ${isMobile ? 'touch-manipulation' : ''}`}
                      style={{ gridTemplateColumns: `${isMobile ? 64 : 160}px repeat(${displayDays.length}, 70px)` }}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-20 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors">
                            <div>
                              <div className="hidden sm:block text-primary hover:underline">
                                {unit.booking_com_name || unit.name}
                              </div>
                              <div className="text-sm font-semibold sm:text-xs sm:font-normal sm:text-muted-foreground">
                                <span className="sm:hidden">{unit.unit_number}</span>
                                <span className="hidden sm:inline">#{unit.unit_number}</span>
                              </div>
                            </div>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" className="w-auto p-3">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Room Name: </span>
                            <span className="font-medium">{unit.booking_com_name || unit.name}</span>
                          </div>
                        </PopoverContent>
                      </Popover>
                      {displayDays.map((day) => {
                        const availability = getDayAvailability(unit, day);
                        const blockedInfo = blockedDates.filter(b => 
                          isSameDay(new Date(b.blocked_date), day) && 
                          (b.unit_id === null || b.unit_id === unit.id)
                        );
                        const reservation = availability.reservations[0];
                        const isDraggable = !isMobile && !availability.isAvailable && !availability.hasConflict && !availability.isBlocked && reservation;
                        
                        const isToday = isSameDay(day, new Date());
                        const todayBorderClass = isToday ? 'border-l-2 border-r-2 border-primary' : '';
                        
                        return (
                          <Tooltip key={day.toISOString()}>
                            <TooltipTrigger asChild>
                              {/* Turnover day - split cell */}
                              {availability.isTurnoverDay && availability.checkingOutReservation && availability.checkingInReservation ? (
                                <div className={todayBorderClass}>
                                  <SplitTurnoverCell
                                    checkingOutReservation={availability.checkingOutReservation}
                                    checkingInReservation={availability.checkingInReservation}
                                    onClick={() => handleCellClick(availability, unit, day)}
                                  />
                                </div>
                              ) : availability.isAvailableForTurnover && availability.checkingOutReservation ? (
                                /* Checkout-only cell - available for same-day turnover */
                                <div
                                  className={`h-14 border rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all border-emerald-300 dark:border-emerald-700 ${todayBorderClass}`}
                                  onClick={() => handleCellClick(availability, unit, day)}
                                >
                                {/* Top half - departing guest with blue styling */}
                                  <div className="h-1/2 bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center border-b border-emerald-300 dark:border-emerald-700 px-1 overflow-hidden relative">
                                    <span className="text-[9px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight truncate">
                                      {availability.checkingOutReservation.guest_names[0]}
                                    </span>
                                    {availability.checkingOutReservation.source?.toLowerCase().includes('booking') && (
                                      <span className="absolute bottom-0 right-0 text-[5px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                                        B.com
                                      </span>
                                    )}
                                  </div>
                                  {/* Bottom half - available indicator */}
                                  <div className="h-1/2 bg-green-700/85 dark:bg-green-600/85 flex items-center justify-center gap-0.5">
                                    <CheckCircle className="h-2.5 w-2.5 text-white" />
                                    <span className="text-[8px] text-white font-semibold">FREE</span>
                                  </div>
                                </div>
                              ) : isDraggable ? (
                                <div className={todayBorderClass}>
                                  <DraggableReservationCell
                                    reservation={reservation}
                                    availability={availability}
                                    unit={unit}
                                    getCellClassName={getCellClassName}
                                    onClick={() => handleCellClick(availability, unit, day)}
                                    isExtended={isExtensionReservation(reservation)}
                                    isCheckIn={isSameDay(new Date(reservation.check_in_date), day)}
                                  />
                                </div>
                              ) : (
                                <div
                                  className={`h-14 border rounded transition-colors ${getCellClassName(availability)} ${todayBorderClass}`}
                                  onClick={() => handleCellClick(availability, unit, day)}
                                >
                                  {availability.hasConflict ? (
                                    <div className="flex items-center justify-center h-full">
                                      <AlertCircle className="h-4 w-4 text-white" />
                                    </div>
                                  ) : availability.isBlocked ? (
                                    <div className="flex items-center justify-center h-full px-1 overflow-hidden">
                                      <span className="text-[10px] font-medium text-muted-foreground">Blocked</span>
                                    </div>
                                  ) : reservation ? (
                                    <div className="flex flex-col items-center justify-center h-full px-1 overflow-hidden relative">
                                      {isExtensionReservation(reservation) && (
                                        <span className="absolute top-0 right-0 text-[6px] bg-purple-500 text-white px-0.5 rounded-bl font-semibold leading-tight">
                                          EXT
                                        </span>
                                      )}
                                      {isSameDay(new Date(reservation.check_in_date), day) && !isExtensionReservation(reservation) && (
                                        <span className="absolute top-0 right-0 text-[6px] bg-emerald-600 text-white px-0.5 rounded-bl font-semibold leading-tight">
                                          CHECK IN
                                        </span>
                                      )}
                                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
                                        {reservation.guest_names[0]?.split(' ')[0]}
                                      </span>
                                      {reservation.guest_names[0]?.split(' ').slice(1).join(' ') && (
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
                                          {reservation.guest_names[0]?.split(' ').slice(1).join(' ')}
                                        </span>
                                      )}
                                      {reservation.source?.toLowerCase().includes('booking') && (
                                        <span className="absolute bottom-0 right-0 text-[6px] bg-[#003580] text-white px-0.5 rounded-tl font-medium leading-tight">
                                          booking.com
                                        </span>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-medium">{format(day, 'MMM d, yyyy')}</div>
                            {availability.isExtensionContinuation && availability.extensionReservation ? (
                                  <div>
                                    <div className="text-blue-500 font-semibold">Extension Continues</div>
                                    <div className="text-xs mt-1">
                                      {availability.extensionReservation.guest_names[0]} - Same room extension
                                    </div>
                                  </div>
                                ) : availability.isTurnoverDay && availability.checkingOutReservation && availability.checkingInReservation ? (
                                  <div>
                                    <div className="text-orange-500 font-semibold">Turnover Day</div>
                                    <div className="text-xs mt-1 text-orange-600 dark:text-orange-400">
                                      ↑ OUT: {availability.checkingOutReservation.guest_names[0]}
                                    </div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400">
                                      ↓ IN: {availability.checkingInReservation.guest_names[0]}
                                    </div>
                                  </div>
                              ) : availability.isAvailableForTurnover && availability.checkingOutReservation ? (
                                  <div>
                                    <div className="text-orange-500 dark:text-orange-400">
                                      ↑ Checkout: {availability.checkingOutReservation.guest_names[0]}
                                    </div>
                                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Available for same-day check-in
                                    </div>
                                  </div>
                                ) : availability.hasConflict ? (
                                  <div className="text-red-500 font-semibold">
                                    ⚠️ DOUBLE BOOKING CONFLICT!
                                    <div className="mt-1">
                                      {availability.reservations.map((r, idx) => (
                                        <div key={idx} className="text-xs">
                                          • {r.guest_names[0]} ({r.booking_reference})
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : availability.isBlocked ? (
                                  <div className="text-muted-foreground">
                                    <div>Blocked</div>
                                    {blockedInfo.map((b) => (
                                      <div key={b.id} className="text-xs mt-1">
                                        {b.reason || 'No reason provided'}
                                      </div>
                                    ))}
                                  </div>
                                ) : availability.isAvailable ? (
                                  <div className="text-green-600 dark:text-green-400">Available</div>
                                ) : (
                                  <div>
                                    <div className="text-blue-600 dark:text-blue-400">{isMobile ? 'Booked' : 'Booked (drag to move)'}</div>
                                    {availability.reservations.map((r, idx) => (
                                      <div key={idx} className="text-xs mt-1">
                                        {r.guest_names[0]}
                                        {isExtensionReservation(r) && (
                                          <span className="ml-1 text-purple-500 font-semibold">(Extended Stay)</span>
                                        )}
                                        <br />
                                        {r.booking_reference}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </DroppableUnitRow>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>

            {/* Drag Overlay */}
            <DragOverlay>
              {activeReservation && (
                <div className="h-14 w-16 border rounded bg-blue-500 text-white flex flex-col items-center justify-center shadow-lg opacity-90">
                  <span className="text-[10px] font-medium text-center px-1">
                    {activeReservation.guest_names[0].split(' ')[0]}
                  </span>
                </div>
              )}
            </DragOverlay>
            </DndContext>
          </div>

          {/* Right Arrow - Desktop only, hidden in fullscreen */}
          {!isMobile && !isFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 14))}
              className="flex-shrink-0 h-auto min-h-[100px] w-10 hover:bg-muted self-center"
              title="Next 2 weeks"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        {units.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No units found. Add units to see availability.
          </div>
        )}
      </CardContent>

      <ReservationQuickActions
        open={quickActionsOpen}
        onOpenChange={setQuickActionsOpen}
        reservation={selectedReservation}
        currentUnit={selectedUnit}
        onMoveComplete={handleMoveComplete}
      />

      {/* Blocked Date Info Dialog */}
      <Dialog open={blockedDateDialogOpen} onOpenChange={setBlockedDateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              Blocked Period
            </DialogTitle>
          </DialogHeader>
          {selectedBlockedDateInfo && (
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-muted-foreground text-xs">Room</Label>
                <p className="font-medium text-lg">
                  {selectedBlockedDateInfo.unitName} #{selectedBlockedDateInfo.unitNumber}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Date Range</Label>
                <p className="font-medium">
                  {format(parseISO(selectedBlockedDateInfo.startDate), 'MMM d, yyyy')} - {format(parseISO(selectedBlockedDateInfo.endDate), 'MMM d, yyyy')}
                  <span className="text-muted-foreground ml-2">
                    ({selectedBlockedDateInfo.daysCount} {selectedBlockedDateInfo.daysCount === 1 ? 'day' : 'days'})
                  </span>
                </p>
              </div>
            <div>
                <Label className="text-muted-foreground text-xs">Reason</Label>
                <p className="font-medium">
                  {selectedBlockedDateInfo.reason || 'No reason provided'}
                </p>
              </div>
              
              <Button
                variant="destructive"
                className="w-full mt-4"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Blocked Dates
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blocked Dates?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedBlockedDateInfo?.daysCount} blocked date{selectedBlockedDateInfo?.daysCount !== 1 ? 's' : ''} for {selectedBlockedDateInfo?.unitName}
              {selectedBlockedDateInfo?.unitNumber ? ` (Room #${selectedBlockedDateInfo.unitNumber})` : ''}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBlockedDates}
              disabled={deletingBlockedDates}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingBlockedDates ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Export Date Range Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {exportType === 'pdf' ? <FileText className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
              Export {exportType === 'pdf' ? 'PDF' : 'Excel'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Date Range</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const lastMonth = addMonths(new Date(), -1);
                    setExportDateRange({
                      from: startOfMonth(lastMonth),
                      to: endOfMonth(lastMonth)
                    });
                  }}
                >
                  {format(addMonths(new Date(), -1), 'MMMM')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportDateRange({
                      from: startOfMonth(new Date()),
                      to: endOfMonth(new Date())
                    });
                  }}
                >
                  {format(new Date(), 'MMMM')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextMonth = addMonths(new Date(), 1);
                    setExportDateRange({
                      from: startOfMonth(nextMonth),
                      to: endOfMonth(nextMonth)
                    });
                  }}
                >
                  {format(addMonths(new Date(), 1), 'MMMM')}
                </Button>
              </div>
              {exportDateRange?.from && exportDateRange?.to && (
                <p className="text-sm text-muted-foreground mb-2">
                  {format(exportDateRange.from, 'MMM d, yyyy')} - {format(exportDateRange.to, 'MMM d, yyyy')}
                </p>
              )}
            </div>
            
            <div className="flex justify-center border rounded-lg p-2">
              <Calendar
                mode="range"
                selected={exportDateRange}
                onSelect={setExportDateRange}
                numberOfMonths={1}
                className="pointer-events-auto"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleExportConfirm}
                disabled={!exportDateRange?.from || !exportDateRange?.to || exporting}
              >
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Occupancy Breakdown Modal */}
      <Dialog open={showOccupancyModal} onOpenChange={setShowOccupancyModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0 pr-8">
            <DialogTitle>
              {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Occupancy Breakdown
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 pt-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-2xl font-bold text-primary">{occupancyRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Overall Occupancy</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{bookedNights}</p>
                <p className="text-xs text-muted-foreground">Booked Nights</p>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{totalAvailableNights}</p>
                <p className="text-xs text-muted-foreground">Available Nights</p>
              </div>
            </div>
            
            {/* Per-Unit Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Unit</th>
                    <th className="text-right py-2 px-3 font-medium">Booked</th>
                    <th className="text-right py-2 px-3 font-medium">Available</th>
                    <th className="text-right py-2 px-3 font-medium">Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {unitMetrics.map(unit => (
                    <tr key={unit.unitId} className="border-t">
                      <td className="py-2 px-3">{unit.unitNumber} - {unit.unitName}</td>
                      <td className="text-right py-2 px-3">{unit.bookedNights}</td>
                      <td className="text-right py-2 px-3">{unit.availableNights}</td>
                      <td className="text-right py-2 px-3 font-medium">
                        {unit.occupancyRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* RevPAR Breakdown Modal */}
      <Dialog open={showRevPARModal} onOpenChange={setShowRevPARModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0 pr-8">
            <DialogTitle>
              {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} RevPAR Breakdown
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto flex-1 pt-4 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-2 md:gap-4">
              <div className="text-center p-2 md:p-3 bg-muted rounded-lg">
                <p className="text-lg md:text-2xl font-bold">
                  ${bookedNights > 0 ? Math.ceil(totalRevenue / bookedNights).toLocaleString() : '0'}
                </p>
                <p className="text-xs text-muted-foreground">ADR</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted rounded-lg">
                <p className="text-lg md:text-2xl font-bold">${Math.ceil(revPAR).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">RevPAR</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted rounded-lg">
                <p className="text-lg md:text-2xl font-bold">${formatCompactNumber(Math.ceil(totalRevenue))}</p>
                <p className="text-xs text-muted-foreground">Net Revenue</p>
              </div>
              <div className="text-center p-2 md:p-3 bg-muted rounded-lg">
                <p className="text-lg md:text-2xl font-bold">${formatCompactNumber(Math.ceil(totalGrossRevenue))}</p>
                <p className="text-xs text-muted-foreground">Gross Revenue</p>
              </div>
            </div>
            
            {/* Per-Unit Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Unit</th>
                    <th className="text-right py-2 px-1 md:px-3 font-medium text-xs md:text-sm">NetRev</th>
                    <th className="text-right py-2 px-1 md:px-3 font-medium text-xs md:text-sm">Nights</th>
                    <th className="text-right py-2 px-1 md:px-3 font-medium text-xs md:text-sm">ADR</th>
                    <th className="text-right py-2 px-1 md:px-3 font-medium text-xs md:text-sm">RevPAR</th>
                  </tr>
                </thead>
                <tbody>
                  {unitMetrics.map(unit => (
                    <tr key={unit.unitId} className="border-t">
                      <td className="py-2 px-3">{unit.unitNumber} - {unit.unitName}</td>
                      <td className="text-right py-2 px-1 md:px-3 text-xs md:text-sm">
                        ${isMobile ? formatCompactNumber(Math.ceil(unit.netRevenue)) : Math.ceil(unit.netRevenue).toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-1 md:px-3 text-xs md:text-sm">{unit.bookedNights}</td>
                      <td className="text-right py-2 px-1 md:px-3 text-xs md:text-sm">
                        ${unit.bookedNights > 0 
                          ? (isMobile 
                              ? formatCompactNumber(Math.ceil(unit.netRevenue / unit.bookedNights)) 
                              : Math.ceil(unit.netRevenue / unit.bookedNights).toLocaleString()
                            ) 
                          : '0'}
                      </td>
                      <td className="text-right py-2 px-1 md:px-3 font-medium text-xs md:text-sm">
                        ${isMobile ? formatCompactNumber(Math.ceil(unit.revPAR)) : Math.ceil(unit.revPAR).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

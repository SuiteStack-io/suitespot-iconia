import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Calendar as CalendarIcon, Download, FileSpreadsheet, FileText, GripVertical, ArrowUpDown, Hash, Building2, Lock, Maximize2, Minimize2 } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, getDaysInMonth, eachDayOfInterval, startOfDay, differenceInDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ReservationQuickActions } from "./ReservationQuickActions";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeable } from "react-swipeable";

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
}


type ViewMode = 'weekly' | 'monthly';

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
}: {
  reservation: Reservation;
  availability: DayAvailability;
  unit: Unit;
  getCellClassName: (availability: DayAvailability) => string;
  onClick: () => void;
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
      <div className="flex flex-col items-center justify-center h-full px-1 overflow-hidden">
        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
          {firstName}
        </span>
        {lastName && (
          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
            {lastName}
          </span>
        )}
      </div>
    </div>
  );
};

export const AvailabilityCalendar = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
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
  const [selectedLocation, setSelectedLocation] = useState<'ICONIA' | 'Almaza Bay'>('ICONIA');
  const [iconiaCount, setIconiaCount] = useState(0);
  const [almazaBayCount, setAlmazaBayCount] = useState(0);
  const [sortByRoomType, setSortByRoomType] = useState<boolean>(() => {
    const saved = localStorage.getItem('calendarSortByRoomType');
    return saved === null ? true : saved === 'true';
  });
  const [blockedDateDialogOpen, setBlockedDateDialogOpen] = useState(false);
  const [selectedBlockedDateInfo, setSelectedBlockedDateInfo] = useState<{
    unitName: string;
    unitNumber: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    daysCount: number;
  } | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel'>('pdf');
  const [exportDateRange, setExportDateRange] = useState<DateRange | undefined>(undefined);
  const navigate = useNavigate();
  const { toast, dismiss } = useToast();
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Swipe handlers for mobile navigation
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
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const displayDays = viewMode === 'monthly' 
    ? eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
    : Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  useEffect(() => {
    localStorage.setItem('calendarViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('calendarSortByRoomType', String(sortByRoomType));
  }, [sortByRoomType]);

  const fetchUnitCounts = async () => {
    const { count: iconiaTotal } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('location', 'ICONIA')
      .eq('status', 'available');
    
    const { count: almazaTotal } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('location', 'Almaza Bay')
      .eq('status', 'available');
    
    setIconiaCount(iconiaTotal || 0);
    setAlmazaBayCount(almazaTotal || 0);
  };

  useEffect(() => {
    fetchUnitCounts();
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
  }, [currentWeekStart, currentMonth, viewMode, selectedLocation, sortByRoomType]);

  const fetchData = async () => {
    // Fetch units filtered by location
    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('status', 'available')
      .eq('location', selectedLocation);

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

    const { data: reservationsData } = await supabase
      .from('reservations')
      .select('*')
      .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
      .or(`and(check_in_date.lte.${endDate},check_out_date.gte.${startDate})`);

    if (reservationsData) {
      setReservations(reservationsData);
      detectConflicts(reservationsData);
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
    
    // Group by unit and date
    const bookingsByUnitDate = new Map<string, Reservation[]>();
    
    reservationsList.forEach(reservation => {
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

    const conflictKey = `${unit.id}-${dateKey}`;
    const hasConflict = conflicts.has(conflictKey);

    return {
      date,
      isAvailable: dayReservations.length === 0 && !isBlocked,
      hasConflict,
      isBlocked,
      reservations: dayReservations,
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
      unitName: unit.booking_com_name || unit.name,
      unitNumber: unit.unit_number || '',
      startDate: blockInfo.startDate,
      endDate: blockInfo.endDate,
      reason: blockInfo.reason,
      daysCount: blockInfo.daysCount,
    });
    setBlockedDateDialogOpen(true);
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
      const guestName = reservation.guest_names[0] || 'Guest';

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
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      const pageWidth = doc.internal.pageSize.width;
      
      const exportDays = eachDayOfInterval({ start: exportDateRange.from, end: exportDateRange.to });
      
      // Fetch reservations specifically for the export date range
      const startDate = format(exportDateRange.from, 'yyyy-MM-dd');
      const endDate = format(exportDateRange.to, 'yyyy-MM-dd');
      
      const { data: exportReservations } = await supabase
        .from('reservations')
        .select('*')
        .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
        .lte('check_in_date', endDate)
        .gte('check_out_date', startDate);
      
      // Local function to get availability using fetched export data
      const getExportDayAvailability = (unit: Unit, date: Date): DayAvailability => {
        const isBlocked = isDateBlocked(date, unit.id);
        
        const dayReservations = (exportReservations || []).filter((r: Reservation) => {
          if (r.unit_id !== unit.id) return false;
          const checkIn = new Date(r.check_in_date);
          const checkOut = new Date(r.check_out_date);
          const isCheckInDay = isSameDay(date, checkIn);
          const isStayingDay = date > checkIn && date < checkOut;
          const isCheckoutDayForCompleted = 
            (r.status === 'completed' || r.status === 'checked-out') && 
            isSameDay(date, checkOut);
          return isCheckInDay || isStayingDay || isCheckoutDayForCompleted;
        });

        const hasConflict = dayReservations.length > 1;

        return {
          date,
          isAvailable: dayReservations.length === 0 && !isBlocked,
          hasConflict,
          isBlocked,
          reservations: dayReservations,
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
      
      // Title and date range (next to logo)
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Unit Availability Calendar', 45, 16);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
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

      // Prepare table data with booking.com name + room number
      // Format dates as multi-line: Day of week, Day number, Month
      const headers = ['Room', ...exportDays.map(day => 
        `${format(day, 'EEE')}\n${format(day, 'd')}\n${format(day, 'MMM')}`
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
          if (!availability.isAvailable) return 'booked';
          return 'available';
        });
      });
      
      // Build table data with room type separator rows
      const tableData: string[][] = [];
      const separatorRowIndices: number[] = [];
      let currentRoomType = '';
      
      sortedUnits.forEach((unit, unitIndex) => {
        const roomType = unit.booking_com_name || unit.name || 'Unknown';
        
        // Add separator row when room type changes
        if (roomType !== currentRoomType) {
          const roomCount = sortedUnits.filter(u => (u.booking_com_name || u.name) === roomType).length;
          const separatorRow = [`${roomType} (${roomCount} room${roomCount > 1 ? 's' : ''})`, ...exportDays.map(() => '')];
          separatorRowIndices.push(tableData.length);
          tableData.push(separatorRow);
          currentRoomType = roomType;
        }
        
        // Room row: room number only (since room type is in separator)
        const roomNumber = unit.unit_number ? `#${unit.unit_number}` : unit.name;
        const row = [roomNumber];
        
        // Date columns: show guest names, "Blocked", or empty for available
        exportDays.forEach((day) => {
          const availability = getExportDayAvailability(unit, day);
          if (availability.hasConflict) {
            const guests = availability.reservations.map(r => r.guest_names?.[0] || 'Guest').join(' & ');
            row.push(guests);
          } else if (availability.isBlocked) {
            row.push('Blocked');
          } else if (!availability.isAvailable && availability.reservations.length > 0) {
            const guestName = availability.reservations[0]?.guest_names?.[0] || 'Booked';
            row.push(guestName);
          } else {
            row.push('');
          }
        });
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
          fontSize: 6, 
          cellPadding: 1.5,
          halign: 'center',
          valign: 'middle',
          minCellHeight: 8,
          overflow: 'ellipsize',
        },
        headStyles: { 
          fillColor: [55, 65, 81], // gray-700
          textColor: 255,
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          cellPadding: 2,
          minCellHeight: 14, // Taller to fit 3 lines (EEE\nd\nMMM)
        },
        columnStyles: {
          0: { 
            fontStyle: 'bold', 
            cellWidth: 45,
            halign: 'left',
            fontSize: 7,
          }
        },
        didParseCell: (data) => {
          if (data.section === 'head') return;
          
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
                data.cell.styles.fillColor = [55, 65, 81]; // gray-700
                data.cell.styles.textColor = [255, 255, 255];
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
      
      // Blocked - dark gray
      doc.setFillColor(55, 65, 81);
      doc.rect(14 + legendSpacing * 2, legendY - 3, 8, 5, 'F');
      doc.rect(14 + legendSpacing * 2, legendY - 3, 8, 5, 'S');
      doc.text('Blocked', 24 + legendSpacing * 2, legendY);
      
      // Conflict - red
      doc.setFillColor(254, 202, 202);
      doc.rect(14 + legendSpacing * 3, legendY - 3, 8, 5, 'F');
      doc.rect(14 + legendSpacing * 3, legendY - 3, 8, 5, 'S');
      doc.text('⚠️ Conflict', 24 + legendSpacing * 3, legendY);

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
        <Tabs 
          value={selectedLocation} 
          onValueChange={(value) => setSelectedLocation(value as 'ICONIA' | 'Almaza Bay')}
          className="mt-4"
        >
          <TabsList>
            <TabsTrigger value="ICONIA">
              ICONIA <span className="ml-1.5 text-xs opacity-70">({iconiaCount})</span>
            </TabsTrigger>
            <TabsTrigger value="Almaza Bay">
              Almaza Bay <span className="ml-1.5 text-xs opacity-70">({almazaBayCount})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {/* Navigation */}
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
            <Button variant="outline" size="sm" onClick={toggleViewMode}>
              {viewMode === 'monthly' ? 'Weekly View' : 'Monthly View'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
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

        {/* Calendar Grid with Side Navigation */}
        <div className="flex items-stretch gap-2">
          {/* Left Arrow - Desktop only */}
          {!isMobile && (
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

          {/* Calendar Grid */}
          <div 
            className="overflow-auto relative flex-1" 
            style={{ maxHeight: 'calc(100vh - 320px)' }}
          >
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <TooltipProvider>
              <div className="min-w-max">
                {/* Header Row - Sticky */}
                <div className="grid gap-1 mb-2 sticky top-0 z-20 bg-card pb-1" style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 70px)` }}>
                  <div className="font-medium text-sm p-2 sticky left-0 bg-card z-30 border-r border-border">Unit</div>
                  {displayDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className={`text-center text-xs p-2 rounded ${
                        isSameDay(day, new Date())
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-card text-muted-foreground'
                      }`}
                    >
                      <div>{format(day, 'EEE')}</div>
                      <div className="font-medium">{format(day, 'd')}</div>
                      <div className="text-[10px]">{format(day, 'MMM')}</div>
                    </div>
                  ))}
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
                      {/* Room type separator - with sticky first cell */}
                      {showSeparator && (
                        <div 
                          className="grid gap-1 mb-1 bg-muted/50 border-y border-border"
                          style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 70px)` }}
                        >
                          {/* Sticky first cell with separator content */}
                          <div className="flex items-center gap-2 py-2 px-2 sticky left-0 z-10 bg-muted/50">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold text-muted-foreground truncate">
                              {currentRoomType}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ({roomTypeCount})
                            </span>
                          </div>
                          {/* Empty cells for the rest of the grid */}
                          {displayDays.map((day) => (
                            <div key={day.toISOString()} className="py-2" />
                          ))}
                        </div>
                      )}
                      {/* Room row - Swipeable on mobile */}
                      <DroppableUnitRow unit={unit}>
                    <div
                      {...(isMobile ? swipeHandlers : {})}
                      className="grid gap-1 mb-1"
                      style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 70px)` }}
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-10 border-r border-border cursor-pointer hover:bg-muted/50 transition-colors">
                            <div>
                              <div className="text-primary hover:underline">
                                {unit.booking_com_name || unit.name}
                              </div>
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
                      {displayDays.map((day) => {
                        const availability = getDayAvailability(unit, day);
                        const blockedInfo = blockedDates.filter(b => 
                          isSameDay(new Date(b.blocked_date), day) && 
                          (b.unit_id === null || b.unit_id === unit.id)
                        );
                        const reservation = availability.reservations[0];
                        const isDraggable = !availability.isAvailable && !availability.hasConflict && !availability.isBlocked && reservation;
                        
                        return (
                          <Tooltip key={day.toISOString()}>
                            <TooltipTrigger asChild>
                              {isDraggable ? (
                                <DraggableReservationCell
                                  reservation={reservation}
                                  availability={availability}
                                  unit={unit}
                                  getCellClassName={getCellClassName}
                                  onClick={() => handleCellClick(availability, unit, day)}
                                />
                              ) : (
                                <div
                                  className={`h-14 border rounded transition-colors ${getCellClassName(availability)}`}
                                  onClick={() => handleCellClick(availability, unit, day)}
                                >
                                  {availability.hasConflict && (
                                    <div className="flex items-center justify-center h-full">
                                      <AlertCircle className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                  {availability.isBlocked && !availability.hasConflict && (
                                    <div className="flex items-center justify-center h-full px-1 overflow-hidden">
                                      <span className="text-[10px] font-medium text-muted-foreground">Blocked</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-medium">{format(day, 'MMM d, yyyy')}</div>
                                {availability.hasConflict ? (
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
                                    <div className="text-blue-600 dark:text-blue-400">Booked (drag to move)</div>
                                    {availability.reservations.map((r, idx) => (
                                      <div key={idx} className="text-xs mt-1">
                                        {r.guest_names[0]}
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

          {/* Right Arrow - Desktop only */}
          {!isMobile && (
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
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </Card>
  );
};

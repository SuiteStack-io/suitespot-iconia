import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Calendar as CalendarIcon, Download, FileSpreadsheet, FileText } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, startOfMonth, endOfMonth, getDaysInMonth, eachDayOfInterval, startOfDay } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ReservationQuickActions } from "./ReservationQuickActions";

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  status: string;
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
  const navigate = useNavigate();
  const { toast } = useToast();

  const displayDays = viewMode === 'monthly' 
    ? eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
    : Array.from({ length: 14 }, (_, i) => addDays(currentWeekStart, i));

  useEffect(() => {
    localStorage.setItem('calendarViewMode', viewMode);
  }, [viewMode]);

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
  }, [currentWeekStart, currentMonth, viewMode]);

  const fetchData = async () => {
    // Fetch units
    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('status', 'available')
      .order('unit_number');

    if (unitsData) setUnits(unitsData);

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
      .in('status', ['confirmed', 'checked-in', 'checked-out'])
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
      return isCheckInDay || isStayingDay;
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
      return "bg-muted text-muted-foreground border border-border cursor-default";
    }
    if (!availability.isAvailable) {
      return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/40 cursor-pointer";
    }
    return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40";
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

  const handleCellClick = (availability: DayAvailability, unit: Unit) => {
    if (availability.isBlocked || availability.reservations.length === 0) {
      return;
    }
    setSelectedReservation(availability.reservations[0]);
    setSelectedUnit(unit);
    setQuickActionsOpen(true);
  };

  const handleMoveComplete = () => {
    fetchData();
  };

  const exportToPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape orientation
      
      const title = viewMode === 'monthly' 
        ? `Unit Availability - ${format(currentMonth, 'MMMM yyyy')}`
        : `Unit Availability - ${format(displayDays[0], 'MMM d')} to ${format(displayDays[displayDays.length - 1], 'MMM d, yyyy')}`;
      
      // Title
      doc.setFontSize(16);
      doc.text(title, 14, 15);
      
      // Add conflict warning if any
      if (totalConflicts > 0) {
        doc.setFontSize(10);
        doc.setTextColor(255, 0, 0);
        doc.text(`⚠️ ${totalConflicts} CONFLICT${totalConflicts > 1 ? 'S' : ''} DETECTED`, 14, 22);
        doc.setTextColor(0, 0, 0);
      }

      // Prepare table data
      const headers = ['Unit', ...displayDays.map(day => format(day, 'MMM d'))];
      const tableData = units.map(unit => {
        const row = [unit.name];
        displayDays.forEach(day => {
          const availability = getDayAvailability(unit, day);
          if (availability.hasConflict) {
            row.push('⚠️ CONFLICT');
          } else if (availability.isBlocked) {
            row.push('Blocked');
          } else if (!availability.isAvailable) {
            row.push('Booked');
          } else {
            row.push('Available');
          }
        });
        return row;
      });

      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: totalConflicts > 0 ? 25 : 20,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [66, 66, 66], textColor: 255 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 }
        },
        didParseCell: (data) => {
          if (data.cell.text[0] === '⚠️ CONFLICT') {
            data.cell.styles.fillColor = [220, 38, 38];
            data.cell.styles.textColor = 255;
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.text[0] === 'Blocked') {
            data.cell.styles.fillColor = [30, 30, 30];
            data.cell.styles.textColor = 255;
          } else if (data.cell.text[0] === 'Booked') {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.textColor = [30, 64, 175];
          } else if (data.cell.text[0] === 'Available') {
            data.cell.styles.fillColor = [240, 253, 244];
            data.cell.styles.textColor = [22, 101, 52];
          }
        }
      });

      // Add legend
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(8);
      doc.text('Legend:', 14, finalY);
      doc.text('• Available: Room is free', 14, finalY + 5);
      doc.text('• Booked: Room is occupied', 14, finalY + 10);
      doc.text('• Blocked: Room is unavailable for booking', 14, finalY + 15);
      doc.text('• ⚠️ CONFLICT: Double booking detected', 14, finalY + 20);

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
    setExporting(true);
    try {
      // Prepare worksheet data
      const wsData: any[][] = [];
      
      // Title row
      const title = viewMode === 'monthly' 
        ? `Unit Availability - ${format(currentMonth, 'MMMM yyyy')}`
        : `Unit Availability - ${format(displayDays[0], 'MMM d')} to ${format(displayDays[displayDays.length - 1], 'MMM d, yyyy')}`;
      wsData.push([title]);
      
      // Conflict warning
      if (totalConflicts > 0) {
        wsData.push([`⚠️ ${totalConflicts} CONFLICT${totalConflicts > 1 ? 'S' : ''} DETECTED`]);
      }
      wsData.push([]); // Empty row
      
      // Headers
      const headers = ['Unit', ...displayDays.map(day => format(day, 'MMM d, yyyy'))];
      wsData.push(headers);
      
      // Data rows
      units.forEach(unit => {
        const row: any[] = [unit.name];
        displayDays.forEach(day => {
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
      const colWidths = [{ wch: 30 }, ...displayDays.map(() => ({ wch: 25 }))];
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Unit Availability Calendar
            </CardTitle>
            <CardDescription>
              Real-time availability across all units with conflict detection
            </CardDescription>
          </div>
          {totalConflicts > 0 && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {totalConflicts} Conflict{totalConflicts > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToPDF}
              disabled={exporting}
            >
              <FileText className="h-4 w-4 mr-1" />
              Export PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToExcel}
              disabled={exporting}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto relative">
          <TooltipProvider>
            <div className="min-w-max">
              {/* Header Row */}
              <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 70px)` }}>
                <div className="font-medium text-sm p-2 sticky left-0 bg-card z-10 border-r border-border">Unit</div>
                {displayDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`text-center text-xs p-2 rounded ${
                      isSameDay(day, new Date())
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className="font-medium">{format(day, 'd')}</div>
                    <div className="text-[10px]">{format(day, 'MMM')}</div>
                  </div>
                ))}
              </div>

              {/* Unit Rows */}
              {units.map((unit) => (
                <div
                  key={unit.id}
                  className="grid gap-1 mb-1"
                  style={{ gridTemplateColumns: `160px repeat(${displayDays.length}, 70px)` }}
                >
                  <div className="flex items-center text-sm font-medium p-2 bg-card rounded sticky left-0 z-10 border-r border-border">
                    <div>
                      <div>{unit.name}</div>
                      <div className="text-xs text-muted-foreground">#{unit.unit_number}</div>
                    </div>
                  </div>
                  {displayDays.map((day) => {
                    const availability = getDayAvailability(unit, day);
                    const blockedInfo = blockedDates.filter(b => 
                      isSameDay(new Date(b.blocked_date), day) && 
                      (b.unit_id === null || b.unit_id === unit.id)
                    );
                    
                    return (
                      <Tooltip key={day.toISOString()}>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-14 border rounded transition-colors ${getCellClassName(availability)}`}
                            onClick={() => handleCellClick(availability, unit)}
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
                            {!availability.isAvailable && !availability.hasConflict && !availability.isBlocked && (
                              <div className="flex flex-col items-center justify-center h-full px-1 overflow-hidden">
                                {(() => {
                                  const fullName = availability.reservations[0]?.guest_names[0] || '';
                                  const nameParts = fullName.split(' ');
                                  const firstName = nameParts[0];
                                  const lastName = nameParts.slice(1).join(' ');
                                  return (
                                    <>
                                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
                                        {firstName}
                                      </span>
                                      {lastName && (
                                        <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium text-center leading-tight">
                                          {lastName}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
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
                                <div className="text-blue-600 dark:text-blue-400">Booked</div>
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

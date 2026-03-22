import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { usePropertySafe } from "@/lib/propertyContext";

export const BookingWidget = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState<string>("2");
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [defaultPropertyId, setDefaultPropertyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("properties").select("id").eq("is_default", true).maybeSingle()
      .then(({ data }) => { if (data) setDefaultPropertyId(data.id); });
  }, []);

  useEffect(() => {
    if (!defaultPropertyId) return;
    const fetchBookedDates = async () => {
      try {
        // Fetch manually blocked dates
        const { data: blockedDatesData, error: blockedError } = await supabase
          .from("blocked_dates")
          .select("blocked_date, unit_id");

        if (blockedError) throw blockedError;

        // Get all available units for the default property
        const { data: allUnits } = await supabase
          .from("units")
          .select("id")
          .eq("status", "available")
          .eq("is_private", false)
          .eq("property_id", defaultPropertyId);

        const totalUnits = allUnits?.length || 0;
        if (totalUnits === 0) return;

        // Fetch reservation dates
        const { data: reservations, error } = await supabase
          .from("reservations")
          .select("check_in_date, check_out_date, unit_id")
          .eq("status", "confirmed");

        if (error) throw error;

        // Group reservations and blocks by date
        const dateUnavailability = new Map<string, Set<string>>();
        
        // Add reservations to unavailability map
        reservations?.forEach(res => {
          const start = parseISO(res.check_in_date);
          const end = parseISO(res.check_out_date);
          
          for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            if (!dateUnavailability.has(dateStr)) {
              dateUnavailability.set(dateStr, new Set());
            }
            dateUnavailability.get(dateStr)?.add(res.unit_id);
          }
        });

        // Add blocked dates to unavailability map
        blockedDatesData?.forEach(block => {
          const dateStr = block.blocked_date;
          
          if (!dateUnavailability.has(dateStr)) {
            dateUnavailability.set(dateStr, new Set());
          }
          
          if (block.unit_id === null) {
            // If unit_id is null, block all units for this date
            allUnits?.forEach(unit => {
              dateUnavailability.get(dateStr)?.add(unit.id);
            });
          } else {
            // Block specific unit
            dateUnavailability.get(dateStr)?.add(block.unit_id);
          }
        });

        // Find dates where all units are unavailable (booked or blocked)
        const fullyUnavailableDates: Date[] = [];
        dateUnavailability.forEach((unitIds, dateStr) => {
          if (unitIds.size >= totalUnits) {
            fullyUnavailableDates.push(parseISO(dateStr));
          }
        });

        setBookedDates(fullyUnavailableDates);
      } catch (error: any) {
        console.error("Error fetching booked dates:", error);
      }
    };

    fetchBookedDates();
  }, []);

  // Check if a date range contains any fully booked dates
  const isRangeValid = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return true;
    
    const start = new Date(range.from);
    const end = new Date(range.to);
    
    // Check each date in the range (excluding checkout date)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const isBlocked = bookedDates.some(bookedDate => 
        format(bookedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')
      );
      if (isBlocked) return false;
    }
    return true;
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    // Only set the range if it's valid (doesn't contain blocked dates)
    if (isRangeValid(range)) {
      setDateRange(range);
    }
  };

  const handleSearch = () => {
    if (dateRange?.from && dateRange?.to) {
      const params = new URLSearchParams({
        checkIn: format(dateRange.from, "yyyy-MM-dd"),
        checkOut: format(dateRange.to, "yyyy-MM-dd"),
        guests: guests,
      });
      navigate(`/book?${params.toString()}`);
    } else {
      navigate("/book");
    }
  };

  return (
    <div className="bg-background/30 backdrop-blur-sm rounded-lg border border-border/50 p-1.5 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {/* Check In & Check Out Combined - Mobile: col-span-1, Desktop: col-span-2 */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {/* Combined Date Picker for Mobile, Separate Check In for Desktop */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
              >
                <div className="flex items-start gap-2 w-full">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs md:text-sm font-playfair font-medium text-foreground md:hidden">Dates</span>
                    <span className="text-xs md:text-sm font-playfair font-medium text-foreground hidden md:block">Check in</span>
                    <span className={cn("text-xs md:text-sm font-playfair truncate", !dateRange?.from && "text-muted-foreground")}>
                      {dateRange?.from ? (
                        <span className="md:hidden">
                          {format(dateRange.from, "MMM dd")} - {dateRange?.to ? format(dateRange.to, "MMM dd") : "..."}
                        </span>
                      ) : (
                        <span className="md:hidden">Add dates</span>
                      )}
                      <span className="hidden md:inline">
                        {dateRange?.from ? format(dateRange.from, "MMM dd") : "Add date"}
                      </span>
                    </span>
                  </div>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  const isPast = date < new Date();
                  const isBooked = bookedDates.some(bookedDate => 
                    format(bookedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  );
                  return isPast || isBooked;
                }}
                initialFocus
                numberOfMonths={1}
                className="pointer-events-auto"
                modifiers={{
                  booked: bookedDates,
                }}
                modifiersClassNames={{
                  booked: "bg-white text-muted-foreground opacity-60 cursor-not-allowed",
                }}
              />
            </PopoverContent>
          </Popover>

          {/* Check Out - Desktop Only */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="hidden md:flex w-full justify-start text-left font-normal h-auto py-1.5 px-3"
              >
                <div className="flex items-start gap-2 w-full">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs md:text-sm font-playfair font-medium text-foreground">Check out</span>
                    <span className={cn("text-xs md:text-sm font-playfair truncate", !dateRange?.to && "text-muted-foreground")}>
                      {dateRange?.to ? format(dateRange.to, "MMM dd") : "Add date"}
                    </span>
                  </div>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateSelect}
                disabled={(date) => {
                  const isPast = date < new Date();
                  const isBooked = bookedDates.some(bookedDate => 
                    format(bookedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  );
                  return isPast || isBooked;
                }}
                initialFocus
                numberOfMonths={1}
                className="pointer-events-auto"
                modifiers={{
                  booked: bookedDates,
                }}
                modifiersClassNames={{
                  booked: "bg-white text-muted-foreground opacity-60 cursor-not-allowed",
                }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Guests */}
        <div className="w-full border border-border rounded-md px-3 py-1.5 bg-background hover:bg-accent/50 transition-colors">
          <div className="flex items-start gap-2 w-full">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex flex-col w-full min-w-0">
              <span className="text-xs md:text-sm font-playfair font-medium text-foreground">Guests</span>
              <Select value={guests} onValueChange={setGuests}>
                <SelectTrigger className="h-auto p-0 border-0 focus:ring-0 text-xs md:text-sm font-playfair text-muted-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 guest</SelectItem>
                  <SelectItem value="2">2 guests</SelectItem>
                  <SelectItem value="3">3 guests</SelectItem>
                  <SelectItem value="4">4 guests</SelectItem>
                  <SelectItem value="5">5+ guests</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Search Button */}
        <Button 
          onClick={handleSearch}
          className="w-full bg-accent hover:bg-accent/90 h-full col-span-2 md:col-span-1 font-playfair font-medium text-[14px]"
        >
          Search
        </Button>
      </div>
    </div>
  );
};

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

export const BookingWidget = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState<string>("2");
  const [bookedDates, setBookedDates] = useState<Date[]>([]);

  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const { data: reservations, error } = await supabase
          .from("reservations")
          .select("check_in_date, check_out_date, unit_id")
          .eq("status", "confirmed");

        if (error) throw error;
        
        console.log("📅 Fetched reservations:", reservations);

        // Get all dates that are fully booked (all units booked)
        const { data: allUnits } = await supabase
          .from("units")
          .select("id")
          .eq("status", "available");

        const totalUnits = allUnits?.length || 0;
        if (totalUnits === 0) return;

        // Group reservations by date
        const dateBookings = new Map<string, Set<string>>();
        
        reservations?.forEach(res => {
          const start = parseISO(res.check_in_date);
          const end = parseISO(res.check_out_date);
          
          console.log(`Processing reservation: ${res.check_in_date} to ${res.check_out_date}, unit: ${res.unit_id}`);
          
          for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            if (!dateBookings.has(dateStr)) {
              dateBookings.set(dateStr, new Set());
            }
            dateBookings.get(dateStr)?.add(res.unit_id);
          }
        });

        // Find dates where all units are booked
        const fullyBookedDates: Date[] = [];
        dateBookings.forEach((unitIds, dateStr) => {
          console.log(`Date: ${dateStr}, Booked units: ${unitIds.size}/${totalUnits}`, Array.from(unitIds));
          if (unitIds.size >= totalUnits) {
            fullyBookedDates.push(parseISO(dateStr));
          }
        });

        console.log("Total units:", totalUnits);
        console.log("Fully booked dates:", fullyBookedDates.map(d => format(d, "yyyy-MM-dd")));
        setBookedDates(fullyBookedDates);
      } catch (error: any) {
        console.error("Error fetching booked dates:", error);
      }
    };

    fetchBookedDates();
  }, []);

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
                    <span className="text-xs md:text-sm font-semibold text-foreground md:hidden">Dates</span>
                    <span className="text-xs md:text-sm font-semibold text-foreground hidden md:block">Check in</span>
                    <span className={cn("text-xs md:text-sm truncate", !dateRange?.from && "text-muted-foreground")}>
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
                onSelect={setDateRange}
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
                    <span className="text-xs md:text-sm font-semibold text-foreground">Check out</span>
                    <span className={cn("text-xs md:text-sm truncate", !dateRange?.to && "text-muted-foreground")}>
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
                onSelect={setDateRange}
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
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
          onClick={(e) => e.preventDefault()}
        >
          <div className="flex items-start gap-2 w-full">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex flex-col w-full min-w-0">
              <span className="text-xs md:text-sm font-semibold text-foreground">Guests</span>
              <Select value={guests} onValueChange={setGuests}>
                <SelectTrigger className="h-auto p-0 border-0 focus:ring-0 text-xs md:text-sm text-muted-foreground">
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
        </Button>

        {/* Search Button */}
        <Button 
          onClick={handleSearch}
          className="w-full bg-accent hover:bg-accent/90 h-full col-span-2 md:col-span-1"
        >
          Search
        </Button>
      </div>
    </div>
  );
};

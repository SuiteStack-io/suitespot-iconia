import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Users } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export const BookingWidget = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState<string>("2");

  const handleSearch = () => {
    navigate("/book");
  };

  return (
    <div className="bg-background/30 backdrop-blur-sm rounded-lg border border-border/50 p-1.5 max-w-4xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
        {/* Check In & Check Out */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
              >
                <div className="flex items-start gap-2 w-full">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs md:text-sm font-semibold text-foreground">Check in</span>
                    <span className={cn("text-xs md:text-sm truncate", !dateRange?.from && "text-muted-foreground")}>
                      {dateRange?.from ? format(dateRange.from, "MMM dd") : "Add date"}
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
                disabled={(date) => date < new Date()}
                initialFocus
                numberOfMonths={1}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
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
                disabled={(date) => date < new Date()}
                initialFocus
                numberOfMonths={1}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

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

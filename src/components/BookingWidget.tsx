import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Users } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export const BookingWidget = () => {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState<string>("2");

  const handleSearch = () => {
    navigate("/book");
  };

  return (
    <div className="bg-background/30 backdrop-blur-sm rounded-lg border border-border/50 p-1.5 max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
        {/* Check In */}
        <div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
              >
                <div className="flex items-start gap-3 w-full">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Check in</span>
                    <span className={cn("text-sm", !checkIn && "text-muted-foreground")}>
                      {checkIn ? format(checkIn, "MMM dd, yyyy") : "Add date"}
                    </span>
                  </div>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkIn}
                onSelect={setCheckIn}
                disabled={(date) => date < new Date()}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Check Out */}
        <div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
              >
                <div className="flex items-start gap-2 w-full">
                  <CalendarIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">Check out</span>
                    <span className={cn("text-sm", !checkOut && "text-muted-foreground")}>
                      {checkOut ? format(checkOut, "MMM dd, yyyy") : "Add date"}
                    </span>
                  </div>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={checkOut}
                onSelect={setCheckOut}
                disabled={(date) => date < (checkIn || new Date())}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Guests */}
        <div>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal h-auto py-1.5 px-3"
            onClick={(e) => e.preventDefault()}
          >
            <div className="flex items-start gap-2 w-full">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex flex-col w-full">
                <span className="text-sm font-semibold text-foreground">Guests</span>
                <Select value={guests} onValueChange={setGuests}>
                  <SelectTrigger className="h-auto p-0 border-0 focus:ring-0 text-sm text-muted-foreground">
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
        </div>

        {/* Search Button */}
        <div className="flex items-center">
          <Button 
            onClick={handleSearch}
            className="w-full bg-accent hover:bg-accent/90 h-full"
          >
            Search
          </Button>
        </div>
      </div>
    </div>
  );
};

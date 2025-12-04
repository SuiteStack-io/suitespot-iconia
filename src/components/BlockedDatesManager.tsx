import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { toast } from "sonner";
import { CalendarX, Plus, Trash2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
}

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
  unit_id: string | null;
  units?: {
    name: string;
    unit_number: string | null;
  } | null;
}

export const BlockedDatesManager = () => {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchBlockedDates();
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, unit_number")
        .eq("status", "available")
        .order("unit_number", { ascending: true });

      if (error) throw error;
      setUnits(data || []);
    } catch (error: any) {
      console.error("Error fetching units:", error);
      toast.error("Failed to fetch units");
    }
  };

  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from("blocked_dates")
        .select(`
          *,
          units (
            name,
            unit_number
          )
        `)
        .order("blocked_date", { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error: any) {
      console.error("Error fetching blocked dates:", error);
      toast.error("Failed to fetch blocked dates");
    }
  };

  const handleAddBlockedDate = async () => {
    if (!dateRange?.from) {
      toast.error("Please select at least a start date");
      return;
    }

    setLoading(true);
    try {
      // Get all dates in the range
      const endDate = dateRange.to || dateRange.from;
      const datesInRange = eachDayOfInterval({
        start: dateRange.from,
        end: endDate,
      });

      // Create insert records for each date
      const insertRecords = datesInRange.map(date => ({
        blocked_date: format(date, "yyyy-MM-dd"),
        unit_id: selectedUnitId === "all" ? null : selectedUnitId,
        reason: reason.trim() || null,
      }));

      const { error } = await supabase
        .from("blocked_dates")
        .insert(insertRecords);

      if (error) {
        if (error.code === "23505") {
          toast.error("Some dates are already blocked for the selected room");
        } else {
          throw error;
        }
        return;
      }

      const unitName = selectedUnitId === "all" 
        ? "all rooms" 
        : units.find(u => u.id === selectedUnitId)?.name || "selected room";
      
      const dateCount = datesInRange.length;
      const dateText = dateCount === 1 ? "date" : "dates";
      toast.success(`${dateCount} ${dateText} blocked successfully for ${unitName}`);
      
      setDateRange(undefined);
      setSelectedUnitId("all");
      setReason("");
      setDialogOpen(false);
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error adding blocked date:", error);
      toast.error("Failed to block dates");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlockedDate = async (id: string) => {
    try {
      const { error } = await supabase
        .from("blocked_dates")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Date unblocked successfully");
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error deleting blocked date:", error);
      toast.error("Failed to unblock date");
    }
  };

  const blockedDateObjects = blockedDates.map(d => parseISO(d.blocked_date));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5" />
              Blocked Dates Management
            </CardTitle>
            <CardDescription>
              Manually block dates from public booking (e.g., for maintenance or events)
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Block Date
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block Dates</DialogTitle>
                <DialogDescription>
                  Select a date range and room to block from public booking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-select">Room</Label>
                  <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                    <SelectTrigger id="unit-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rooms</SelectItem>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          #{unit.unit_number} - {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Selection - Matching BookingWidget Style */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Check In Date */}
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal h-auto py-2 px-3"
                        >
                          <div className="flex items-start gap-2 w-full">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-sm truncate", !dateRange?.from && "text-muted-foreground")}>
                                {dateRange?.from ? format(dateRange.from, "MMM dd, yyyy") : "Add date"}
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
                          modifiers={{
                            blocked: blockedDateObjects,
                          }}
                          modifiersClassNames={{
                            blocked: "bg-destructive text-destructive-foreground opacity-60",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Check Out Date */}
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal h-auto py-2 px-3"
                        >
                          <div className="flex items-start gap-2 w-full">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className={cn("text-sm truncate", !dateRange?.to && "text-muted-foreground")}>
                                {dateRange?.to ? format(dateRange.to, "MMM dd, yyyy") : "Add date"}
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
                          modifiers={{
                            blocked: blockedDateObjects,
                          }}
                          modifiersClassNames={{
                            blocked: "bg-destructive text-destructive-foreground opacity-60",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Maintenance, Private event"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddBlockedDate}
                  disabled={!dateRange?.from || loading}
                  className="w-full"
                >
                  {loading ? "Blocking..." : "Block Dates"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {blockedDates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No blocked dates. Click "Block Date" to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {blockedDates.map((blockedDate) => (
              <div
                key={blockedDate.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">
                    {format(parseISO(blockedDate.blocked_date), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {blockedDate.unit_id ? (
                      <span>#{blockedDate.units?.unit_number} - {blockedDate.units?.name || "Unknown"}</span>
                    ) : (
                      <span>All Rooms</span>
                    )}
                  </div>
                  {blockedDate.reason && (
                    <div className="text-sm text-muted-foreground">
                      {blockedDate.reason}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteBlockedDate(blockedDate.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

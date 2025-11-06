import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { CalendarX, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockedDate {
  id: string;
  blocked_date: string;
  reason: string | null;
  created_at: string;
}

export const BlockedDatesManager = () => {
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchBlockedDates();
  }, []);

  const fetchBlockedDates = async () => {
    try {
      const { data, error } = await supabase
        .from("blocked_dates")
        .select("*")
        .order("blocked_date", { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (error: any) {
      console.error("Error fetching blocked dates:", error);
      toast.error("Failed to fetch blocked dates");
    }
  };

  const handleAddBlockedDate = async () => {
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("blocked_dates")
        .insert({
          blocked_date: format(selectedDate, "yyyy-MM-dd"),
          reason: reason.trim() || null,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("This date is already blocked");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Date blocked successfully");
      setSelectedDate(undefined);
      setReason("");
      setDialogOpen(false);
      fetchBlockedDates();
    } catch (error: any) {
      console.error("Error adding blocked date:", error);
      toast.error("Failed to block date");
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
                <DialogTitle>Block a Date</DialogTitle>
                <DialogDescription>
                  Select a date to block from public booking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date()}
                    className={cn("rounded-md border pointer-events-auto")}
                    modifiers={{
                      blocked: blockedDateObjects,
                    }}
                    modifiersClassNames={{
                      blocked: "bg-destructive text-destructive-foreground opacity-60",
                    }}
                  />
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
                  disabled={!selectedDate || loading}
                  className="w-full"
                >
                  {loading ? "Blocking..." : "Block Date"}
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

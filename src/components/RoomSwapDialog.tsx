import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ArrowRight, ArrowLeftRight, Loader2, AlertTriangle } from "lucide-react";

interface Reservation {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  booking_reference: string;
  guest_names: string[];
  status: string;
  source?: string;
  group_id?: string;
  units?: { name: string; unit_number: string | null; booking_com_name?: string } | null;
}

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  booking_com_name?: string;
}

interface RoomSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  currentUnit: Unit | null;
  onSuccess: () => void;
}

export const RoomSwapDialog = ({
  open,
  onOpenChange,
  reservation,
  currentUnit,
  onSuccess,
}: RoomSwapDialogProps) => {
  const [swappableReservations, setSwappableReservations] = useState<Reservation[]>([]);
  const [selectedSwapId, setSelectedSwapId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && reservation) {
      fetchSwappableReservations();
      setSelectedSwapId("");
    }
  }, [open, reservation]);

  const fetchSwappableReservations = async () => {
    if (!reservation) return;
    setLoading(true);

    try {
      // Fetch reservations that overlap with the selected one
      const { data, error } = await supabase
        .from("reservations")
        .select("id, unit_id, check_in_date, check_out_date, booking_reference, guest_names, status, source, group_id, units(name, unit_number, booking_com_name)")
        .neq("id", reservation.id)
        .neq("unit_id", reservation.unit_id)
        .in("status", ["confirmed", "checked-in"])
        .lt("check_in_date", reservation.check_out_date)
        .gt("check_out_date", reservation.check_in_date);

      if (error) throw error;

      // Filter out same group reservations (split-stays shouldn't swap with each other)
      const filtered = data?.filter(r => 
        !reservation.group_id || r.group_id !== reservation.group_id
      ) || [];

      setSwappableReservations(filtered as Reservation[]);
    } catch (error) {
      console.error("Error fetching swappable reservations:", error);
      toast({
        title: "Error",
        description: "Failed to load available reservations for swap",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!reservation || !selectedSwapId) return;

    const swapReservation = swappableReservations.find(r => r.id === selectedSwapId);
    if (!swapReservation) return;

    setSwapping(true);
    try {
      const reservation1UnitId = reservation.unit_id;
      const reservation2UnitId = swapReservation.unit_id;

      // Update reservation 1 to have reservation 2's room
      const { error: error1 } = await supabase
        .from("reservations")
        .update({ unit_id: reservation2UnitId })
        .eq("id", reservation.id);

      if (error1) throw error1;

      // Update reservation 2 to have reservation 1's room
      const { error: error2 } = await supabase
        .from("reservations")
        .update({ unit_id: reservation1UnitId })
        .eq("id", swapReservation.id);

      if (error2) throw error2;

      // Calculate nights for notifications
      const nights1 = Math.ceil(
        (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      const nights2 = Math.ceil(
        (new Date(swapReservation.check_out_date).getTime() - new Date(swapReservation.check_in_date).getTime()) / 
        (1000 * 60 * 60 * 24)
      );

      // Send room change notification for reservation 1
      try {
        await supabase.functions.invoke('send-room-change-notification', {
          body: {
            reservation_id: reservation.id,
            booking_reference: reservation.booking_reference,
            guest_names: reservation.guest_names,
            check_in_date: reservation.check_in_date,
            check_out_date: reservation.check_out_date,
            old_unit_name: currentUnit?.booking_com_name || currentUnit?.name,
            old_unit_number: currentUnit?.unit_number,
            new_unit_name: swapReservation.units?.booking_com_name || swapReservation.units?.name,
            new_unit_number: swapReservation.units?.unit_number,
            nights: nights1,
            source: reservation.source,
          }
        });
      } catch (notifyError) {
        console.error("Failed to send room change notification for reservation 1:", notifyError);
      }

      // Send room change notification for reservation 2
      try {
        await supabase.functions.invoke('send-room-change-notification', {
          body: {
            reservation_id: swapReservation.id,
            booking_reference: swapReservation.booking_reference,
            guest_names: swapReservation.guest_names,
            check_in_date: swapReservation.check_in_date,
            check_out_date: swapReservation.check_out_date,
            old_unit_name: swapReservation.units?.booking_com_name || swapReservation.units?.name,
            old_unit_number: swapReservation.units?.unit_number,
            new_unit_name: currentUnit?.booking_com_name || currentUnit?.name,
            new_unit_number: currentUnit?.unit_number,
            nights: nights2,
            source: swapReservation.source,
          }
        });
      } catch (notifyError) {
        console.error("Failed to send room change notification for reservation 2:", notifyError);
      }

      toast({
        title: "Rooms Swapped",
        description: `Successfully swapped rooms between ${reservation.guest_names[0]} and ${swapReservation.guest_names[0]}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error swapping rooms:", error);
      toast({
        title: "Swap Failed",
        description: "Failed to swap rooms. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSwapping(false);
    }
  };

  const selectedSwapReservation = swappableReservations.find(r => r.id === selectedSwapId);

  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / 
    (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Swap Rooms
          </DialogTitle>
          <DialogDescription>
            Exchange room assignments between two overlapping reservations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Reservation */}
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Reservation</div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg">{reservation.guest_names[0]}</span>
              <Badge variant="default">
                {currentUnit?.booking_com_name || currentUnit?.name} #{currentUnit?.unit_number}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(reservation.check_in_date), "MMM d")} 
              <ArrowRight className="inline h-3 w-3 mx-1" />
              {format(new Date(reservation.check_out_date), "MMM d, yyyy")}
              <span className="ml-2">({nights} night{nights > 1 ? "s" : ""})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Ref: {reservation.booking_reference}
            </div>
          </div>

          {/* Swap With Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select reservation to swap with:</label>
            
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : swappableReservations.length === 0 ? (
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No overlapping reservations in other rooms to swap with.
                </p>
              </div>
            ) : (
              <RadioGroup value={selectedSwapId} onValueChange={setSelectedSwapId}>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {swappableReservations.map((res) => {
                    const resNights = Math.ceil(
                      (new Date(res.check_out_date).getTime() - new Date(res.check_in_date).getTime()) / 
                      (1000 * 60 * 60 * 24)
                    );
                    return (
                      <label 
                        key={res.id} 
                        htmlFor={res.id}
                        className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedSwapId === res.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value={res.id} id={res.id} className="mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{res.guest_names[0]}</span>
                            <Badge variant="secondary" className="text-xs">
                              {res.units?.booking_com_name || res.units?.name} #{res.units?.unit_number}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(res.check_in_date), "MMM d")} - {format(new Date(res.check_out_date), "MMM d")} ({resNights}n)
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </RadioGroup>
            )}
          </div>

          {/* Swap Summary */}
          {selectedSwapReservation && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="text-sm font-medium text-center">Swap Summary</div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <div className="flex-1 text-center">
                  <div className="font-medium">{reservation.guest_names[0]}</div>
                  <div className="text-muted-foreground mt-1">
                    <span className="line-through">{currentUnit?.booking_com_name || currentUnit?.name}</span>
                    <ArrowRight className="inline h-3 w-3 mx-1" />
                    <span className="text-primary font-medium">
                      {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name}
                    </span>
                  </div>
                </div>
                <ArrowLeftRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 text-center">
                  <div className="font-medium">{selectedSwapReservation.guest_names[0]}</div>
                  <div className="text-muted-foreground mt-1">
                    <span className="line-through">
                      {selectedSwapReservation.units?.booking_com_name || selectedSwapReservation.units?.name}
                    </span>
                    <ArrowRight className="inline h-3 w-3 mx-1" />
                    <span className="text-primary font-medium">
                      {currentUnit?.booking_com_name || currentUnit?.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSwap}
              disabled={!selectedSwapId || swapping}
            >
              {swapping ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowLeftRight className="h-4 w-4 mr-2" />
              )}
              Confirm Swap
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

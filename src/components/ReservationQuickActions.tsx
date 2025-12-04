import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, Eye, Loader2 } from "lucide-react";

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

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  status?: string;
}

interface ConflictInfo {
  hasConflict: boolean;
  conflictingReservations: Reservation[];
}

interface ReservationQuickActionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  currentUnit: Unit | null;
  onMoveComplete: () => void;
}

export const ReservationQuickActions = ({
  open,
  onOpenChange,
  reservation,
  currentUnit,
  onMoveComplete,
}: ReservationQuickActionsProps) => {
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [unitConflicts, setUnitConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && reservation) {
      fetchAvailableUnits();
    }
  }, [open, reservation]);

  const fetchAvailableUnits = async () => {
    if (!reservation) return;
    setLoading(true);

    try {
      // Fetch all available units
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, name, unit_number, status")
        .eq("status", "available")
        .order("unit_number");

      if (unitsError) throw unitsError;

      // Fetch reservations that might conflict
      const { data: conflictingReservations, error: resError } = await supabase
        .from("reservations")
        .select("*")
        .in("status", ["confirmed", "checked-in", "checked-out"])
        .neq("id", reservation.id)
        .or(`and(check_in_date.lt.${reservation.check_out_date},check_out_date.gt.${reservation.check_in_date})`);

      if (resError) throw resError;

      // Check conflicts for each unit
      const conflicts = new Map<string, ConflictInfo>();
      units?.forEach((unit) => {
        const unitConflicts = conflictingReservations?.filter(
          (r) => r.unit_id === unit.id
        ) || [];
        conflicts.set(unit.id, {
          hasConflict: unitConflicts.length > 0,
          conflictingReservations: unitConflicts,
        });
      });

      setAvailableUnits(units || []);
      setUnitConflicts(conflicts);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast({
        title: "Error",
        description: "Failed to load available rooms",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveReservation = async () => {
    if (!reservation || !selectedUnitId) return;

    const targetConflict = unitConflicts.get(selectedUnitId);
    if (targetConflict?.hasConflict) {
      toast({
        title: "Cannot Move",
        description: "Selected room has conflicting reservations. Please choose another room.",
        variant: "destructive",
      });
      return;
    }

    setMoving(true);
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ unit_id: selectedUnitId })
        .eq("id", reservation.id);

      if (error) throw error;

      const newUnit = availableUnits.find((u) => u.id === selectedUnitId);
      toast({
        title: "Reservation Moved",
        description: `Successfully moved to ${newUnit?.name} #${newUnit?.unit_number}`,
      });

      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error moving reservation:", error);
      toast({
        title: "Move Failed",
        description: "Failed to move reservation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMoving(false);
    }
  };

  const handleViewDetails = () => {
    if (reservation) {
      navigate(`/reservation/${reservation.id}`);
      onOpenChange(false);
    }
  };

  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / 
    (1000 * 60 * 60 * 24)
  );

  const getSourceBadgeColor = (source?: string) => {
    if (!source) return "secondary";
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes("booking")) return "default";
    if (lowerSource.includes("direct")) return "destructive";
    return "secondary";
  };

  // Filter out current unit and sort: conflict-free first
  const sortedUnits = availableUnits
    .filter((u) => u.id !== reservation.unit_id)
    .sort((a, b) => {
      const aConflict = unitConflicts.get(a.id)?.hasConflict || false;
      const bConflict = unitConflicts.get(b.id)?.hasConflict || false;
      if (aConflict && !bConflict) return 1;
      if (!aConflict && bConflict) return -1;
      return (a.unit_number || "").localeCompare(b.unit_number || "");
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reservation Quick Actions</DialogTitle>
          <DialogDescription>
            View details or move this reservation to another room
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reservation Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg">{reservation.guest_names[0]}</span>
              <Badge variant={getSourceBadgeColor(reservation.source)}>
                {reservation.source || "Unknown"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(reservation.check_in_date), "MMM d, yyyy")} 
              <ArrowRight className="inline h-3 w-3 mx-1" />
              {format(new Date(reservation.check_out_date), "MMM d, yyyy")}
              <span className="ml-2">({nights} night{nights > 1 ? "s" : ""})</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Ref: {reservation.booking_reference}
            </div>
          </div>

          {/* Current Room */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Room</label>
            <div className="p-3 border rounded-lg bg-background">
              {currentUnit ? (
                <span>{currentUnit.name} #{currentUnit.unit_number}</span>
              ) : (
                <span className="text-muted-foreground">Not assigned</span>
              )}
            </div>
          </div>

          {/* Move to Room */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Move to Room</label>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new room..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedUnits.map((unit) => {
                    const conflict = unitConflicts.get(unit.id);
                    return (
                      <SelectItem 
                        key={unit.id} 
                        value={unit.id}
                        disabled={conflict?.hasConflict}
                        className={conflict?.hasConflict ? "opacity-60" : ""}
                      >
                        <div className="flex items-center gap-2">
                          {conflict?.hasConflict && (
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          )}
                          <span>{unit.name} #{unit.unit_number}</span>
                          {conflict?.hasConflict && (
                            <span className="text-xs text-destructive ml-1">
                              (Conflict)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                  {sortedUnits.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No other rooms available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Conflict Warning */}
          {selectedUnitId && unitConflicts.get(selectedUnitId)?.hasConflict && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
              <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />
                Conflict Warning
              </div>
              <p className="text-muted-foreground">
                This room has existing reservations during these dates.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleViewDetails}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </Button>
            <Button
              className="flex-1"
              onClick={handleMoveReservation}
              disabled={!selectedUnitId || moving || unitConflicts.get(selectedUnitId)?.hasConflict}
            >
              {moving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Move Room
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

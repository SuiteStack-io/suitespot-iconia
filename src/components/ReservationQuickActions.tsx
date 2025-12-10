import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format, differenceInCalendarDays, addDays } from "date-fns";
import { AlertTriangle, ArrowRight, Eye, Loader2, LogIn, LogOut, CheckCircle, CalendarIcon, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Reservation {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  booking_reference: string;
  guest_names: string[];
  status: string;
  source?: string;
  total_price?: number;
  nights?: number;
  commission_rate?: number;
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
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Extend stay state
  const [extendMode, setExtendMode] = useState(false);
  const [newCheckoutDate, setNewCheckoutDate] = useState<Date | undefined>(undefined);
  const [extensionPricePerNight, setExtensionPricePerNight] = useState<string>("");
  const [extendConflict, setExtendConflict] = useState(false);
  const [extending, setExtending] = useState(false);
  const [fullReservation, setFullReservation] = useState<any>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && reservation) {
      fetchAvailableUnits();
      fetchFullReservation();
      // Reset extend mode when opening
      setExtendMode(false);
      setNewCheckoutDate(undefined);
      setExtensionPricePerNight("");
      setExtendConflict(false);
    }
  }, [open, reservation]);

  // Check for conflicts when new checkout date changes
  useEffect(() => {
    if (newCheckoutDate && reservation?.unit_id) {
      checkExtendConflict();
    }
  }, [newCheckoutDate]);

  const fetchFullReservation = async () => {
    if (!reservation) return;
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservation.id)
      .single();
    if (data) {
      setFullReservation(data);
    }
  };

  const checkExtendConflict = async () => {
    if (!reservation || !newCheckoutDate) return;
    
    const currentCheckout = new Date(reservation.check_out_date);
    if (newCheckoutDate <= currentCheckout) {
      setExtendConflict(false);
      return;
    }

    // Check for conflicts in the extended period
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("unit_id", reservation.unit_id)
      .neq("id", reservation.id)
      .in("status", ["confirmed", "checked-in"])
      .lt("check_in_date", format(newCheckoutDate, "yyyy-MM-dd"))
      .gt("check_out_date", reservation.check_out_date);

    // Also check blocked dates
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("id")
      .eq("unit_id", reservation.unit_id)
      .gte("blocked_date", reservation.check_out_date)
      .lt("blocked_date", format(newCheckoutDate, "yyyy-MM-dd"));

    setExtendConflict((conflicts && conflicts.length > 0) || (blockedDates && blockedDates.length > 0));
  };

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
        .in("status", ["confirmed", "checked-in", "checked-out", "completed"])
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

  const handleStatusChange = async (newStatus: string) => {
    if (!reservation) return;
    setUpdatingStatus(true);
    
    try {
      const { error } = await supabase
        .from("reservations")
        .update({ status: newStatus })
        .eq("id", reservation.id);

      if (error) throw error;

      // Send notifications for check-in/check-out
      if (newStatus === 'checked-in') {
        try {
          await supabase.functions.invoke('send-checkin-notification', {
            body: { reservationId: reservation.id }
          });
        } catch (notifError) {
          console.error('Failed to send check-in notification:', notifError);
        }
      } else if (newStatus === 'checked-out') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.functions.invoke('send-checkout-notification', {
            body: { reservationId: reservation.id, userId: user?.id }
          });
        } catch (notifError) {
          console.error('Failed to send check-out notification:', notifError);
        }
      }

      toast({
        title: "Status Updated",
        description: `Reservation status changed to ${newStatus.replace('-', ' ')}`,
      });

      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update reservation status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleExtendStay = async () => {
    if (!reservation || !newCheckoutDate || !extensionPricePerNight || !fullReservation) return;
    
    const currentCheckout = new Date(reservation.check_out_date + 'T00:00:00');
    const additionalNights = differenceInCalendarDays(newCheckoutDate, currentCheckout);
    
    if (additionalNights <= 0) {
      toast({
        title: "Invalid Date",
        description: "New checkout date must be after current checkout date",
        variant: "destructive",
      });
      return;
    }

    if (extendConflict) {
      toast({
        title: "Cannot Extend",
        description: "There are conflicts or blocked dates in the extended period",
        variant: "destructive",
      });
      return;
    }

    setExtending(true);
    try {
      const pricePerNight = parseFloat(extensionPricePerNight);
      const extensionSubtotal = additionalNights * pricePerNight;
      const extensionVAT = extensionSubtotal * 0.14;
      const extensionTotal = extensionSubtotal + extensionVAT;

      const originalTotal = fullReservation.total_price || 0;
      const originalNights = fullReservation.nights || nights;
      const commissionRate = fullReservation.commission_rate || 10;

      const newTotal = originalTotal + extensionTotal;
      const newNights = originalNights + additionalNights;
      const newCommission = newTotal * (commissionRate / 100);
      const newNetRevenue = newTotal - newCommission;

      const { error } = await supabase
        .from("reservations")
        .update({
          check_out_date: format(newCheckoutDate, "yyyy-MM-dd"),
          nights: newNights,
          total_price: newTotal,
          commission_amount: newCommission,
          net_revenue: newNetRevenue,
        })
        .eq("id", reservation.id);

      if (error) throw error;

      toast({
        title: "Stay Extended",
        description: `Extended by ${additionalNights} night${additionalNights > 1 ? 's' : ''} (+$${extensionTotal.toFixed(2)} incl. VAT)`,
      });

      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error extending stay:", error);
      toast({
        title: "Extension Failed",
        description: "Failed to extend stay. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExtending(false);
    }
  };

  if (!reservation) return null;

  const nights = Math.ceil(
    (new Date(reservation.check_out_date).getTime() - new Date(reservation.check_in_date).getTime()) / 
    (1000 * 60 * 60 * 24)
  );

  const currentCheckout = new Date(reservation.check_out_date + 'T00:00:00');
  const additionalNights = newCheckoutDate ? differenceInCalendarDays(newCheckoutDate, currentCheckout) : 0;
  const extensionSubtotal = additionalNights > 0 && extensionPricePerNight 
    ? additionalNights * parseFloat(extensionPricePerNight) 
    : 0;
  const extensionVAT = extensionSubtotal * 0.14;
  const extensionTotal = extensionSubtotal + extensionVAT;

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

  const canExtend = newCheckoutDate && additionalNights > 0 && extensionPricePerNight && parseFloat(extensionPricePerNight) > 0 && !extendConflict;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservation Quick Actions</DialogTitle>
          <DialogDescription>
            {extendMode ? "Extend the guest's stay" : "View details, update status, or move this reservation"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reservation Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg">{reservation.guest_names[0]}</span>
              <div className="flex items-center gap-2">
                <Badge variant={reservation.status === 'completed' ? 'secondary' : reservation.status === 'checked-out' ? 'outline' : 'default'}>
                  {reservation.status.replace('-', ' ')}
                </Badge>
                <Badge variant={getSourceBadgeColor(reservation.source)}>
                  {reservation.source || "Unknown"}
                </Badge>
              </div>
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

          {!extendMode ? (
            <>
              {/* Status Actions */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Update Status</label>
                <div className="flex flex-wrap gap-2">
                  {reservation.status === 'confirmed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('checked-in')}
                      disabled={updatingStatus}
                      className="gap-1"
                    >
                      <LogIn className="h-3 w-3" />
                      Check In
                    </Button>
                  )}
                  {(reservation.status === 'confirmed' || reservation.status === 'checked-in') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('checked-out')}
                      disabled={updatingStatus}
                      className="gap-1"
                    >
                      <LogOut className="h-3 w-3" />
                      Check Out
                    </Button>
                  )}
                  {(reservation.status === 'checked-out' || reservation.status === 'completed') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('confirmed')}
                      disabled={updatingStatus}
                      className="gap-1"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Reset to Confirmed
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExtendMode(true)}
                    disabled={updatingStatus}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Extend Stay
                  </Button>
                  {updatingStatus && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
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
            </>
          ) : (
            /* Extend Stay Mode */
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-sm font-medium mb-2">Current Checkout</div>
                <div className="text-lg font-semibold">
                  {format(currentCheckout, "EEEE, MMM d, yyyy")}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">New Checkout Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newCheckoutDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newCheckoutDate ? format(newCheckoutDate, "PPP") : "Select new checkout date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newCheckoutDate}
                      onSelect={setNewCheckoutDate}
                      disabled={(date) => date <= currentCheckout}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {additionalNights > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Additional Nights</div>
                  <div className="text-2xl font-bold">{additionalNights}</div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Price/Night (Net)</label>
                <Input
                  type="number"
                  placeholder="Enter net price per night"
                  value={extensionPricePerNight}
                  onChange={(e) => setExtensionPricePerNight(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  No minimum price applies for extensions
                </p>
              </div>

              {extensionSubtotal > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Subtotal ({additionalNights} × ${parseFloat(extensionPricePerNight).toFixed(2)})
                    </span>
                    <span>${extensionSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT (14%)</span>
                    <span>+${extensionVAT.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Extension Total</span>
                    <span className="text-primary">${extensionTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {extendConflict && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Conflict Detected
                  </div>
                  <p className="text-muted-foreground">
                    There are existing reservations or blocked dates in the extended period.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2 relative z-50">
                <Button 
                  variant="outline" 
                  className="flex-1 pointer-events-auto"
                  onClick={() => {
                    setExtendMode(false);
                    setNewCheckoutDate(undefined);
                    setExtensionPricePerNight("");
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  className="flex-1 pointer-events-auto"
                  onClick={handleExtendStay}
                  disabled={!canExtend || extending}
                >
                  {extending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Confirm Extension
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

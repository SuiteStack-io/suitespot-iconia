import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { usePropertySafe } from "@/lib/propertyContext";
import { format, differenceInCalendarDays, addDays, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, ArrowRight } from "lucide-react";
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
  notes?: string | null;
}

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  status?: string;
  booking_com_name?: string;
}

interface AvailableUnit {
  id: string;
  name: string;
  unit_number: string;
  booking_com_name?: string | null;
}

interface MoveGuestSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  currentUnit: Unit | null;
  onSplitComplete: () => void;
}

export const MoveGuestSplitDialog = ({
  open,
  onOpenChange,
  reservation,
  currentUnit,
  onSplitComplete,
}: MoveGuestSplitDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const propertyCtx = usePropertySafe();
  const propertyId = propertyCtx?.activeProperty?.id;
  const currency = propertyCtx?.activeProperty?.currency || "USD";

  const [moveDate, setMoveDate] = useState<Date | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<AvailableUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [pricingChoice, setPricingChoice] = useState<"same" | "custom">("same");
  const [customRate, setCustomRate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [fullReservation, setFullReservation] = useState<any>(null);

  const originalCheckIn = reservation
    ? startOfDay(new Date(reservation.check_in_date))
    : null;
  const originalCheckOut = reservation
    ? startOfDay(new Date(reservation.check_out_date))
    : null;
  const originalNights =
    originalCheckIn && originalCheckOut
      ? differenceInCalendarDays(originalCheckOut, originalCheckIn)
      : 0;

  const today = startOfDay(new Date());

  // Min: max(today, check_in + 1)
  // Max: check_out - 1
  const minMoveDate = useMemo(() => {
    if (!originalCheckIn) return today;
    const dayAfterCheckIn = addDays(originalCheckIn, 1);
    return dayAfterCheckIn > today ? dayAfterCheckIn : today;
  }, [originalCheckIn, today]);

  const maxMoveDate = useMemo(() => {
    if (!originalCheckOut) return undefined;
    return addDays(originalCheckOut, -1);
  }, [originalCheckOut]);

  const originalRate = useMemo(() => {
    if (!fullReservation && !reservation) return 0;
    const r = fullReservation || reservation;
    if (r.price_per_night && r.price_per_night > 0) return Number(r.price_per_night);
    if (r.total_price && r.nights && r.nights > 0) return Number(r.total_price) / r.nights;
    return 0;
  }, [fullReservation, reservation]);

  const newNights = useMemo(() => {
    if (!moveDate || !originalCheckOut) return 0;
    return differenceInCalendarDays(originalCheckOut, moveDate);
  }, [moveDate, originalCheckOut]);

  const originalNewNights = useMemo(() => {
    if (!moveDate || !originalCheckIn) return 0;
    return differenceInCalendarDays(moveDate, originalCheckIn);
  }, [moveDate, originalCheckIn]);

  const effectiveRate = useMemo(() => {
    if (pricingChoice === "same") return originalRate;
    const r = parseFloat(customRate);
    return isNaN(r) ? 0 : r;
  }, [pricingChoice, originalRate, customRate]);

  // Reset when dialog opens
  useEffect(() => {
    if (open && reservation) {
      // Default move date to today, clamped
      const defaultDate = today < minMoveDate ? minMoveDate : today;
      const clamped =
        maxMoveDate && defaultDate > maxMoveDate ? maxMoveDate : defaultDate;
      setMoveDate(clamped);
      setSelectedUnitId("");
      setPricingChoice("same");
      setCustomRate("");
      // Fetch the full reservation for guest fields and price
      (async () => {
        const { data } = await supabase
          .from("reservations")
          .select("*")
          .eq("id", reservation.id)
          .maybeSingle();
        setFullReservation(data);
      })();
    }
    if (!open) {
      setAvailableUnits([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservation?.id]);

  // Fetch available units whenever moveDate or reservation changes
  useEffect(() => {
    const fetchAvailable = async () => {
      if (!open || !reservation || !moveDate || !propertyId || !currentUnit) {
        setAvailableUnits([]);
        return;
      }
      setLoadingUnits(true);
      setSelectedUnitId("");
      try {
        const moveDateStr = format(moveDate, "yyyy-MM-dd");
        const checkOutStr = reservation.check_out_date;

        // 1. All non-maintenance units in the property, excluding current unit
        const { data: units, error: unitsError } = await supabase
          .from("units")
          .select("id, name, unit_number, booking_com_name, status")
          .eq("property_id", propertyId)
          .neq("status", "maintenance")
          .neq("id", currentUnit.id)
          .order("unit_number", { ascending: true });
        if (unitsError) throw unitsError;
        if (!units || units.length === 0) {
          setAvailableUnits([]);
          return;
        }

        const unitIds = units.map((u) => u.id);

        // 2. Find conflicting reservations in the date range
        const { data: conflicts } = await supabase
          .from("reservations")
          .select("unit_id, check_in_date, check_out_date, status")
          .in("unit_id", unitIds)
          .in("status", ["confirmed", "checked-in"])
          .lt("check_in_date", checkOutStr)
          .gt("check_out_date", moveDateStr);
        const conflictUnitIds = new Set(
          (conflicts || []).map((c: any) => c.unit_id)
        );

        // 3. Find blocked dates in range
        const { data: blocks } = await supabase
          .from("blocked_dates")
          .select("unit_id, blocked_date")
          .in("unit_id", unitIds)
          .gte("blocked_date", moveDateStr)
          .lt("blocked_date", checkOutStr);
        const blockedUnitIds = new Set(
          (blocks || []).map((b: any) => b.unit_id)
        );

        const available = units.filter(
          (u) => !conflictUnitIds.has(u.id) && !blockedUnitIds.has(u.id)
        );
        setAvailableUnits(available);
      } catch (err: any) {
        console.error("Error loading available units:", err);
        toast({
          title: "Failed to load available rooms",
          description: err.message || "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoadingUnits(false);
      }
    };
    fetchAvailable();
  }, [open, reservation, moveDate, propertyId, currentUnit, toast]);

  const isValid = useMemo(() => {
    if (!reservation || !moveDate || !originalCheckIn || !originalCheckOut)
      return false;
    if (moveDate < minMoveDate) return false;
    if (maxMoveDate && moveDate > maxMoveDate) return false;
    if (!selectedUnitId) return false;
    if (pricingChoice === "custom" && (!customRate || parseFloat(customRate) <= 0))
      return false;
    if (effectiveRate <= 0) return false;
    return true;
  }, [
    reservation,
    moveDate,
    originalCheckIn,
    originalCheckOut,
    minMoveDate,
    maxMoveDate,
    selectedUnitId,
    pricingChoice,
    customRate,
    effectiveRate,
  ]);

  const handleConfirm = async () => {
    if (!reservation || !moveDate || !fullReservation || !currentUnit) return;
    if (!isValid) return;

    setSubmitting(true);
    const moveDateStr = format(moveDate, "yyyy-MM-dd");
    const newUnit = availableUnits.find((u) => u.id === selectedUnitId);
    if (!newUnit) {
      setSubmitting(false);
      return;
    }

    // Snapshot for rollback
    const originalSnapshot = {
      check_out_date: fullReservation.check_out_date,
      total_price: fullReservation.total_price,
      commission_amount: fullReservation.commission_amount,
      net_revenue: fullReservation.net_revenue,
      notes: fullReservation.notes,
    };

    try {
      const origRate = originalRate;
      const origNewTotal = origRate * originalNewNights;
      const commissionRate = Number(fullReservation.commission_rate || 0);
      const origCommission = (origNewTotal * commissionRate) / 100;
      const origNet = origNewTotal - origCommission;

      const splitNote = `Split on ${moveDateStr}: guest moved to Room ${newUnit.unit_number}`;
      const updatedNotes = fullReservation.notes
        ? `${fullReservation.notes}\n${splitNote}`
        : splitNote;

      // Step 1: Shorten original
      const { error: updateError } = await supabase
        .from("reservations")
        .update({
          check_out_date: moveDateStr,
          total_price: origNewTotal,
          commission_amount: origCommission,
          net_revenue: origNet,
          notes: updatedNotes,
        })
        .eq("id", reservation.id);
      if (updateError) throw updateError;

      // Step 2: Insert new linked reservation
      const newTotal = effectiveRate * newNights;
      const newCommission = (newTotal * commissionRate) / 100;
      const newNet = newTotal - newCommission;

      const userName =
        fullReservation.guest_names?.[0] || "Guest";

      const moveNote = `Moved from Room ${currentUnit.unit_number} on ${moveDateStr}`;

      const insertPayload: any = {
        property_id: fullReservation.property_id,
        unit_id: newUnit.id,
        check_in_date: moveDateStr,
        check_out_date: reservation.check_out_date,
        guest_names: fullReservation.guest_names,
        guest_nationality: fullReservation.guest_nationality,
        guest_genders: fullReservation.guest_genders,
        guest_ages: fullReservation.guest_ages,
        guest_types: fullReservation.guest_types,
        contact_email: fullReservation.contact_email,
        contact_phone: fullReservation.contact_phone,
        adults: fullReservation.adults,
        children: fullReservation.children,
        number_of_guests: fullReservation.number_of_guests,
        preferred_language: fullReservation.preferred_language,
        price_per_night: effectiveRate,
        total_price: newTotal,
        currency: fullReservation.currency,
        commission_rate: commissionRate,
        commission_amount: newCommission,
        net_revenue: newNet,
        status: fullReservation.status,
        source: fullReservation.source,
        channel: fullReservation.channel,
        booking_reference: fullReservation.booking_reference,
        channex_booking_id: fullReservation.channex_booking_id,
        group_id: fullReservation.group_id,
        parent_reservation_id: reservation.id,
        is_split_reservation: true,
        notes: moveNote,
      };

      const { data: insertedRows, error: insertError } = await supabase
        .from("reservations")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertError || !insertedRows) {
        // Rollback original update
        await supabase
          .from("reservations")
          .update(originalSnapshot)
          .eq("id", reservation.id);
        throw insertError || new Error("Failed to create linked reservation");
      }

      const newReservationId = insertedRows.id;

      // Step 3: Channex sync — handled automatically by DB triggers on update + insert.

      // Step 4: Audit log + timeline note on original
      try {
        await supabase.from("audit_logs").insert({
          user_id: user?.id || null,
          action: "split_reservation",
          table_name: "reservations",
          record_id: reservation.id,
          changes: {
            new_reservation_id: newReservationId,
            move_date: moveDateStr,
            original_unit_id: currentUnit.id,
            new_unit_id: newUnit.id,
            original_unit_number: currentUnit.unit_number,
            new_unit_number: newUnit.unit_number,
            rate_per_night: effectiveRate,
            pricing_choice: pricingChoice,
            source: fullReservation.source,
            performed_by: user?.id || null,
          },
        });

        // Append a human-readable timeline line
        const timelineLine = `Guest moved from Room ${currentUnit.unit_number} to Room ${newUnit.unit_number} on ${moveDateStr}`;
        await supabase
          .from("reservations")
          .update({
            notes: `${updatedNotes}\n${timelineLine}`,
          })
          .eq("id", reservation.id);
      } catch (logErr) {
        console.warn("Audit log write failed (non-fatal):", logErr);
      }

      toast({
        title: "Guest moved successfully",
        description: `${userName} moved to Room ${newUnit.unit_number} starting ${moveDateStr}.`,
      });
      onSplitComplete();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Split reservation failed:", err);
      toast({
        title: "Failed to move guest",
        description: err.message || "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!reservation || !currentUnit) return null;

  const guestName = reservation.guest_names?.[0] || "Guest";
  const roomLabel =
    currentUnit.booking_com_name || currentUnit.name || `Room ${currentUnit.unit_number}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Move Guest to New Room</DialogTitle>
          <DialogDescription>
            Splits this reservation into two linked bookings: the current room
            ends on the move date, and a new reservation begins in the new room.
          </DialogDescription>
        </DialogHeader>

        {/* Read-only header */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
          <div>
            <span className="font-medium">Guest: </span>
            {guestName}
          </div>
          <div>
            <span className="font-medium">Original reservation: </span>
            {roomLabel} #{currentUnit.unit_number} —{" "}
            {originalCheckIn && format(originalCheckIn, "MMM d")} →{" "}
            {originalCheckOut && format(originalCheckOut, "MMM d")} (
            {originalNights} nights)
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            <Badge variant="secondary" className="capitalize">
              {reservation.status.replace("-", " ")}
            </Badge>
          </div>
        </div>

        {/* Move Date */}
        <div className="space-y-2">
          <Label>Move Date</Label>
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !moveDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {moveDate ? format(moveDate, "EEEE, MMM d, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={moveDate}
                onSelect={(d) => {
                  if (d) {
                    setMoveDate(startOfDay(d));
                    setDatePopoverOpen(false);
                  }
                }}
                disabled={(date) => {
                  const d = startOfDay(date);
                  if (d < minMoveDate) return true;
                  if (maxMoveDate && d > maxMoveDate) return true;
                  return false;
                }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            This becomes the new check-out for the original room and the
            check-in for the new room.
          </p>
        </div>

        {/* End Date (read-only) */}
        <div className="space-y-2">
          <Label>End Date</Label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            {originalCheckOut && format(originalCheckOut, "EEEE, MMM d, yyyy")}
            <span className="text-muted-foreground ml-2">
              (auto-filled from original booking)
            </span>
          </div>
        </div>

        {/* New Room */}
        <div className="space-y-2">
          <Label>New Room</Label>
          <Select
            value={selectedUnitId}
            onValueChange={setSelectedUnitId}
            disabled={!moveDate || loadingUnits}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !moveDate
                    ? "Pick a move date first"
                    : loadingUnits
                    ? "Loading available rooms…"
                    : availableUnits.length === 0
                    ? "No rooms available for this range"
                    : "Select a room"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  #{u.unit_number} — {u.booking_com_name || u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {moveDate && newNights > 0 && (
            <p className="text-xs text-muted-foreground">
              New reservation will cover {newNights} night
              {newNights === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <Label>Pricing for new room</Label>
          <RadioGroup
            value={pricingChoice}
            onValueChange={(v) => setPricingChoice(v as "same" | "custom")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="same" id="rate-same" />
              <Label htmlFor="rate-same" className="font-normal cursor-pointer">
                Same as original booking ({currency} {originalRate.toFixed(2)} /
                night)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="custom" id="rate-custom" />
              <Label htmlFor="rate-custom" className="font-normal cursor-pointer">
                Custom rate per night
              </Label>
            </div>
          </RadioGroup>
          {pricingChoice === "custom" && (
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={`Rate per night in ${currency}`}
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
            />
          )}
          {effectiveRate > 0 && newNights > 0 && (
            <p className="text-xs text-muted-foreground">
              New reservation total: {currency}{" "}
              {(effectiveRate * newNights).toFixed(2)}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-2" />
            )}
            Confirm Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

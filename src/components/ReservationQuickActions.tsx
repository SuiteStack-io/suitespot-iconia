import { useState, useEffect, useRef } from "react";
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
import { AlertTriangle, ArrowRight, Eye, Loader2, LogIn, LogOut, CalendarIcon, Plus, X, User, Clock, Pencil, Trash2, ArrowLeftRight, Download } from "lucide-react";
import { toPng } from 'html-to-image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { usePropertyId, withPropertyFilter } from "@/hooks/usePropertyFilter";
import { usePropertySafe } from "@/lib/propertyContext";
import { RoomSwapDialog } from "@/components/RoomSwapDialog";
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
  group_id?: string;
  arrival_time?: string | null;
  notes?: string | null;
}

interface Unit {
  id: string;
  name: string;
  unit_number: string;
  status?: string;
  booking_com_name?: string;
  location?: string;
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
  const propertyCtx = usePropertySafe();
  const activeProperty = propertyCtx?.activeProperty;
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [unitConflicts, setUnitConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Extend stay state
  const [extendMode, setExtendMode] = useState(false);
  const [extendAgainMode, setExtendAgainMode] = useState(false);
  const [newCheckoutDate, setNewCheckoutDate] = useState<Date | undefined>(undefined);
  const [extensionPricePerNight, setExtensionPricePerNight] = useState<string>("");
  const [extendConflict, setExtendConflict] = useState(false);
  const [extending, setExtending] = useState(false);
  const [fullReservation, setFullReservation] = useState<any>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [siblingExtensions, setSiblingExtensions] = useState<any[]>([]);
  const [originalRate, setOriginalRate] = useState<number | null>(null);
  const [isDiscounted, setIsDiscounted] = useState(false);
  
  // Extension room and source selection state
  const [extensionUnitId, setExtensionUnitId] = useState<string>("");
  const [extensionUnits, setExtensionUnits] = useState<Unit[]>([]);
  const [extensionUnitConflicts, setExtensionUnitConflicts] = useState<Map<string, boolean>>(new Map());
  const [extensionSource, setExtensionSource] = useState<string>("");
  const [userSources, setUserSources] = useState<string[]>([]);
  const [extensionCurrency, setExtensionCurrency] = useState<string>("USD");
  const [extensionPaymentMethod, setExtensionPaymentMethod] = useState<string>("");
  
  // Late checkout state
  const [lateCheckoutMode, setLateCheckoutMode] = useState(false);
  const [processingLateCheckout, setProcessingLateCheckout] = useState(false);
  
  // Edit/Delete late checkout state
  const [editLateCheckoutMode, setEditLateCheckoutMode] = useState(false);
  const [editLateCheckoutFee, setEditLateCheckoutFee] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingLateCheckout, setDeletingLateCheckout] = useState(false);
  const [savingLateCheckoutEdit, setSavingLateCheckoutEdit] = useState(false);
  
  // Edit/Delete extension state
  const [editExtensionMode, setEditExtensionMode] = useState(false);
  const [editExtensionFee, setEditExtensionFee] = useState<string>("");
  const [showDeleteExtensionConfirm, setShowDeleteExtensionConfirm] = useState(false);
  const [deletingExtension, setDeletingExtension] = useState(false);
  const [savingExtensionEdit, setSavingExtensionEdit] = useState(false);
  const [downloadingExtensionConfirmation, setDownloadingExtensionConfirmation] = useState(false);
  const [extensionUnitDetails, setExtensionUnitDetails] = useState<{ name: string; unit_number: string | null; booking_com_name: string | null; tax_percentage: number | null } | null>(null);
  
  const extensionConfirmationRef = useRef<HTMLDivElement>(null);
  
  // Swap room state
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const propertyId = usePropertyId();

  // Fetch current user's name on mount
  useEffect(() => {
    const fetchUserName = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.full_name) {
          setCurrentUserName(data.full_name);
        }
      }
    };
    fetchUserName();
  }, [user?.id]);

  useEffect(() => {
    if (open && reservation) {
      fetchAvailableUnits();
      fetchFullReservation();
      fetchUserSources();
      // Reset modes when opening
      setExtendMode(false);
      setExtendAgainMode(false);
      setLateCheckoutMode(false);
      setEditLateCheckoutMode(false);
      setEditLateCheckoutFee("");
      setShowDeleteConfirm(false);
      setEditExtensionMode(false);
      setEditExtensionFee("");
      setShowDeleteExtensionConfirm(false);
      setNewCheckoutDate(undefined);
      setExtensionPricePerNight("");
      setExtendConflict(false);
      setSiblingExtensions([]);
      setOriginalRate(null);
      setIsDiscounted(false);
      // Reset extension-specific state
      setExtensionUnitId(reservation.unit_id);
      setExtensionSource("");
      setExtensionUnits([]);
      setExtensionUnitConflicts(new Map());
      setExtensionCurrency("USD");
      setExtensionPaymentMethod("");
    }
  }, [open, reservation]);

  // Check for conflicts when new checkout date or extension unit changes
  useEffect(() => {
    if (newCheckoutDate && reservation?.unit_id) {
      checkExtendConflict();
      fetchExtensionUnits();
    }
  }, [newCheckoutDate, extensionUnitId]);

  const fetchFullReservation = async () => {
    if (!reservation) return;
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", reservation.id)
      .single();
    if (data) {
      setFullReservation(data);
      
      // If this is an extension, fetch all sibling extensions
      if (data.group_id && /-EXT\d*$/.test(data.booking_reference)) {
        const { data: siblings } = await supabase
          .from("reservations")
          .select("*")
          .eq("group_id", data.group_id)
          .is("cancelled_at", null)
          .order("check_in_date", { ascending: true });
        
        const extSiblings = (siblings || []).filter(s => /-EXT\d*$/.test(s.booking_reference));
        setSiblingExtensions(extSiblings);
      }
    }
  };

  const checkExtendConflict = async () => {
    if (!reservation || !newCheckoutDate) return;
    
    const currentCheckout = new Date(reservation.check_out_date);
    if (newCheckoutDate <= currentCheckout) {
      setExtendConflict(false);
      return;
    }

    const unitToCheck = extensionUnitId || reservation.unit_id;

    // Check for conflicts in the extended period
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .eq("unit_id", unitToCheck)
      .neq("id", reservation.id)
      .in("status", ["confirmed", "checked-in"])
      .lt("check_in_date", format(newCheckoutDate, "yyyy-MM-dd"))
      .gt("check_out_date", reservation.check_out_date);

    // Also check blocked dates
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("id")
      .eq("unit_id", unitToCheck)
      .gte("blocked_date", reservation.check_out_date)
      .lt("blocked_date", format(newCheckoutDate, "yyyy-MM-dd"));

    setExtendConflict((conflicts && conflicts.length > 0) || (blockedDates && blockedDates.length > 0));
  };

  const fetchExtensionUnits = async () => {
    if (!newCheckoutDate || !reservation) return;
    
    // Fetch all available units for the active property
    const { data: units } = await withPropertyFilter(supabase
      .from("units")
      .select("id, name, unit_number, status, booking_com_name"), propertyId)
      .eq("status", "available")
      .order("unit_number");
    
    // Check for conflicts in the extension period for each unit
    const conflictMap = new Map<string, boolean>();
    
    for (const unit of units || []) {
      const { data: conflicts } = await supabase
        .from("reservations")
        .select("id")
        .eq("unit_id", unit.id)
        .neq("id", reservation.id)
        .in("status", ["confirmed", "checked-in"])
        .lt("check_in_date", format(newCheckoutDate, "yyyy-MM-dd"))
        .gt("check_out_date", reservation.check_out_date);
      
      const { data: blocked } = await supabase
        .from("blocked_dates")
        .select("id")
        .eq("unit_id", unit.id)
        .gte("blocked_date", reservation.check_out_date)
        .lt("blocked_date", format(newCheckoutDate, "yyyy-MM-dd"));
      
      conflictMap.set(unit.id, (conflicts?.length || 0) > 0 || (blocked?.length || 0) > 0);
    }
    
    setExtensionUnits(units || []);
    setExtensionUnitConflicts(conflictMap);
  };

  const fetchUserSources = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .order("full_name");
    
    const names = data?.map(p => p.full_name).filter(Boolean) as string[] || [];
    setUserSources(names);
  };

  const fetchAvailableUnits = async () => {
    if (!reservation) return;
    setLoading(true);

    try {
      // Fetch all available units for the active property
      const { data: units, error: unitsError } = await withPropertyFilter(supabase
        .from("units")
        .select("id, name, unit_number, status, booking_com_name, location"), propertyId)
        .eq("status", "available")
        .order("unit_number");

      if (unitsError) throw unitsError;

      // Fetch reservations that might conflict (only confirmed and checked-in)
      const { data: conflictingReservations, error: resError } = await supabase
        .from("reservations")
        .select("*")
        .in("status", ["confirmed", "checked-in"])
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
      
      // Calculate nights
      const checkIn = new Date(reservation.check_in_date);
      const checkOut = new Date(reservation.check_out_date);
      const nightsCount = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      // Send room change notification email
      try {
        await supabase.functions.invoke('send-room-change-notification', {
          body: {
            reservation_id: reservation.id,
            booking_reference: reservation.booking_reference,
            guest_names: reservation.guest_names,
            check_in_date: reservation.check_in_date,
            check_out_date: reservation.check_out_date,
            old_unit_name: currentUnit?.name,
            old_unit_number: currentUnit?.unit_number,
            new_unit_name: newUnit?.name,
            new_unit_number: newUnit?.unit_number,
            nights: nightsCount,
            source: reservation.source,
          }
        });
        console.log("Room change notification sent successfully");
      } catch (notifyError) {
        console.error("Failed to send room change notification:", notifyError);
        // Don't throw - the move was successful, notification is secondary
      }

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
      const updateData: Record<string, any> = { status: newStatus };
      
      // Add timestamp for check-in/check-out
      if (newStatus === 'checked-in') {
        updateData.checked_in_at = new Date().toISOString();
      } else if (newStatus === 'checked-out') {
        updateData.checked_out_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from("reservations")
        .update(updateData)
        .eq("id", reservation.id);

      if (error) throw error;

      // Send notifications for check-in/check-out
      if (newStatus === 'checked-in') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.functions.invoke('send-checkin-notification', {
            body: { reservationId: reservation.id, userId: user?.id }
          });
        } catch (notifError) {
          console.error('Failed to send check-in notification:', notifError);
        }
      } else if (newStatus === 'checked-out') {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.functions.invoke('send-checkout-notification', {
            body: { reservationId: reservation.id, userId: user?.id, checkedOutAt: new Date().toISOString() }
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
    
    if (!extensionSource) {
      toast({
        title: "Source Required",
        description: "Please select a source for the extension",
        variant: "destructive",
      });
      return;
    }
    
    if (!extensionPaymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method for the extension",
        variant: "destructive",
      });
      return;
    }
    
    // For "Extend Again", use the last extension's checkout as the base
    const extendFromDate = extendAgainMode && siblingExtensions.length > 0
      ? new Date(siblingExtensions[siblingExtensions.length - 1].check_out_date + 'T00:00:00')
      : new Date(reservation.check_out_date + 'T00:00:00');
    const additionalNights = differenceInCalendarDays(newCheckoutDate, extendFromDate);
    
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
      const extensionSubtotalCalc = additionalNights * pricePerNight;
      const extensionVATCalc = extensionSubtotalCalc * 0.14;
      const extensionTotalCalc = extensionSubtotalCalc + extensionVATCalc;
      const extensionCommissionRate = 10; // Standard direct rate for extensions
      // Commission calculated on subtotal (excluding VAT) - effective Jan 2026
      const extensionCommission = extensionSubtotalCalc * (extensionCommissionRate / 100);
      const extensionNetRevenue = extensionTotalCalc - extensionCommission;

      // Generate or use existing group_id to link reservations
      const groupId = fullReservation.group_id || crypto.randomUUID();

      // Determine the booking reference suffix
      let newBookingRef: string;
      if (extendAgainMode && siblingExtensions.length > 0) {
        // "Extend Again" mode: count existing extensions to determine suffix
        const baseRef = getBaseBookingRef(reservation.booking_reference);
        const extCount = siblingExtensions.length;
        newBookingRef = extCount === 1 ? `${baseRef}-EXT2` : `${baseRef}-EXT${extCount + 1}`;
      } else {
        // First extension from original booking
        newBookingRef = `${reservation.booking_reference}-EXT`;
      }

      // Determine check-in date for the extension
      const extensionCheckInDate = extendAgainMode 
        ? siblingExtensions[siblingExtensions.length - 1].check_out_date 
        : reservation.check_out_date;

      // Create a new reservation for the extension
      const extensionReservation = {
        unit_id: extensionUnitId || reservation.unit_id, // Use selected unit
        check_in_date: extensionCheckInDate, // Extension starts where previous ends
        check_out_date: format(newCheckoutDate, "yyyy-MM-dd"),
        
        guest_names: fullReservation.guest_names,
        contact_email: fullReservation.contact_email,
        contact_phone: fullReservation.contact_phone,
        booking_reference: newBookingRef,
        source: extensionSource, // Use selected source
        channel: "Direct",
        status: fullReservation.status,
        number_of_guests: fullReservation.number_of_guests,
        adults: fullReservation.adults,
        children: fullReservation.children,
        guest_nationality: fullReservation.guest_nationality,
        total_price: extensionTotalCalc,
        price_per_night: pricePerNight,
        commission_rate: extensionCommissionRate,
        commission_amount: extensionCommission,
        net_revenue: extensionNetRevenue,
        group_id: groupId,
        currency: extensionCurrency,
        payment_method: extensionPaymentMethod,
        notes: `Extension of original booking ${getBaseBookingRef(reservation.booking_reference)}`,
      };

      // Insert the extension reservation and get the ID
      const { data: insertResult, error: insertError } = await supabase
        .from("reservations")
        .insert(extensionReservation)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Send admin notification for the extension
      try {
        await supabase.functions.invoke('send-extension-notification', {
          body: { 
            extensionReservationId: insertResult.id,
            originalBookingReference: reservation.booking_reference 
          }
        });
        console.log('Extension notification sent successfully');
      } catch (notifError) {
        console.error('Failed to send extension notification:', notifError);
        // Don't fail the extension if notification fails
      }

      // Update the original reservation's group_id if not already set
      if (!fullReservation.group_id) {
        await supabase
          .from("reservations")
          .update({ group_id: groupId })
          .eq("id", reservation.id);
      }

      const selectedUnit = extensionUnits.find(u => u.id === extensionUnitId);
      const roomInfo = selectedUnit && selectedUnit.id !== reservation.unit_id 
        ? ` in ${selectedUnit.name} #${selectedUnit.unit_number}` 
        : '';

      toast({
        title: "Extension Created",
        description: `${additionalNights} night${additionalNights > 1 ? 's' : ''}${roomInfo} attributed to ${extensionSource} (+$${extensionTotalCalc.toFixed(2)} incl. VAT)`,
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

  const LATE_CHECKOUT_FEE = 50; // Flat $50 fee including VAT
  const lateCheckoutBase = LATE_CHECKOUT_FEE / 1.14;
  const lateCheckoutVAT = LATE_CHECKOUT_FEE - lateCheckoutBase;

  const handleLateCheckout = async () => {
    if (!reservation || !fullReservation) return;

    setProcessingLateCheckout(true);
    try {
      const commissionRate = 10;
      // Commission calculated on base amount (excluding VAT) - effective Jan 2026
      const commissionAmount = lateCheckoutBase * (commissionRate / 100);
      const netRevenue = LATE_CHECKOUT_FEE - commissionAmount;

      // Generate or use existing group_id to link reservations
      const groupId = fullReservation.group_id || crypto.randomUUID();

      // Create a new reservation for the late checkout (attributed to current user)
      const lateCheckoutReservation = {
        unit_id: reservation.unit_id,
        check_in_date: reservation.check_out_date,
        check_out_date: reservation.check_out_date, // Same day
        
        guest_names: fullReservation.guest_names,
        contact_email: fullReservation.contact_email,
        contact_phone: fullReservation.contact_phone,
        booking_reference: `${reservation.booking_reference}-LC`,
        source: currentUserName || "Admin",
        channel: "Direct",
        status: fullReservation.status,
        number_of_guests: fullReservation.number_of_guests,
        adults: fullReservation.adults,
        children: fullReservation.children,
        guest_nationality: fullReservation.guest_nationality,
        total_price: LATE_CHECKOUT_FEE,
        price_per_night: 0,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        net_revenue: netRevenue,
        group_id: groupId,
        currency: fullReservation.currency || "USD",
        notes: `Late checkout fee for booking ${reservation.booking_reference}`,
      };

      // Insert the late checkout reservation
      const { data: insertResult, error: insertError } = await supabase
        .from("reservations")
        .insert(lateCheckoutReservation)
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Update the original reservation's group_id if not already set
      if (!fullReservation.group_id) {
        await supabase
          .from("reservations")
          .update({ group_id: groupId })
          .eq("id", reservation.id);
      }

      // Send admin notification for the late checkout
      try {
        await supabase.functions.invoke('send-late-checkout-notification', {
          body: { 
            lateCheckoutReservationId: insertResult.id,
            originalBookingReference: reservation.booking_reference 
          }
        });
      } catch (notifError) {
        console.error('Failed to send late checkout notification:', notifError);
        // Don't fail the late checkout if notification fails
      }

      toast({
        title: "Late Checkout Added",
        description: `$${LATE_CHECKOUT_FEE} late checkout fee attributed to ${currentUserName || "Admin"}`,
      });

      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error adding late checkout:", error);
      toast({
        title: "Late Checkout Failed",
        description: "Failed to add late checkout fee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingLateCheckout(false);
    }
  };

  const handleEditLateCheckout = async () => {
    if (!reservation || !editLateCheckoutFee) return;
    
    setSavingLateCheckoutEdit(true);
    try {
      const newFee = parseFloat(editLateCheckoutFee);
      const baseAmount = newFee / 1.14; // Extract base excluding VAT
      const commissionRate = 10;
      // Commission calculated on base amount (excluding VAT) - effective Jan 2026
      const commissionAmount = baseAmount * (commissionRate / 100);
      const netRevenue = newFee - commissionAmount;

      const { error } = await supabase
        .from("reservations")
        .update({
          total_price: newFee,
          commission_amount: commissionAmount,
          net_revenue: netRevenue,
        })
        .eq("id", reservation.id);

      if (error) throw error;

      toast({
        title: "Late Checkout Updated",
        description: `Fee updated to $${newFee.toFixed(2)}`,
      });

      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error updating late checkout:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update late checkout fee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingLateCheckoutEdit(false);
    }
  };

  const handleDeleteLateCheckout = async () => {
    if (!reservation) return;
    
    setDeletingLateCheckout(true);
    try {
      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", reservation.id);

      if (error) throw error;

      toast({
        title: "Late Checkout Removed",
        description: "Late checkout fee has been deleted.",
      });

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error deleting late checkout:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete late checkout fee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingLateCheckout(false);
    }
  };

  const handleEditExtension = async () => {
    if (!reservation || !editExtensionFee) return;
    
    setSavingExtensionEdit(true);
    try {
      const newTotal = parseFloat(editExtensionFee);
      const baseAmount = newTotal / 1.14; // Extract base excluding VAT
      const commissionRate = 10;
      // Commission calculated on base amount (excluding VAT) - effective Jan 2026
      const commissionAmount = baseAmount * (commissionRate / 100);
      const netRevenue = newTotal - commissionAmount;

      const { error } = await supabase
        .from("reservations")
        .update({
          total_price: newTotal,
          commission_amount: commissionAmount,
          net_revenue: netRevenue,
        })
        .eq("id", reservation.id);

      if (error) throw error;

      toast({
        title: "Extension Updated",
        description: `Total updated to $${newTotal.toFixed(2)}`,
      });

      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error updating extension:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update extension. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingExtensionEdit(false);
    }
  };

  const handleDeleteExtension = async () => {
    if (!reservation) return;
    
    setDeletingExtension(true);
    try {
      const { error } = await supabase
        .from("reservations")
        .delete()
        .eq("id", reservation.id);

      if (error) throw error;

      toast({
        title: "Extension Removed",
        description: "Extension has been deleted.",
      });

      setShowDeleteExtensionConfirm(false);
      onOpenChange(false);
      onMoveComplete();
    } catch (error) {
      console.error("Error deleting extension:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete extension. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingExtension(false);
    }
  };

  // Fetch extension unit details when this is an extension reservation
  useEffect(() => {
    const fetchExtensionUnitDetails = async () => {
      if (!reservation || !reservation.unit_id) return;
      const isExt = /-EXT\d*$/.test(reservation.booking_reference || '');
      if (!isExt) return;
      
      const { data } = await supabase
        .from("units")
        .select("name, unit_number, booking_com_name, tax_percentage")
        .eq("id", reservation.unit_id)
        .single();
      
      if (data) {
        setExtensionUnitDetails(data);
      }
    };
    if (open && reservation) {
      fetchExtensionUnitDetails();
    }
  }, [open, reservation]);

  const handleDownloadExtensionConfirmation = async () => {
    if (!extensionConfirmationRef.current || !fullReservation) return;
    
    setDownloadingExtensionConfirmation(true);
    try {
      const dataUrl = await toPng(extensionConfirmationRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      const guestName = fullReservation.guest_names?.[0]?.split(' ')[0] || 'guest';
      const checkIn = format(new Date(fullReservation.check_in_date), 'yyyy-MM-dd');
      link.download = `suitespot-extension-confirmation-${guestName}-${checkIn}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Downloaded", description: "Extension confirmation downloaded successfully" });
    } catch (error) {
      console.error('Error downloading extension confirmation:', error);
      toast({ title: "Download Failed", description: "Failed to download confirmation", variant: "destructive" });
    } finally {
      setDownloadingExtensionConfirmation(false);
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

  // Check if this is a late checkout fee (ends with -LC and nights = 0)
  const isLateCheckout = reservation.booking_reference?.endsWith("-LC") && nights === 0;
  const lateCheckoutCurrentFee = reservation.total_price || 50;
  
  // Check if this is an extension (ends with -EXT, -EXT2, -EXT3, etc.)
  const isExtension = /-EXT\d*$/.test(reservation.booking_reference || '') && !isLateCheckout;
  const extensionCurrentTotal = reservation.total_price || 0;
  const getBaseBookingRef = (ref: string) => ref.replace(/-EXT\d*$/, '');

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservation Quick Actions</DialogTitle>
          <DialogDescription>
            {isLateCheckout 
              ? "Manage late checkout fee" 
              : isExtension
                ? "Manage stay extension"
                : extendMode 
                  ? "Extend the guest's stay" 
                  : lateCheckoutMode 
                    ? "Add late checkout fee" 
                    : "View details, update status, or move this reservation"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reservation Summary */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-lg">{reservation.guest_names[0]}</span>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={reservation.status === 'completed' ? 'secondary' : reservation.status === 'checked-out' ? 'outline' : 'default'}>
                  {reservation.status.replace('-', ' ')}
                </Badge>
                <Badge variant={getSourceBadgeColor(reservation.source)}>
                  {reservation.source || "Unknown"}
                </Badge>
                {fullReservation?.guest_nationality && (
                  <Badge className="bg-teal-100 text-teal-800 border-teal-300 hover:bg-teal-100">
                    {fullReservation.guest_nationality}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(reservation.check_in_date), "MMM d, yyyy")} 
              <ArrowRight className="inline h-3 w-3 mx-1" />
              {format(new Date(reservation.check_out_date), "MMM d, yyyy")}
              <span className="ml-2">
                {isLateCheckout ? "(Late Checkout)" : `(${nights} night${nights > 1 ? "s" : ""})`}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Ref: {reservation.booking_reference}
            </div>
            {(() => {
              const arrivalTime = reservation.arrival_time || (() => {
                if (!reservation.notes) return null;
                const patterns = [
                  /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})[:\.](\d{2})/i,
                  /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})\s*(am|pm)/i,
                ];
                for (const pattern of patterns) {
                  const match = reservation.notes!.match(pattern);
                  if (match) {
                    let hours = parseInt(match[1], 10);
                    const minutesOrAmPm = match[2];
                    if (minutesOrAmPm && /^(am|pm)$/i.test(minutesOrAmPm)) {
                      if (minutesOrAmPm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
                      if (minutesOrAmPm.toLowerCase() === 'am' && hours === 12) hours = 0;
                      return `${hours.toString().padStart(2, '0')}:00`;
                    }
                    return `${hours.toString().padStart(2, '0')}:${minutesOrAmPm}`;
                  }
                }
                return null;
              })();
              if (!arrivalTime) return null;
              return (
                <Badge
                  variant="outline"
                  className="bg-violet-100 text-violet-800 border-violet-300 gap-1 mt-1 w-fit"
                >
                  <Clock className="h-3 w-3" />
                  Guest arrives at {arrivalTime}
                </Badge>
              );
            })()}
          </div>

          {isLateCheckout ? (
            /* Late Checkout Management Mode */
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <span className="font-semibold text-amber-800">Late Checkout Fee</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Linked to: {reservation.booking_reference.replace("-LC", "")}
                </div>
              </div>

              {!editLateCheckoutMode ? (
                <>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground mb-1">Current Fee</div>
                      <div className="text-3xl font-bold text-primary">${lateCheckoutCurrentFee.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Attributed to: {reservation.source || "Admin"}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setEditLateCheckoutMode(true);
                        setEditLateCheckoutFee(lateCheckoutCurrentFee.toString());
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Fee
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Fee Amount ($)</label>
                    <Input
                      type="number"
                      placeholder="Enter new fee amount"
                      value={editLateCheckoutFee}
                      onChange={(e) => setEditLateCheckoutFee(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {editLateCheckoutFee && parseFloat(editLateCheckoutFee) > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Base Amount</span>
                        <span>${(parseFloat(editLateCheckoutFee) / 1.14).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT (14%)</span>
                        <span>${(parseFloat(editLateCheckoutFee) - parseFloat(editLateCheckoutFee) / 1.14).toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-primary">${parseFloat(editLateCheckoutFee).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setEditLateCheckoutMode(false);
                        setEditLateCheckoutFee("");
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleEditLateCheckout}
                      disabled={!editLateCheckoutFee || parseFloat(editLateCheckoutFee) <= 0 || savingLateCheckoutEdit}
                    >
                      {savingLateCheckoutEdit ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : isExtension && !extendAgainMode ? (
            /* Extension Management Mode */
            <div className="space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">Stay Extension</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Linked to: {getBaseBookingRef(reservation.booking_reference)}
                </div>
              </div>

              {!editExtensionMode ? (
                <>
                  {/* Multi-extension list */}
                  {siblingExtensions.length > 1 ? (
                    <div className="space-y-2">
                      {siblingExtensions.map((ext, idx) => {
                        const extNights = differenceInCalendarDays(
                          new Date(ext.check_out_date),
                          new Date(ext.check_in_date)
                        );
                        return (
                          <div key={ext.id} className={`p-3 rounded-lg ${ext.id === reservation.id ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-muted/50'}`}>
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Extension {idx + 1}</span>
                              <span className="text-sm font-semibold">${(ext.total_price || 0).toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {format(new Date(ext.check_in_date), "MMM d")} → {format(new Date(ext.check_out_date), "MMM d")} ({extNights} night{extNights !== 1 ? 's' : ''})
                            </div>
                          </div>
                        );
                      })}
                      <div className="p-3 bg-muted/50 rounded-lg border-t-2 border-primary/20">
                        <div className="flex justify-between items-center font-semibold">
                          <span>Combined Extension Total</span>
                          <span className="text-primary text-lg">${siblingExtensions.reduce((sum, e) => sum + (e.total_price || 0), 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Extension Total</div>
                        <div className="text-3xl font-bold text-primary">${extensionCurrentTotal.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {nights} night{nights !== 1 ? 's' : ''} • Attributed to: {reservation.source || "Admin"}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extend Again Button */}
                  <Button
                    variant="outline"
                    className="w-full border-blue-500/30 text-blue-700 hover:bg-blue-500/10"
                    onClick={() => {
                      setExtendAgainMode(true);
                      // Pre-fill price from first extension's nightly rate
                      const firstExt = siblingExtensions.length > 0 ? siblingExtensions[0] : fullReservation;
                      const firstExtNights = differenceInCalendarDays(
                        new Date(firstExt.check_out_date),
                        new Date(firstExt.check_in_date)
                      );
                      if (firstExtNights > 0 && firstExt.total_price) {
                        const netRate = (firstExt.total_price / 1.14) / firstExtNights;
                        setExtensionPricePerNight(netRate.toFixed(2));
                      }
                      // Set check-in to last extension's checkout
                      const lastExt = siblingExtensions.length > 0 ? siblingExtensions[siblingExtensions.length - 1] : fullReservation;
                      setExtensionUnitId(reservation.unit_id);
                      setExtensionSource("");
                      setExtensionPaymentMethod("");
                      setNewCheckoutDate(undefined);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Extend Again
                  </Button>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleDownloadExtensionConfirmation}
                      disabled={downloadingExtensionConfirmation}
                    >
                      {downloadingExtensionConfirmation ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Confirmation
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setEditExtensionMode(true);
                        setEditExtensionFee(extensionCurrentTotal.toString());
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit Total
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setShowDeleteExtensionConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New Total Amount ($)</label>
                    <Input
                      type="number"
                      placeholder="Enter new total amount"
                      value={editExtensionFee}
                      onChange={(e) => setEditExtensionFee(e.target.value)}
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {editExtensionFee && parseFloat(editExtensionFee) > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Commission (10%)</span>
                        <span>${(parseFloat(editExtensionFee) * 0.1).toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Net Revenue</span>
                        <span className="text-primary">${(parseFloat(editExtensionFee) * 0.9).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setEditExtensionMode(false);
                        setEditExtensionFee("");
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleEditExtension}
                      disabled={!editExtensionFee || parseFloat(editExtensionFee) <= 0 || savingExtensionEdit}
                    >
                      {savingExtensionEdit ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Pencil className="h-4 w-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : extendAgainMode ? (
            /* Extend Again Mode - reuses extend form with pre-fills */
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="text-sm font-medium mb-2">Extending from</div>
                <div className="text-lg font-semibold">
                  {format(new Date(siblingExtensions.length > 0 ? siblingExtensions[siblingExtensions.length - 1].check_out_date + 'T00:00:00' : reservation.check_out_date + 'T00:00:00'), "EEEE, MMM d, yyyy")}
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
                      disabled={(date) => {
                        const extendFrom = new Date(siblingExtensions.length > 0 ? siblingExtensions[siblingExtensions.length - 1].check_out_date + 'T00:00:00' : reservation.check_out_date + 'T00:00:00');
                        return date <= extendFrom;
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Room Selection */}
              {newCheckoutDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Room for Extension</label>
                  <Select value={extensionUnitId} onValueChange={setExtensionUnitId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room for extension" />
                    </SelectTrigger>
                    <SelectContent>
                      {extensionUnits.map((unit) => {
                        const hasConflict = extensionUnitConflicts.get(unit.id);
                        const isCurrentRoom = unit.id === reservation?.unit_id;
                        return (
                          <SelectItem key={unit.id} value={unit.id} disabled={hasConflict}>
                            <div className="flex items-center gap-2">
                              {hasConflict && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              <span>{unit.name} #{unit.unit_number}</span>
                              {isCurrentRoom && <span className="text-xs text-muted-foreground">(Current)</span>}
                              {hasConflict && <span className="text-xs text-destructive">(Conflict)</span>}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(() => {
                const extendFromDate = new Date(siblingExtensions.length > 0 ? siblingExtensions[siblingExtensions.length - 1].check_out_date + 'T00:00:00' : reservation.check_out_date + 'T00:00:00');
                const extAgainNights = newCheckoutDate ? differenceInCalendarDays(newCheckoutDate, extendFromDate) : 0;
                
                // Calculate price floor from first extension
                const firstExt = siblingExtensions.length > 0 ? siblingExtensions[0] : fullReservation;
                const firstExtNights = firstExt ? differenceInCalendarDays(new Date(firstExt.check_out_date), new Date(firstExt.check_in_date)) : 0;
                const priceFloor = firstExt && firstExtNights > 0 
                  ? Math.floor(((firstExt.total_price / 1.14) / firstExtNights) * 100) / 100 
                  : 0;
                const currentPrice = parseFloat(extensionPricePerNight) || 0;
                const isBelowFloor = currentPrice > 0 && currentPrice < priceFloor;
                
                const extSubtotal = extAgainNights > 0 && currentPrice > 0 ? extAgainNights * currentPrice : 0;
                const extVAT = extSubtotal * 0.14;
                const extTotal = extSubtotal + extVAT;

                return (
                  <>
                    {extAgainNights > 0 && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm text-muted-foreground">Additional Nights</div>
                        <div className="text-2xl font-bold">{extAgainNights}</div>
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
                        className={isBelowFloor ? "border-destructive" : ""}
                      />
                      {isBelowFloor ? (
                        <p className="text-xs text-destructive">
                          Rate cannot be lower than the previous extension rate of ${priceFloor.toFixed(2)}/night
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Minimum rate: ${priceFloor.toFixed(2)}/night (based on first extension)
                        </p>
                      )}
                    </div>

                    {extSubtotal > 0 && !isBelowFloor && (
                      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Subtotal ({extAgainNights} × ${currentPrice.toFixed(2)})
                          </span>
                          <span>${extSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">VAT (14%)</span>
                          <span>+${extVAT.toFixed(2)}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-semibold">
                          <span>Extension Total</span>
                          <span className="text-primary">${extTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {/* Currency and Payment Method */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Currency <span className="text-destructive">*</span></label>
                        <Select value={extensionCurrency} onValueChange={setExtensionCurrency}>
                          <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EGP">EGP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Payment Method <span className="text-destructive">*</span></label>
                        <Select value={extensionPaymentMethod} onValueChange={setExtensionPaymentMethod}>
                          <SelectTrigger><SelectValue placeholder="Select payment" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Source Selection */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Source <span className="text-destructive">*</span></label>
                      <Select value={extensionSource} onValueChange={setExtensionSource}>
                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          {userSources.map((userName) => (
                            <SelectItem key={userName} value={userName}>{userName}</SelectItem>
                          ))}
                          <SelectItem value="KSS">KSS</SelectItem>
                          <SelectItem value="booking.com">booking.com</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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
                          setExtendAgainMode(false);
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
                        disabled={
                          !newCheckoutDate || extAgainNights <= 0 || !currentPrice || currentPrice <= 0 || 
                          isBelowFloor || extending || !extensionSource || !extensionPaymentMethod || 
                          extendConflict || extensionUnitConflicts.get(extensionUnitId)
                        }
                      >
                        {extending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Confirm Extension
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : !extendMode && !lateCheckoutMode ? (
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLateCheckoutMode(true)}
                    disabled={updatingStatus}
                    className="gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Late Checkout
                  </Button>
                  {updatingStatus && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                </div>
              </div>

              {/* Current Room */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Room</label>
                <div className="p-3 border rounded-lg bg-background">
                  {currentUnit ? (
                    <span>{(currentUnit as any).booking_com_name || currentUnit.name} #{currentUnit.unit_number}</span>
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
                              <span>{unit.booking_com_name || unit.name} #{unit.unit_number}</span>
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

              {/* Swap Room Button */}
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSwapDialogOpen(true)}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Swap Rooms with Another Reservation
                </Button>
              </div>
            </>
          ) : lateCheckoutMode ? (
            /* Late Checkout Mode */
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-sm font-medium mb-2">Checkout Date</div>
                <div className="text-lg font-semibold">
                  {format(currentCheckout, "EEEE, MMM d, yyyy")}
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground mb-1">Late Checkout Fee</div>
                  <div className="text-3xl font-bold text-primary">${LATE_CHECKOUT_FEE}</div>
                  <div className="text-xs text-muted-foreground">(Flat fee, VAT included)</div>
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Amount</span>
                    <span>${lateCheckoutBase.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">VAT (14%)</span>
                    <span>${lateCheckoutVAT.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total</span>
                    <span className="text-primary">${LATE_CHECKOUT_FEE.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Attribution Notice */}
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">Late checkout attributed to:</span>
                  <span className="font-medium">{currentUserName || "Admin"}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This creates a linked reservation. Commission (10%) will be credited to you.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setLateCheckoutMode(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleLateCheckout}
                  disabled={processingLateCheckout}
                >
                  {processingLateCheckout ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  Confirm Late Checkout
                </Button>
              </div>
            </div>
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

              {/* Room Selection for Extension */}
              {additionalNights > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Room for Extension</label>
                  <Select value={extensionUnitId} onValueChange={(value) => {
                    setExtensionUnitId(value);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select room for extension" />
                    </SelectTrigger>
                    <SelectContent>
                      {extensionUnits.map((unit) => {
                        const hasConflict = extensionUnitConflicts.get(unit.id);
                        const isCurrentRoom = unit.id === reservation?.unit_id;
                        return (
                          <SelectItem 
                            key={unit.id} 
                            value={unit.id}
                            disabled={hasConflict}
                          >
                            <div className="flex items-center gap-2">
                              {hasConflict && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              <span>{unit.name} #{unit.unit_number}</span>
                              {isCurrentRoom && <span className="text-xs text-muted-foreground">(Current)</span>}
                              {hasConflict && <span className="text-xs text-destructive">(Conflict)</span>}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The price you enter below will apply regardless of the room's standard rate
                  </p>
                </div>
              )}

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

              {/* Currency and Payment Method Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Currency <span className="text-destructive">*</span></label>
                  <Select value={extensionCurrency} onValueChange={setExtensionCurrency}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EGP">EGP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method <span className="text-destructive">*</span></label>
                  <Select value={extensionPaymentMethod} onValueChange={setExtensionPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Source <span className="text-destructive">*</span></label>
                <Select value={extensionSource} onValueChange={setExtensionSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {userSources.map((userName) => (
                      <SelectItem key={userName} value={userName}>
                        {userName}
                      </SelectItem>
                    ))}
                    <SelectItem value="KSS">KSS</SelectItem>
                    <SelectItem value="booking.com">booking.com</SelectItem>
                    <SelectItem value="Others">Others</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This creates a new reservation linked to the original. Commission (10%) will be credited to the selected source.
                </p>
              </div>

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
                  disabled={!canExtend || extending || !extensionSource || !extensionPaymentMethod || extensionUnitConflicts.get(extensionUnitId)}
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Late Checkout Fee?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the ${lateCheckoutCurrentFee?.toFixed(2)} late checkout fee for {reservation?.guest_names[0]}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingLateCheckout}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteLateCheckout}
                disabled={deletingLateCheckout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingLateCheckout ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Extension Confirmation Dialog */}
        <AlertDialog open={showDeleteExtensionConfirm} onOpenChange={setShowDeleteExtensionConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Extension?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove the ${extensionCurrentTotal?.toFixed(2)} extension ({nights} night{nights !== 1 ? 's' : ''}) for {reservation?.guest_names[0]}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingExtension}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteExtension}
                disabled={deletingExtension}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingExtension ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>

      {/* Room Swap Dialog */}
      <RoomSwapDialog
        open={swapDialogOpen}
        onOpenChange={setSwapDialogOpen}
        reservation={reservation}
        currentUnit={currentUnit}
        onSuccess={onMoveComplete}
      />
    </Dialog>

    {/* Hidden Extension Confirmation Card for Download */}
    {isExtension && fullReservation && (
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div
          ref={extensionConfirmationRef}
          className="bg-white p-8"
          style={{ width: '600px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              SuiteSpot
            </h1>
            <p className="text-lg font-medium text-gray-900 mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {activeProperty?.name || 'SuiteSpot'}
            </p>
            <p className="text-gray-500 text-sm">Reservation Confirmation</p>
          </div>

          {/* Booking Reference */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-gray-500 text-sm mb-1">Booking Reference</p>
            <p className="text-xl font-bold text-gray-900">{fullReservation.booking_reference}</p>
          </div>

          {/* Guest Details */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Guest Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Guest Name(s)</span>
                <span className="font-medium text-gray-900">{fullReservation.guest_names?.join(', ') || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Number of Guests</span>
                <span className="font-medium text-gray-900">{fullReservation.number_of_guests}</span>
              </div>
              {fullReservation.guest_nationality && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Nationality</span>
                  <span className="font-medium text-gray-900">{fullReservation.guest_nationality}</span>
                </div>
              )}
            </div>
          </div>

          {/* Accommodation */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Accommodation</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Suite</span>
                <span className="font-medium text-gray-900">
                  {extensionUnitDetails?.booking_com_name || extensionUnitDetails?.name || 'N/A'}
                </span>
              </div>
              {extensionUnitDetails?.unit_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Unit Number</span>
                  <span className="font-medium text-gray-900">#{extensionUnitDetails.unit_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stay Dates */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Stay Dates</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Check-in</span>
                <span className="font-medium text-gray-900">
                  {format(new Date(fullReservation.check_in_date), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-out</span>
                <span className="font-medium text-gray-900">
                  {format(new Date(fullReservation.check_out_date), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-900">{fullReservation.nights || nights} night(s)</span>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Pricing Summary</h2>
            {(() => {
              const extNights = fullReservation.nights || nights;
              const pricePerNight = fullReservation.price_per_night || 0;
              const subtotal = pricePerNight * extNights;
              const taxPercentage = extensionUnitDetails?.tax_percentage || 14;
              const taxAmount = subtotal * (taxPercentage / 100);
              const totalWithTax = subtotal + taxAmount;

              return (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price per Night</span>
                    <span className="font-medium text-gray-900">USD {pricePerNight.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal ({extNights} nights)</span>
                    <span className="font-medium text-gray-900">USD {subtotal.toFixed(2)}</span>
                  </div>
                  {taxPercentage > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taxes & Fees ({taxPercentage}%)</span>
                      <span className="font-medium text-gray-900">USD {taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t mt-2">
                    <span className="font-semibold text-gray-900">Total Price</span>
                    <span className="font-bold text-lg text-gray-900">USD {totalWithTax.toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Contact Information */}
          {(fullReservation.contact_email || fullReservation.contact_phone) && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Contact Information</h2>
              <div className="space-y-2">
                {fullReservation.contact_email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{fullReservation.contact_email}</span>
                  </div>
                )}
                {fullReservation.contact_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-900">{fullReservation.contact_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-green-700 font-semibold">
              ✓ Reservation {fullReservation.status === 'confirmed' ? 'Confirmed' : 
                fullReservation.status === 'checked-in' ? 'Checked-In' :
                fullReservation.status === 'checked-out' ? 'Checked-Out' :
                fullReservation.status === 'completed' ? 'Completed' : fullReservation.status}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-gray-400 text-xs">
            <p>Thank you for choosing SuiteSpot</p>
            <p className="mt-1">Generated on {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

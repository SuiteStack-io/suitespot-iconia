import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Plus, X } from "lucide-react";
import { format, differenceInDays, isBefore, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
}

const COMMISSION_RATE = 10.00; // 10% commission across all sources

export function CreateReservationDialog() {
  const { userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [checkInDate, setCheckInDate] = useState<Date>();
  const [checkOutDate, setCheckOutDate] = useState<Date>();
  const [unitId, setUnitId] = useState("");
  const [numberOfGuests, setNumberOfGuests] = useState<number>(1);
  const [guestNames, setGuestNames] = useState<string[]>([""]);
  const [nationality, setNationality] = useState("");
  const [source, setSource] = useState("");
  const [pricePerNight, setPricePerNight] = useState<number | "">("");
  
  // Units data
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Calculate nights
  const nights = checkInDate && checkOutDate 
    ? differenceInDays(checkOutDate, checkInDate) 
    : 0;

  // Calculate total price
  const totalPrice = pricePerNight && nights > 0 
    ? Number(pricePerNight) * nights 
    : 0;

  // Fetch all units on mount
  useEffect(() => {
    fetchUnits();
  }, []);

  // Check availability when dates change
  useEffect(() => {
    if (checkInDate && checkOutDate) {
      checkUnitAvailability();
    } else {
      setAvailableUnits(allUnits);
      setUnitId("");
    }
  }, [checkInDate, checkOutDate, allUnits]);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from("units")
      .select("id, name, unit_number")
      .order("name");

    if (error) {
      console.error("Error fetching units:", error);
      toast.error("Failed to load units");
      return;
    }

    setAllUnits(data || []);
    setAvailableUnits(data || []);
  };

  const checkUnitAvailability = async () => {
    if (!checkInDate || !checkOutDate) return;

    setCheckingAvailability(true);
    const checkIn = format(checkInDate, "yyyy-MM-dd");
    const checkOut = format(checkOutDate, "yyyy-MM-dd");

    const { data: conflictingReservations, error } = await supabase
      .from("reservations")
      .select("unit_id")
      .or(`and(check_in_date.lte.${checkOut},check_out_date.gte.${checkIn})`)
      .in("status", ["Upcoming", "In-House"]);

    if (error) {
      console.error("Error checking availability:", error);
      toast.error("Failed to check room availability");
      setCheckingAvailability(false);
      return;
    }

    const unavailableUnitIds = conflictingReservations?.map((r) => r.unit_id) || [];
    const available = allUnits.filter((unit) => !unavailableUnitIds.includes(unit.id));
    
    setAvailableUnits(available);
    
    // Reset unit selection if previously selected unit is no longer available
    if (unitId && unavailableUnitIds.includes(unitId)) {
      setUnitId("");
    }
    
    setCheckingAvailability(false);
  };

  const addGuestName = () => {
    setGuestNames([...guestNames, ""]);
  };

  const removeGuestName = (index: number) => {
    if (guestNames.length > 1) {
      const newGuestNames = guestNames.filter((_, i) => i !== index);
      setGuestNames(newGuestNames);
    }
  };

  const updateGuestName = (index: number, value: string) => {
    const newGuestNames = [...guestNames];
    newGuestNames[index] = value;
    setGuestNames(newGuestNames);
  };

  const validateForm = () => {
    if (!checkInDate) {
      toast.error("Please select a check-in date");
      return false;
    }
    if (!checkOutDate) {
      toast.error("Please select a check-out date");
      return false;
    }
    if (isBefore(startOfDay(checkInDate), startOfDay(new Date()))) {
      toast.error("Check-in date cannot be in the past");
      return false;
    }
    if (!isAfter(checkOutDate, checkInDate)) {
      toast.error("Check-out date must be after check-in date");
      return false;
    }
    if (!unitId) {
      toast.error("Please select a room");
      return false;
    }
    if (numberOfGuests < 1) {
      toast.error("Number of guests must be at least 1");
      return false;
    }
    if (!guestNames[0]?.trim()) {
      toast.error("Please enter at least one guest name");
      return false;
    }
    if (!nationality.trim()) {
      toast.error("Please enter guest nationality");
      return false;
    }
    if (!source) {
      toast.error("Please select a source");
      return false;
    }
    if (!pricePerNight || Number(pricePerNight) <= 0) {
      toast.error("Please enter a valid price per night");
      return false;
    }
    if (!Number.isInteger(Number(pricePerNight))) {
      toast.error("Price per night must be a whole number");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    // Check permissions first
    if (!userRole || (userRole !== 'admin' && userRole !== 'manager')) {
      toast.error('You do not have permission to create reservations. Admin or Manager role required.');
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Calculate pricing and commission
      const total = Number(pricePerNight) * nights;
      const commissionAmount = (total * COMMISSION_RATE) / 100;
      const netRevenue = total - commissionAmount;

      const reservationData = {
        booking_reference: `MAN-${Date.now()}`,
        check_in_date: format(checkInDate!, "yyyy-MM-dd"),
        check_out_date: format(checkOutDate!, "yyyy-MM-dd"),
        nights,
        unit_id: unitId,
        number_of_guests: numberOfGuests,
        guest_names: guestNames.filter(name => name.trim() !== ""),
        guest_nationality: nationality,
        source,
        status: "Upcoming",
        channel: "Manual",
        price_per_night: Number(pricePerNight),
        total_price: total,
        commission_rate: COMMISSION_RATE,
        commission_amount: commissionAmount,
        net_revenue: netRevenue,
        currency: "USD",
        contact_email: null,
        contact_phone: null,
        notes: null,
        guest_ages: [],
      };

      const { error } = await supabase
        .from("reservations")
        .insert([reservationData]);

      if (error) throw error;

      toast.success("Reservation created successfully!");
      
      // Reset form
      setCheckInDate(undefined);
      setCheckOutDate(undefined);
      setUnitId("");
      setNumberOfGuests(1);
      setGuestNames([""]);
      setNationality("");
      setSource("");
      setPricePerNight("");
      setOpen(false);
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      
      // Provide specific error messages
      if (error.code === '42501') {
        // Permission denied error
        toast.error('You do not have permission to create reservations. Please contact an administrator.');
      } else if (error.code === '23505') {
        // Unique constraint violation
        toast.error('A reservation with this booking reference already exists.');
      } else if (error.message?.includes('violates row-level security')) {
        toast.error('Permission denied. Your account may not have the required role to create reservations.');
      } else if (error.message?.includes('not found')) {
        toast.error('The selected unit was not found. Please refresh and try again.');
      } else if (error.details) {
        // Show specific error details from Supabase
        toast.error(`Error: ${error.message}. ${error.details}`);
      } else {
        // Generic error
        toast.error(`Failed to create reservation: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = 
    checkInDate &&
    checkOutDate &&
    unitId &&
    numberOfGuests > 0 &&
    guestNames[0]?.trim() !== "" &&
    nationality.trim() !== "" &&
    source &&
    pricePerNight &&
    Number(pricePerNight) > 0 &&
    Number.isInteger(Number(pricePerNight));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Reservation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Reservation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Check-in and Check-out Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkIn">
                Check-in Date <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !checkInDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkInDate ? format(checkInDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkInDate}
                    onSelect={setCheckInDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOut">
                Check-out Date <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !checkOutDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {checkOutDate ? format(checkOutDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={checkOutDate}
                    onSelect={setCheckOutDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {nights > 0 && (
            <p className="text-sm text-muted-foreground">
              Total nights: <span className="font-semibold">{nights}</span>
            </p>
          )}

          {/* Room ID */}
          <div className="space-y-2">
            <Label htmlFor="unitId">
              Room ID <span className="text-destructive">*</span>
            </Label>
            <Select value={unitId} onValueChange={setUnitId} disabled={checkingAvailability}>
              <SelectTrigger>
                <SelectValue placeholder={
                  checkingAvailability 
                    ? "Checking availability..." 
                    : !checkInDate || !checkOutDate
                    ? "Select dates first"
                    : availableUnits.length === 0
                    ? "No units available for selected dates"
                    : "Select a room"
                } />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {checkInDate && checkOutDate && availableUnits.length === 0 && (
              <p className="text-xs text-destructive">
                All rooms are booked for these dates
              </p>
            )}
          </div>

          {/* Number of Guests */}
          <div className="space-y-2">
            <Label htmlFor="numberOfGuests">
              Number of Guests <span className="text-destructive">*</span>
            </Label>
            <Input
              id="numberOfGuests"
              type="number"
              min="1"
              value={numberOfGuests}
              onChange={(e) => setNumberOfGuests(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* Guest Names */}
          <div className="space-y-2">
            <Label>
              Guest Names <span className="text-destructive">*</span>
            </Label>
            {guestNames.map((name, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Guest ${index + 1} name`}
                  value={name}
                  onChange={(e) => updateGuestName(index, e.target.value)}
                />
                {index > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeGuestName(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGuestName}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Guest
            </Button>
          </div>

          {/* Nationality */}
          <div className="space-y-2">
            <Label htmlFor="nationality">
              Nationality <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nationality"
              placeholder="e.g., American, British, etc."
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
            />
          </div>

          {/* Price Per Night */}
          <div className="space-y-2">
            <Label htmlFor="pricePerNight">
              Price Per Night <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="pricePerNight"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={pricePerNight}
                onChange={(e) => setPricePerNight(e.target.value ? parseInt(e.target.value) : "")}
                className="pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter whole number only (e.g., 100 for $100)
            </p>
            {pricePerNight && nights > 0 && (
              <div className="text-sm space-y-1 pt-2 border-t">
                <p className="font-medium text-primary">
                  Total Price: ${totalPrice.toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Commission (10%): ${((totalPrice * COMMISSION_RATE) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Net Revenue: ${(totalPrice - (totalPrice * COMMISSION_RATE) / 100).toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">
              Source <span className="text-destructive">*</span>
            </Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select a source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Emad">Emad</SelectItem>
                <SelectItem value="Nicola">Nicola</SelectItem>
                <SelectItem value="Youssef">Youssef</SelectItem>
                <SelectItem value="KSS">KSS</SelectItem>
                <SelectItem value="booking.com">booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid || loading}>
            {loading ? "Creating..." : "Save Reservation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

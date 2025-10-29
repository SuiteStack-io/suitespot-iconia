import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import logo from "@/assets/suitespot-logo.png";

interface Unit {
  id: string;
  name: string;
  unit_type: string | null;
  unit_number: string | null;
  status: string;
}

const BookingFlow = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  
  // Booking data
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [guestNames, setGuestNames] = useState<string[]>([""]);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [notes, setNotes] = useState("");

  // Initialize from URL parameters
  useEffect(() => {
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    const guestsParam = searchParams.get("guests");

    if (checkIn && checkOut) {
      setDateRange({
        from: parseISO(checkIn),
        to: parseISO(checkOut),
      });
    }

    if (guestsParam) {
      const numGuests = parseInt(guestsParam);
      setAdults(numGuests);
    }
  }, [searchParams]);

  // Fetch available units based on selected dates
  useEffect(() => {
    const fetchAvailableUnits = async () => {
      setIsLoadingUnits(true);
      try {
        // First get all units
        const { data: allUnits, error: unitsError } = await supabase
          .from("units")
          .select("id, name, unit_type, unit_number, status")
          .eq("status", "available")
          .order("name");

        if (unitsError) throw unitsError;

        // If dates are selected, filter by availability
        if (dateRange?.from && dateRange?.to) {
          const { data: reservations, error: reservationsError } = await supabase
            .from("reservations")
            .select("unit_id, check_in_date, check_out_date")
            .gte("check_out_date", format(dateRange.from, "yyyy-MM-dd"))
            .lte("check_in_date", format(dateRange.to, "yyyy-MM-dd"))
            .neq("status", "cancelled");

          if (reservationsError) throw reservationsError;

          // Filter out units that have conflicting reservations
          const bookedUnitIds = new Set(reservations?.map(r => r.unit_id) || []);
          const availableUnits = allUnits?.filter(unit => !bookedUnitIds.has(unit.id)) || [];
          setUnits(availableUnits);
        } else {
          setUnits(allUnits || []);
        }
      } catch (error: any) {
        toast({
          title: "Error loading suites",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsLoadingUnits(false);
      }
    };

    fetchAvailableUnits();
  }, [toast, dateRange]);

  // Fetch booked dates for calendar display
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const { data: reservations, error } = await supabase
          .from("reservations")
          .select("check_in_date, check_out_date, unit_id")
          .neq("status", "cancelled");

        if (error) throw error;

        // Get all dates that are fully booked (all units booked)
        const { data: allUnits } = await supabase
          .from("units")
          .select("id")
          .eq("status", "available");

        const totalUnits = allUnits?.length || 0;
        if (totalUnits === 0) return;

        // Group reservations by date
        const dateBookings = new Map<string, Set<string>>();
        
        reservations?.forEach(res => {
          const start = parseISO(res.check_in_date);
          const end = parseISO(res.check_out_date);
          
          for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            if (!dateBookings.has(dateStr)) {
              dateBookings.set(dateStr, new Set());
            }
            dateBookings.get(dateStr)?.add(res.unit_id);
          }
        });

        // Find dates where all units are booked
        const fullyBookedDates: Date[] = [];
        dateBookings.forEach((unitIds, dateStr) => {
          if (unitIds.size >= totalUnits) {
            fullyBookedDates.push(parseISO(dateStr));
          }
        });

        setBookedDates(fullyBookedDates);
      } catch (error: any) {
        console.error("Error fetching booked dates:", error);
      }
    };

    fetchBookedDates();
  }, []);

  const addGuest = () => {
    setGuestNames([...guestNames, ""]);
  };

  const updateGuestName = (index: number, value: string) => {
    const updated = [...guestNames];
    updated[index] = value;
    setGuestNames(updated);
  };

  const removeGuest = (index: number) => {
    if (guestNames.length > 1) {
      const updated = guestNames.filter((_, i) => i !== index);
      setGuestNames(updated);
    }
  };

  const calculateNights = () => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    const diff = dateRange.to.getTime() - dateRange.from.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleSubmit = async () => {
    if (!dateRange?.from || !dateRange?.to || !selectedUnit || guestNames.filter(n => n.trim()).length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const nights = calculateNights();
      const validGuestNames = guestNames.filter(n => n.trim());

      const { error } = await supabase.from("reservations").insert({
        unit_id: selectedUnit,
        check_in_date: format(dateRange.from, "yyyy-MM-dd"),
        check_out_date: format(dateRange.to, "yyyy-MM-dd"),
        nights,
        guest_names: validGuestNames,
        adults,
        children,
        number_of_guests: adults + children,
        contact_email: email,
        contact_phone: phone,
        guest_nationality: nationality,
        notes,
        status: "confirmed",
        source: "Direct Website",
        booking_reference: `WEB-${Date.now()}`,
        channel: "Website",
      });

      if (error) throw error;

      toast({
        title: "Booking Confirmed!",
        description: "We've received your reservation. Check your email for confirmation.",
      });

      // Reset form or redirect
      navigate("/booking-confirmation");
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SuiteSpot logo" className="h-8 w-8" />
            <span className="text-2xl font-serif font-bold text-foreground">SuiteSpot</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="container mx-auto px-6 py-12 pt-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-2">Book Your Stay</h1>
          <p className="text-muted-foreground mb-8">Complete the form below to reserve your suite</p>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? "text-foreground" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-accent text-white" : "bg-muted"}`}>
                  1
                </div>
                <span className="text-sm font-medium">Dates & Suite</span>
              </div>
              <div className="w-12 h-px bg-border" />
              <div className={`flex items-center gap-2 ${step >= 2 ? "text-foreground" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-accent text-white" : "bg-muted"}`}>
                  2
                </div>
                <span className="text-sm font-medium">Guest Details</span>
              </div>
              <div className="w-12 h-px bg-border" />
              <div className={`flex items-center gap-2 ${step >= 3 ? "text-foreground" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-accent text-white" : "bg-muted"}`}>
                  3
                </div>
                <span className="text-sm font-medium">Review</span>
              </div>
            </div>
          </div>

          <Card className="p-8">
            {/* Step 1: Dates & Suite Selection */}
            {step === 1 && (
              <div className="space-y-6">
                {dateRange?.from && dateRange?.to ? (
                  // Show selected dates and nights
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <Label className="text-lg font-semibold block mb-2">Selected Dates</Label>
                    <p className="text-foreground">
                      {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {calculateNights()} night{calculateNights() !== 1 ? "s" : ""}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDateRange(undefined)}
                      className="mt-3"
                    >
                      Change Dates
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Label className="text-lg font-semibold mb-4 block">Select Your Dates</Label>
                    <div className="flex justify-center">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        disabled={(date) => {
                          const isPast = date < new Date();
                          const isFullyBooked = bookedDates.some(
                            bookedDate => format(bookedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
                          );
                          return isPast || isFullyBooked;
                        }}
                        numberOfMonths={1}
                        className="rounded-md border pointer-events-auto"
                        modifiers={{
                          booked: bookedDates
                        }}
                        modifiersStyles={{
                          booked: {
                            textDecoration: 'line-through',
                            opacity: 0.5
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="unit">Select Suite Type</Label>
                  {dateRange?.from && dateRange?.to ? (
                    <Select value={selectedUnit} onValueChange={setSelectedUnit} disabled={isLoadingUnits}>
                      <SelectTrigger id="unit">
                        <SelectValue placeholder={isLoadingUnits ? "Loading available suites..." : units.length === 0 ? "No suites available for these dates" : "Choose a suite"} />
                      </SelectTrigger>
                      <SelectContent>
                        {units.length === 0 && !isLoadingUnits ? (
                          <div className="p-2 text-sm text-muted-foreground">No suites available for selected dates</div>
                        ) : (
                          units.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                              {unit.unit_number && ` - Unit ${unit.unit_number}`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3 border border-dashed rounded-md text-sm text-muted-foreground text-center">
                      Please select dates first to see available suites
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adults">Adults</Label>
                    <Input
                      id="adults"
                      type="number"
                      min="1"
                      value={adults}
                      onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="children">Children</Label>
                    <Input
                      id="children"
                      type="number"
                      min="0"
                      value={children}
                      onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => setStep(2)}
                  disabled={!dateRange?.from || !dateRange?.to || !selectedUnit}
                  className="w-full bg-accent hover:bg-accent/90"
                >
                  Continue to Guest Details
                </Button>
              </div>
            )}

            {/* Step 2: Guest Details */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-semibold mb-4 block">Guest Information</Label>
                  
                  {guestNames.map((name, index) => (
                    <div key={index} className="flex gap-2 mb-3">
                      <Input
                        placeholder={`Guest ${index + 1} Full Name`}
                        value={name}
                        onChange={(e) => updateGuestName(index, e.target.value)}
                      />
                      {guestNames.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => removeGuest(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addGuest}
                    className="w-full mt-2"
                  >
                    + Add Another Guest
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="nationality">Nationality</Label>
                  <Input
                    id="nationality"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Special Requests (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requests or requirements?"
                    rows={4}
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!email || guestNames.filter(n => n.trim()).length === 0}
                    className="flex-1 bg-accent hover:bg-accent/90"
                  >
                    Review Booking
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Review Your Booking</h3>
                
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Dates</p>
                    <p className="font-medium">
                      {dateRange?.from && format(dateRange.from, "MMM dd, yyyy")} - {dateRange?.to && format(dateRange.to, "MMM dd, yyyy")}
                      <span className="text-muted-foreground ml-2">({calculateNights()} nights)</span>
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Suite Type</p>
                    <p className="font-medium">{units.find(u => u.id === selectedUnit)?.name || selectedUnit}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-medium">{adults} Adult{adults > 1 ? "s" : ""}, {children} Child{children !== 1 ? "ren" : ""}</p>
                    <p className="text-sm mt-1">{guestNames.filter(n => n.trim()).join(", ")}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="font-medium">{email}</p>
                    {phone && <p className="text-sm">{phone}</p>}
                  </div>

                  {nationality && (
                    <div>
                      <p className="text-sm text-muted-foreground">Nationality</p>
                      <p className="font-medium">{nationality}</p>
                    </div>
                  )}

                  {notes && (
                    <div>
                      <p className="text-sm text-muted-foreground">Special Requests</p>
                      <p className="text-sm">{notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 bg-accent hover:bg-accent/90"
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Booking
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BookingFlow;

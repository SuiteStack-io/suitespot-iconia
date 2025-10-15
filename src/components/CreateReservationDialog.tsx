import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CalendarIcon, Plus, X, Check, ChevronsUpDown } from "lucide-react";
import { format, differenceInDays, isBefore, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { DateRange } from "react-day-picker";

const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Antiguans", "Argentinean", "Armenian", "Australian",
  "Austrian", "Azerbaijani", "Bahamian", "Bahraini", "Bangladeshi", "Barbadian", "Barbudans", "Batswana", "Belarusian", "Belgian",
  "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian", "Brazilian", "British", "Bruneian", "Bulgarian", "Burkinabe",
  "Burmese", "Burundian", "Cambodian", "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian", "Chilean", "Chinese",
  "Colombian", "Comoran", "Congolese", "Costa Rican", "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djibouti",
  "Dominican", "Dutch", "East Timorese", "Ecuadorean", "Egyptian", "Emirian", "Equatorial Guinean", "Eritrean", "Estonian", "Ethiopian",
  "Fijian", "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek",
  "Grenadian", "Guatemalan", "Guinea-Bissauan", "Guinean", "Guyanese", "Haitian", "Herzegovinian", "Honduran", "Hungarian", "I-Kiribati",
  "Icelander", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli", "Italian", "Ivorian", "Jamaican",
  "Japanese", "Jordanian", "Kazakhstani", "Kenyan", "Kittian and Nevisian", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese",
  "Liberian", "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourger", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivan",
  "Malian", "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian", "Moldovan", "Monacan", "Mongolian",
  "Moroccan", "Mosotho", "Motswana", "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan", "Nigerian",
  "Nigerien", "North Korean", "Northern Irish", "Norwegian", "Omani", "Pakistani", "Palauan", "Panamanian", "Papua New Guinean", "Paraguayan",
  "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan", "Saint Lucian", "Salvadoran", "Samoan",
  "San Marinese", "Sao Tomean", "Saudi", "Scottish", "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean", "Slovakian",
  "Slovenian", "Solomon Islander", "Somali", "South African", "South Korean", "Spanish", "Sri Lankan", "Sudanese", "Surinamer", "Swazi",
  "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian or Tobagonian",
  "Tunisian", "Turkish", "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbekistani", "Venezuelan", "Vietnamese", "Welsh",
  "Yemenite", "Zambian", "Zimbabwean"
];

const COUNTRY_CODES = [
  { code: "+1", country: "US", flag: "🇺🇸", name: "United States" },
  { code: "+1", country: "CA", flag: "🇨🇦", name: "Canada" },
  { code: "+20", country: "EG", flag: "🇪🇬", name: "Egypt" },
  { code: "+27", country: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "+30", country: "GR", flag: "🇬🇷", name: "Greece" },
  { code: "+31", country: "NL", flag: "🇳🇱", name: "Netherlands" },
  { code: "+32", country: "BE", flag: "🇧🇪", name: "Belgium" },
  { code: "+33", country: "FR", flag: "🇫🇷", name: "France" },
  { code: "+34", country: "ES", flag: "🇪🇸", name: "Spain" },
  { code: "+39", country: "IT", flag: "🇮🇹", name: "Italy" },
  { code: "+40", country: "RO", flag: "🇷🇴", name: "Romania" },
  { code: "+41", country: "CH", flag: "🇨🇭", name: "Switzerland" },
  { code: "+43", country: "AT", flag: "🇦🇹", name: "Austria" },
  { code: "+44", country: "GB", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+45", country: "DK", flag: "🇩🇰", name: "Denmark" },
  { code: "+46", country: "SE", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", country: "NO", flag: "🇳🇴", name: "Norway" },
  { code: "+48", country: "PL", flag: "🇵🇱", name: "Poland" },
  { code: "+49", country: "DE", flag: "🇩🇪", name: "Germany" },
  { code: "+51", country: "PE", flag: "🇵🇪", name: "Peru" },
  { code: "+52", country: "MX", flag: "🇲🇽", name: "Mexico" },
  { code: "+53", country: "CU", flag: "🇨🇺", name: "Cuba" },
  { code: "+54", country: "AR", flag: "🇦🇷", name: "Argentina" },
  { code: "+55", country: "BR", flag: "🇧🇷", name: "Brazil" },
  { code: "+56", country: "CL", flag: "🇨🇱", name: "Chile" },
  { code: "+57", country: "CO", flag: "🇨🇴", name: "Colombia" },
  { code: "+58", country: "VE", flag: "🇻🇪", name: "Venezuela" },
  { code: "+60", country: "MY", flag: "🇲🇾", name: "Malaysia" },
  { code: "+61", country: "AU", flag: "🇦🇺", name: "Australia" },
  { code: "+62", country: "ID", flag: "🇮🇩", name: "Indonesia" },
  { code: "+63", country: "PH", flag: "🇵🇭", name: "Philippines" },
  { code: "+64", country: "NZ", flag: "🇳🇿", name: "New Zealand" },
  { code: "+65", country: "SG", flag: "🇸🇬", name: "Singapore" },
  { code: "+66", country: "TH", flag: "🇹🇭", name: "Thailand" },
  { code: "+81", country: "JP", flag: "🇯🇵", name: "Japan" },
  { code: "+82", country: "KR", flag: "🇰🇷", name: "South Korea" },
  { code: "+84", country: "VN", flag: "🇻🇳", name: "Vietnam" },
  { code: "+86", country: "CN", flag: "🇨🇳", name: "China" },
  { code: "+90", country: "TR", flag: "🇹🇷", name: "Turkey" },
  { code: "+91", country: "IN", flag: "🇮🇳", name: "India" },
  { code: "+92", country: "PK", flag: "🇵🇰", name: "Pakistan" },
  { code: "+93", country: "AF", flag: "🇦🇫", name: "Afghanistan" },
  { code: "+94", country: "LK", flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+95", country: "MM", flag: "🇲🇲", name: "Myanmar" },
  { code: "+98", country: "IR", flag: "🇮🇷", name: "Iran" },
  { code: "+212", country: "MA", flag: "🇲🇦", name: "Morocco" },
  { code: "+213", country: "DZ", flag: "🇩🇿", name: "Algeria" },
  { code: "+216", country: "TN", flag: "🇹🇳", name: "Tunisia" },
  { code: "+218", country: "LY", flag: "🇱🇾", name: "Libya" },
  { code: "+220", country: "GM", flag: "🇬🇲", name: "Gambia" },
  { code: "+221", country: "SN", flag: "🇸🇳", name: "Senegal" },
  { code: "+234", country: "NG", flag: "🇳🇬", name: "Nigeria" },
  { code: "+249", country: "SD", flag: "🇸🇩", name: "Sudan" },
  { code: "+254", country: "KE", flag: "🇰🇪", name: "Kenya" },
  { code: "+255", country: "TZ", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", country: "UG", flag: "🇺🇬", name: "Uganda" },
  { code: "+351", country: "PT", flag: "🇵🇹", name: "Portugal" },
  { code: "+352", country: "LU", flag: "🇱🇺", name: "Luxembourg" },
  { code: "+353", country: "IE", flag: "🇮🇪", name: "Ireland" },
  { code: "+354", country: "IS", flag: "🇮🇸", name: "Iceland" },
  { code: "+358", country: "FI", flag: "🇫🇮", name: "Finland" },
  { code: "+370", country: "LT", flag: "🇱🇹", name: "Lithuania" },
  { code: "+371", country: "LV", flag: "🇱🇻", name: "Latvia" },
  { code: "+372", country: "EE", flag: "🇪🇪", name: "Estonia" },
  { code: "+380", country: "UA", flag: "🇺🇦", name: "Ukraine" },
  { code: "+420", country: "CZ", flag: "🇨🇿", name: "Czech Republic" },
  { code: "+421", country: "SK", flag: "🇸🇰", name: "Slovakia" },
  { code: "+852", country: "HK", flag: "🇭🇰", name: "Hong Kong" },
  { code: "+853", country: "MO", flag: "🇲🇴", name: "Macau" },
  { code: "+855", country: "KH", flag: "🇰🇭", name: "Cambodia" },
  { code: "+856", country: "LA", flag: "🇱🇦", name: "Laos" },
  { code: "+880", country: "BD", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+886", country: "TW", flag: "🇹🇼", name: "Taiwan" },
  { code: "+960", country: "MV", flag: "🇲🇻", name: "Maldives" },
  { code: "+961", country: "LB", flag: "🇱🇧", name: "Lebanon" },
  { code: "+962", country: "JO", flag: "🇯🇴", name: "Jordan" },
  { code: "+963", country: "SY", flag: "🇸🇾", name: "Syria" },
  { code: "+964", country: "IQ", flag: "🇮🇶", name: "Iraq" },
  { code: "+965", country: "KW", flag: "🇰🇼", name: "Kuwait" },
  { code: "+966", country: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+967", country: "YE", flag: "🇾🇪", name: "Yemen" },
  { code: "+968", country: "OM", flag: "🇴🇲", name: "Oman" },
  { code: "+971", country: "AE", flag: "🇦🇪", name: "UAE" },
  { code: "+972", country: "IL", flag: "🇮🇱", name: "Israel" },
  { code: "+973", country: "BH", flag: "🇧🇭", name: "Bahrain" },
  { code: "+974", country: "QA", flag: "🇶🇦", name: "Qatar" },
  { code: "+975", country: "BT", flag: "🇧🇹", name: "Bhutan" },
  { code: "+976", country: "MN", flag: "🇲🇳", name: "Mongolia" },
  { code: "+977", country: "NP", flag: "🇳🇵", name: "Nepal" },
];

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
}

export function CreateReservationDialog() {
  const { userRole } = useAuth();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  
  // Form state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [unitId, setUnitId] = useState("");
  const [numberOfGuests, setNumberOfGuests] = useState<number>(1);
  const [guestNames, setGuestNames] = useState<string[]>([""]);
  const [nationality, setNationality] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+20"); // Default to Egypt
  const [contactPhone, setContactPhone] = useState("");
  const [source, setSource] = useState("");
  const [pricePerNight, setPricePerNight] = useState<number | "">("");
  const [commissionRate, setCommissionRate] = useState<number>(10.00);
  
  // Units data
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Extract dates from range
  const checkInDate = dateRange?.from;
  const checkOutDate = dateRange?.to;

  // Calculate nights
  const nights = checkInDate && checkOutDate 
    ? differenceInDays(checkOutDate, checkInDate) 
    : 0;

  // Calculate total price
  const totalPrice = pricePerNight && nights > 0 
    ? Number(pricePerNight) * nights 
    : 0;

  // Auto-set commission rate based on source
  useEffect(() => {
    if (source.toLowerCase().includes('booking')) {
      setCommissionRate(17.4);
    } else {
      setCommissionRate(10.0);
    }
  }, [source]);

  // Auto-sync number of guests with guest names count
  useEffect(() => {
    const validGuestCount = guestNames.filter(name => name.trim() !== '').length;
    if (validGuestCount > 0) {
      setNumberOfGuests(validGuestCount);
    }
  }, [guestNames]);

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
      .eq("status", "confirmed");

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
    if (!contactEmail.trim()) {
      toast.error("Please enter contact email");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    if (!contactPhone.trim()) {
      toast.error("Please enter contact phone number");
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
      const commissionAmount = (total * commissionRate) / 100;
      const netRevenue = total - commissionAmount;

      const reservationData = {
        booking_reference: `MAN-${Date.now()}`,
        check_in_date: format(checkInDate!, "yyyy-MM-dd"),
        check_out_date: format(checkOutDate!, "yyyy-MM-dd"),
        unit_id: unitId,
        number_of_guests: numberOfGuests,
        guest_names: guestNames.filter(name => name.trim() !== ""),
        guest_nationality: nationality,
        source,
        status: "confirmed",
        channel: "Manual",
        price_per_night: Number(pricePerNight),
        total_price: total,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
        net_revenue: netRevenue,
        currency: "USD",
        contact_email: contactEmail,
        contact_phone: `${countryCode}${contactPhone}`,
        notes: null,
        guest_ages: [],
      };

      const { error } = await supabase
        .from("reservations")
        .insert([reservationData]);

      if (error) throw error;

      toast.success("Reservation created successfully!");
      
      // Reset form
      setDateRange(undefined);
      setUnitId("");
      setNumberOfGuests(1);
      setGuestNames([""]);
      setNationality("");
      setContactEmail("");
      setCountryCode("+20");
      setContactPhone("");
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
    contactEmail.trim() !== "" &&
    contactPhone.trim() !== "" &&
    source &&
    pricePerNight &&
    Number(pricePerNight) > 0 &&
    Number.isInteger(Number(pricePerNight));

  const resetForm = () => {
    setDateRange(undefined);
    setUnitId("");
    setNumberOfGuests(1);
    setGuestNames([""]);
    setNationality("");
    setContactEmail("");
    setCountryCode("+20");
    setContactPhone("");
    setSource("");
    setPricePerNight("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className={isMobile ? "mb-1" : "mr-2 h-4 w-4"} />
          {isMobile ? (
            <span className="flex flex-col items-center leading-tight">
              <span>Create</span>
              <span>Reservation</span>
            </span>
          ) : (
            "Create Reservation"
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Reservation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Check-in and Check-out Dates */}
          <div className="space-y-2">
            <Label>
              Check-in & Check-out Dates <span className="text-destructive">*</span>
            </Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "PPP")} - {format(dateRange.to, "PPP")}
                      </>
                    ) : (
                      format(dateRange.from, "PPP")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 space-y-3">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    disabled={(date) => date < startOfDay(new Date())}
                    className={cn("pointer-events-auto")}
                  />
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDateRange(undefined);
                        setDatePickerOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setDatePickerOpen(false)}
                      disabled={!dateRange?.from || !dateRange?.to}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
            <Label>
              Nationality <span className="text-destructive">*</span>
            </Label>
            <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={nationalityOpen}
                  className="w-full justify-between"
                >
                  {nationality || "Select nationality..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search nationality..." />
                  <CommandList>
                    <CommandEmpty>No nationality found.</CommandEmpty>
                    <CommandGroup>
                      {NATIONALITIES.map((nat) => (
                        <CommandItem
                          key={nat}
                          value={nat}
                          onSelect={(currentValue) => {
                            setNationality(currentValue === nationality ? "" : currentValue);
                            setNationalityOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              nationality === nat ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {nat}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">
              Contact Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="guest@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          {/* Contact Phone */}
          <div className="space-y-2">
            <Label>
              Contact Phone <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Popover open={countryCodeOpen} onOpenChange={setCountryCodeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryCodeOpen}
                    className="w-[140px] justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {COUNTRY_CODES.find((c) => c.code === countryCode)?.flag || "🏳️"}
                      {countryCode}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search country..." />
                    <CommandList>
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {COUNTRY_CODES.map((country) => (
                          <CommandItem
                            key={`${country.code}-${country.country}`}
                            value={`${country.name} ${country.code}`}
                            onSelect={() => {
                              setCountryCode(country.code);
                              setCountryCodeOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                countryCode === country.code ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="flex items-center gap-2">
                              <span className="text-lg">{country.flag}</span>
                              <span>{country.name}</span>
                              <span className="text-muted-foreground">{country.code}</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="1234567890"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1"
              />
            </div>
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
                  Commission ({commissionRate}%): ${((totalPrice * commissionRate) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Net Revenue: ${(totalPrice - (totalPrice * commissionRate) / 100).toFixed(2)}
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
          <Button 
            variant="outline" 
            onClick={() => {
              resetForm();
              setOpen(false);
            }} 
            disabled={loading}
          >
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

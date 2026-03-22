import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Progress } from "@/components/ui/progress";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { usePropertySafe } from "@/lib/propertyContext";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, subDays } from "date-fns";
import { Dialog, DialogContent, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Bed, Bath, Users, Maximize2, Sofa, X, ChevronLeft, ChevronRight, Upload, Check, ChevronsUpDown, MapPin, Lock, CreditCard } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import visaLogo from "@/assets/visa-logo.png";
import mastercardLogo from "@/assets/mastercard-logo.jpg";
import type { DateRange } from "react-day-picker";
import { PublicNav } from "@/components/PublicNav";
import { getActiveRate } from "@/lib/rateResolver";

const NATIONALITIES = [
  "Afghanistan", "Albania", "Algeria", "United States", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Brazil", "United Kingdom", "Brunei", "Bulgaria", "Burkina Faso",
  "Myanmar", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China",
  "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti",
  "Dominican Republic", "Netherlands", "East Timor", "Ecuador", "Egypt", "United Arab Emirates", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia",
  "Fiji", "Philippines", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
  "Grenada", "Guatemala", "Guinea-Bissau", "Guinea", "Guyana", "Haiti", "Honduras", "Hungary", "Kiribati",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Saint Kitts and Nevis", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "North Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives",
  "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Morocco", "Lesotho", "Mozambique", "Namibia", "Nauru", "Nepal", "New Zealand", "Nicaragua", "Nigeria",
  "Niger", "North Korea", "Northern Ireland", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Lucia", "El Salvador", "Samoa",
  "San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Scotland", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan", "Suriname", "Eswatini",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Tuvalu", "Uganda", "Ukraine", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Wales",
  "Yemen", "Zambia", "Zimbabwe"
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
  { code: "+966", country: "SA", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+971", country: "AE", flag: "🇦🇪", name: "UAE" },
];

const ARAB_NATIONALITIES = [
  "Egypt", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar", "Bahrain", "Oman", 
  "Yemen", "Jordan", "Lebanon", "Syria", "Iraq", "Palestine", 
  "Libya", "Tunisia", "Algeria", "Morocco", "Sudan", "Somalia", 
  "Djibouti", "Mauritania", "Comoros"
];

interface Unit {
  id: string;
  name: string;
  booking_com_name: string | null;
  unit_type: string | null;
  unit_number: string | null;
  status: string;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  unit_size: string | null;
  sofa_bed: boolean | null;
  tax_percentage: number | null;
  photos: string[] | null;
}

interface RatePlanRateState {
  weekdayRate: number;
  weekendRate: number;
  minStay: number;
  ratePlanName: string;
  ratePlanId: string;
  extraAdultRate: number;
}

interface GroupedUnitType {
  unit_type: string;
  name: string;
  available_count: number;
  available_unit_ids: string[];
  sample_unit: Unit;
}

const BookingFlow = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groupedUnitTypes, setGroupedUnitTypes] = useState<GroupedUnitType[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  const [preSelectedUnitId, setPreSelectedUnitId] = useState<string | null>(null);
  const [preSelectedUnitType, setPreSelectedUnitType] = useState<string | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string>("");
  const [ratePlanRate, setRatePlanRate] = useState<RatePlanRateState | null>(null);
  
  // Booking data
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [guestFirstNames, setGuestFirstNames] = useState<string[]>([""]);
  const [guestLastNames, setGuestLastNames] = useState<string[]>([""]);
  const [guestTypes, setGuestTypes] = useState<('adult' | 'child')[]>(["adult"]);
  const [guestGenders, setGuestGenders] = useState<string[]>([""]);
  const [adults, setAdults] = useState(0);
  const [children, setChildren] = useState(0);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+20");
  const [nationality, setNationality] = useState("");
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  // Payment card form state
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [storeCard, setStoreCard] = useState(false);
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const [cardNumberError, setCardNumberError] = useState("");
  const [expiryError, setExpiryError] = useState("");
  const paymentSectionRef = useRef<HTMLDivElement>(null);

  // Card number formatting (spaces every 4 digits)
  const formatCardNumber = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const limited = digitsOnly.slice(0, 16);
    return limited.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  // Luhn algorithm for card number validation
  const isValidLuhn = (cardNum: string) => {
    const digits = cardNum.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  };

  // Check if card is expired
  const isCardExpired = (month: string, year: string) => {
    if (!month || !year || month.length < 2 || year.length < 2) return false;
    
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const expMonth = parseInt(month, 10);
    const expYear = parseInt(`20${year}`, 10);
    
    if (expYear < currentYear) return true;
    if (expYear === currentYear && expMonth < currentMonth) return true;
    
    return false;
  };

  // Initialize from URL parameters
  useEffect(() => {
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");
    const guestsParam = searchParams.get("guests");
    const unitId = searchParams.get("unitId");
    const unitType = searchParams.get("unitType");

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

    if (unitId) {
      setPreSelectedUnitId(unitId);
      setSelectedUnit(unitId);
    }

    if (unitType) {
      setPreSelectedUnitType(unitType);
    }
  }, [searchParams]);

  // Fetch available units based on selected dates
  useEffect(() => {
    const fetchAvailableUnits = async () => {
      setIsLoadingUnits(true);
      try {
        // If a specific unit is pre-selected, fetch only that unit
        if (preSelectedUnitId) {
          const { data: unit, error: unitError } = await supabase
            .from("units")
            .select("id, name, booking_com_name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, tax_percentage, photos")
            .eq("id", preSelectedUnitId)
            .eq("is_private", false)
            .eq("property_id", defaultPropertyId)
            .single();

          if (unitError) throw unitError;
          setUnits(unit ? [unit] : []);
        } else if (preSelectedUnitType) {
          // If a unit type is pre-selected, fetch all units of that type
          let query = supabase
            .from("units")
            .select("id, name, booking_com_name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, tax_percentage, photos")
            .eq("status", "available")
            .eq("unit_type", preSelectedUnitType)
            .eq("is_private", false)
            .eq("property_id", defaultPropertyId)
            .order("unit_number");

          const { data: typeUnits, error: unitsError } = await query;
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

            const { data: blockedDatesData, error: blocksError } = await supabase
              .from("blocked_dates")
              .select("blocked_date, unit_id")
              .gte("blocked_date", format(dateRange.from, "yyyy-MM-dd"))
              .lt("blocked_date", format(dateRange.to, "yyyy-MM-dd"));

            if (blocksError) throw blocksError;

            const requestedCheckIn = format(dateRange.from, "yyyy-MM-dd");
            const requestedCheckOut = format(dateRange.to, "yyyy-MM-dd");
            
            const bookedUnitIds = new Set(
              reservations
                ?.filter(r => {
                  return r.check_in_date < requestedCheckOut && r.check_out_date > requestedCheckIn;
                })
                .map(r => r.unit_id) || []
            );

            blockedDatesData?.forEach(block => {
              if (block.unit_id === null) {
                typeUnits?.forEach(unit => bookedUnitIds.add(unit.id));
              } else {
                bookedUnitIds.add(block.unit_id);
              }
            });
            
            const availableUnits = typeUnits?.filter(unit => !bookedUnitIds.has(unit.id)) || [];
            setUnits(availableUnits);
            
            // Auto-select first available unit of this type
            if (availableUnits.length > 0) {
              setSelectedUnit(availableUnits[0].id);
            }
          } else {
            setUnits(typeUnits || []);
            // Auto-select first unit of this type
            if (typeUnits && typeUnits.length > 0) {
              setSelectedUnit(typeUnits[0].id);
            }
          }
        } else {
          // Get all units if no pre-selection
          const { data: allUnits, error: unitsError } = await supabase
            .from("units")
            .select("id, name, booking_com_name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, tax_percentage, photos")
            .eq("status", "available")
            .eq("is_private", false)
            .eq("property_id", defaultPropertyId)
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

            // Also fetch blocked dates that overlap with the requested range
            const { data: blockedDatesData, error: blocksError } = await supabase
              .from("blocked_dates")
              .select("blocked_date, unit_id")
              .gte("blocked_date", format(dateRange.from, "yyyy-MM-dd"))
              .lt("blocked_date", format(dateRange.to, "yyyy-MM-dd"));

            if (blocksError) throw blocksError;

            // Filter out units that have conflicting reservations
            const requestedCheckIn = format(dateRange.from, "yyyy-MM-dd");
            const requestedCheckOut = format(dateRange.to, "yyyy-MM-dd");
            
            const bookedUnitIds = new Set(
              reservations
                ?.filter(r => {
                  // A reservation conflicts if:
                  // - Its check-in is before our check-out AND
                  // - Its check-out is after our check-in (same-day checkout/checkin is allowed)
                  return r.check_in_date < requestedCheckOut && r.check_out_date > requestedCheckIn;
                })
                .map(r => r.unit_id) || []
            );

            // Add units that are manually blocked during the requested dates
            blockedDatesData?.forEach(block => {
              // If unit_id is null, block all units
              if (block.unit_id === null) {
                allUnits?.forEach(unit => bookedUnitIds.add(unit.id));
              } else {
                bookedUnitIds.add(block.unit_id);
              }
            });
            
            const availableUnits = allUnits?.filter(unit => !bookedUnitIds.has(unit.id)) || [];
            setUnits(availableUnits);
            
            // Group units by type for the dropdown
            const grouped = groupUnitsByType(availableUnits);
            setGroupedUnitTypes(grouped);
          } else {
            setUnits(allUnits || []);
            
            // Group units by type for the dropdown
            const grouped = groupUnitsByType(allUnits || []);
            setGroupedUnitTypes(grouped);
          }
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
  }, [toast, dateRange, preSelectedUnitId, preSelectedUnitType]);
  
  // Helper function to group units by type
  const groupUnitsByType = (unitsList: Unit[]): GroupedUnitType[] => {
    const groupMap = new Map<string, GroupedUnitType>();
    
    unitsList.forEach(unit => {
      if (!unit.unit_type) return;
      
      if (!groupMap.has(unit.unit_type)) {
        groupMap.set(unit.unit_type, {
          unit_type: unit.unit_type,
          name: unit.booking_com_name || unit.name,
          available_count: 1,
          available_unit_ids: [unit.id],
          sample_unit: unit,
        });
      } else {
        const existing = groupMap.get(unit.unit_type)!;
        existing.available_count++;
        existing.available_unit_ids.push(unit.id);
      }
    });
    
    return Array.from(groupMap.values());
  };

  // Fetch booked dates for calendar display
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        // If we have a pre-selected unit, only show blocked dates for that unit
        if (preSelectedUnitId) {
          const { data: reservations, error } = await supabase
            .from("reservations")
            .select("check_in_date, check_out_date")
            .eq("unit_id", preSelectedUnitId)
            .neq("status", "cancelled");

          if (error) throw error;

          // Also fetch manually blocked dates for this unit
          const { data: manualBlocks, error: blocksError } = await supabase
            .from("blocked_dates")
            .select("blocked_date")
            .eq("unit_id", preSelectedUnitId);

          if (blocksError) throw blocksError;

          // Get all dates that are booked for this specific unit
          const blockedDates: Date[] = [];
          
          reservations?.forEach(res => {
            const start = new Date(res.check_in_date + 'T00:00:00');
            const end = new Date(res.check_out_date + 'T00:00:00');
            
            // Block all dates from check-in through the day before checkout
            // Checkout day is available for new check-ins
            const current = new Date(start);
            while (current < end) {
              blockedDates.push(new Date(current));
              current.setDate(current.getDate() + 1);
            }
          });

          // Add manually blocked dates
          manualBlocks?.forEach(block => {
            blockedDates.push(new Date(block.blocked_date + 'T00:00:00'));
          });

          setBookedDates(blockedDates);
        } else {
          // Get all dates that are fully booked (all units booked)
          const { data: reservations, error } = await supabase
            .from("reservations")
            .select("check_in_date, check_out_date, unit_id")
            .neq("status", "cancelled");

          if (error) throw error;

          // Fetch manually blocked dates
          const { data: blockedDatesData, error: blocksError } = await supabase
            .from("blocked_dates")
            .select("blocked_date, unit_id");

          if (blocksError) throw blocksError;

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

          // Add manually blocked dates
          blockedDatesData?.forEach(block => {
            const dateStr = block.blocked_date;
            if (!dateBookings.has(dateStr)) {
              dateBookings.set(dateStr, new Set());
            }
            // If unit_id is null, it means all units are blocked for this date
            if (block.unit_id === null) {
              allUnits?.forEach(unit => {
                dateBookings.get(dateStr)?.add(unit.id);
              });
            } else {
              dateBookings.get(dateStr)?.add(block.unit_id);
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
        }
      } catch (error: any) {
        console.error("Error fetching booked dates:", error);
      }
    };

    fetchBookedDates();
  }, [preSelectedUnitId]);

  // Fetch rate plan pricing when unit or dates change
  useEffect(() => {
    const fetchRate = async () => {
      const unit = units.find(u => u.id === selectedUnit);
      if (!unit?.unit_type || !dateRange?.from) {
        setRatePlanRate(null);
        return;
      }
      try {
        const result = await getActiveRate(unit.unit_type, dateRange.from, selectedUnit);
        if (result) {
          // Also fetch the extra_adult_rate from the matched rate plan
          const { data: plan } = await supabase
            .from('rate_plans')
            .select('extra_adult_rate')
            .eq('id', result.ratePlanId)
            .single();
          
          setRatePlanRate({
            weekdayRate: result.weekdayRate,
            weekendRate: result.weekendRate,
            minStay: result.minStay,
            ratePlanName: result.ratePlanName,
            ratePlanId: result.ratePlanId,
            extraAdultRate: plan?.extra_adult_rate ?? 50,
          });
        } else {
          setRatePlanRate(null);
        }
      } catch (err) {
        console.error('Error fetching rate plan:', err);
        setRatePlanRate(null);
      }
    };
    fetchRate();
  }, [selectedUnit, dateRange?.from, units]);

  // Initialize single primary guest form (additional guest details collected at check-in)
  useEffect(() => {
    if (guestFirstNames.length === 0) {
      setGuestFirstNames(['']);
      setGuestLastNames(['']);
      setGuestTypes(['adult']);
      setGuestGenders(['']);
    }
  }, []);

  // Check if a date range contains any fully booked dates
  const isRangeValid = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return true;
    
    const start = new Date(range.from);
    const end = new Date(range.to);
    
    // Check each date in the range (excluding checkout date)
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const isBlocked = bookedDates.some(bookedDate => 
        format(bookedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')
      );
      if (isBlocked) return false;
    }
    return true;
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    // Only set the range if it's valid (doesn't contain blocked dates)
    if (isRangeValid(range)) {
      setDateRange(range);
    }
  };

  const updateGuestFirstName = (index: number, value: string) => {
    const updated = [...guestFirstNames];
    updated[index] = value;
    setGuestFirstNames(updated);
  };

  const updateGuestLastName = (index: number, value: string) => {
    const updated = [...guestLastNames];
    updated[index] = value;
    setGuestLastNames(updated);
  };

  const updateGuestType = (index: number, type: 'adult' | 'child') => {
    const newGuestTypes = [...guestTypes];
    newGuestTypes[index] = type;
    setGuestTypes(newGuestTypes);
  };

  const updateGuestGender = (index: number, gender: string) => {
    const newGuestGenders = [...guestGenders];
    newGuestGenders[index] = gender;
    setGuestGenders(newGuestGenders);
  };

  const isMarriageCertificateRequired = () => {
    if (adults !== 2) return false;
    if (!ARAB_NATIONALITIES.includes(nationality)) return false;
    
    const adultGenders = guestTypes
      .map((type, index) => type === 'adult' ? guestGenders[index] : null)
      .filter(gender => gender !== null && gender !== '');
    
    const hasMale = adultGenders.includes('male');
    const hasFemale = adultGenders.includes('female');
    
    return hasMale && hasFemale;
  };

  const calculateNights = () => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    const diff = dateRange.to.getTime() - dateRange.from.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Helper function to check if a date is a weekend day (Thu=4, Fri=5, Sat=6)
  const isWeekendDay = (date: Date): boolean => {
    const day = date.getDay();
    return day === 4 || day === 5 || day === 6; // Thursday, Friday, Saturday
  };

  const calculateSubtotal = () => {
    if (!ratePlanRate || !dateRange?.from || !dateRange?.to) return 0;
    
    let subtotal = 0;
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const rate = isWeekendDay(d) ? ratePlanRate.weekendRate : ratePlanRate.weekdayRate;
      subtotal += rate;
    }
    
    const nights = calculateNights();
    if (adults === 3) {
      subtotal += (ratePlanRate.extraAdultRate || 50) * nights;
    }
    
    return subtotal;
  };

  const calculateThirdGuestFee = () => {
    if (adults === 3) {
      const nights = calculateNights();
      return (ratePlanRate?.extraAdultRate || 50) * nights;
    }
    return 0;
  };

  // Get detailed breakdown of weekday vs weekend nights
  const getRateBreakdown = () => {
    if (!ratePlanRate || !dateRange?.from || !dateRange?.to) {
      return { weekdayNights: 0, weekendNights: 0, weekdayRate: 0, weekendRate: 0, dailyBreakdown: [] as { date: Date; isWeekend: boolean; rate: number }[] };
    }

    const dailyBreakdown: { date: Date; isWeekend: boolean; rate: number }[] = [];
    let weekdayNights = 0;
    let weekendNights = 0;

    for (let d = new Date(dateRange.from); d < dateRange.to; d.setDate(d.getDate() + 1)) {
      const isWeekend = isWeekendDay(d);
      const rate = isWeekend ? ratePlanRate.weekendRate : ratePlanRate.weekdayRate;
      dailyBreakdown.push({ date: new Date(d), isWeekend, rate });
      if (isWeekend && ratePlanRate.weekendRate !== ratePlanRate.weekdayRate) {
        weekendNights++;
      } else {
        weekdayNights++;
      }
    }

    return {
      weekdayNights,
      weekendNights,
      weekdayRate: ratePlanRate.weekdayRate,
      weekendRate: ratePlanRate.weekendRate,
      dailyBreakdown
    };
  };

  const calculateTax = () => {
    const unit = units.find(u => u.id === selectedUnit);
    const subtotal = calculateSubtotal();
    const taxRate = unit?.tax_percentage || 14;
    return subtotal * (taxRate / 100);
  };

  const calculateTotalPrice = () => {
    return calculateSubtotal() + calculateTax();
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (selectedPhotoIndex === null || !selectedUnit) return;
    
    const photos = units.find(u => u.id === selectedUnit)?.photos;
    if (!photos || photos.length === 0) return;

    if (direction === 'prev') {
      setSelectedPhotoIndex(selectedPhotoIndex === 0 ? photos.length - 1 : selectedPhotoIndex - 1);
    } else {
      setSelectedPhotoIndex(selectedPhotoIndex === photos.length - 1 ? 0 : selectedPhotoIndex + 1);
    }
    setImageScale(1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / initialPinchDistance;
      setImageScale(Math.min(Math.max(1, imageScale * scale), 4));
      setInitialPinchDistance(distance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1 && touchStart && !initialPinchDistance) {
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      
      // Swipe threshold
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          navigatePhoto('prev');
        } else {
          navigatePhoto('next');
        }
      }
    }
    setTouchStart(null);
    setInitialPinchDistance(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setImageScale(Math.min(Math.max(1, imageScale * delta), 4));
  };

  const handleModalClose = () => {
    setIsPhotoModalOpen(false);
    setImageScale(1);
  };

  const handleSubmit = async () => {
    // Combine first and last names for validation and submission
    const combinedNames = guestFirstNames.map((firstName, i) => 
      `${firstName.trim()} ${guestLastNames[i]?.trim() || ''}`.trim()
    );
    
    if (!dateRange?.from || !dateRange?.to || !selectedUnit || combinedNames.filter(n => n.trim()).length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const validGuestNames = combinedNames.filter(n => n.trim());
      
      // Get unit details for email
      const selectedUnitDetails = units.find(u => u.id === selectedUnit);
      const unitName = selectedUnitDetails ? `${selectedUnitDetails.name} ${selectedUnitDetails.unit_number || ''}`.trim() : 'Unit';
      const unitType = selectedUnitDetails?.unit_type || '';

      const { data: insertedReservation, error } = await supabase.from("reservations").insert({
        unit_id: selectedUnit,
        check_in_date: format(dateRange.from, "yyyy-MM-dd"),
        check_out_date: format(dateRange.to, "yyyy-MM-dd"),
        guest_names: validGuestNames,
        guest_types: guestTypes.slice(0, validGuestNames.length),
        guest_genders: guestGenders.slice(0, validGuestNames.length),
        adults,
        children,
        number_of_guests: adults + children,
        contact_email: email,
        contact_phone: `${countryCode}${phone}`,
        guest_nationality: nationality,
        notes,
        status: "confirmed",
        source: "direct website",
        booking_reference: `WEB-${Date.now()}`,
        channel: "Direct Website",
        price_per_night: ratePlanRate?.weekdayRate || 0,
        total_price: calculateTotalPrice(),
        commission_rate: 0,
        commission_amount: 0,
        net_revenue: calculateTotalPrice(),
        currency: "USD",
      });

      if (error) throw error;

      // Send email notification
      const bookingReference = `WEB-${Date.now()}`;
      try {
        await supabase.functions.invoke('send-reservation-notification', {
          body: {
            reservationId: bookingReference,
            guestNames: validGuestNames,
            checkIn: format(dateRange.from, "yyyy-MM-dd"),
            checkOut: format(dateRange.to, "yyyy-MM-dd"),
            unitName,
            unitType,
            totalPrice: calculateTotalPrice(),
            subtotal: calculateSubtotal(),
            taxAmount: calculateTax(),
            taxPercentage: units.find(u => u.id === selectedUnit)?.tax_percentage || 14,
            numberOfGuests: adults + children,
            adults,
            children,
            source: "direct website",
            notes: notes || null,
            guestNationality: nationality || null,
            customerEmail: email,
            customerPhone: phone,
          },
        });
        console.log('Email notification sent successfully');
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }

      toast({
        title: "Booking Confirmed!",
        description: "We've received your reservation. Check your email for confirmation.",
      });

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
      <Helmet>
        <title>Book Your Stay | SuiteSpot Serviced Apartments in Cairo</title>
        <meta name="description" content="Reserve your serviced apartment in Zamalek, Cairo. Easy online booking for studio, one-bedroom, and two-bedroom suites at SuiteSpot." />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      {/* Navigation */}
      <PublicNav />

      <div className="container mx-auto px-6 py-12 pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-playfair font-bold text-foreground mb-3">ICONIA Zamalek</h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="uppercase tracking-wide text-sm">Cairo, Egypt</span>
            </div>
          </div>

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
                <span className="text-sm font-medium">Confirm Booking</span>
              </div>
            </div>
          </div>

          <Card className="p-8">
            {/* Step 1: Dates & Suite Selection */}
            {step === 1 && (
              <div className="space-y-6">
                {/* Show pre-selected unit details prominently */}
                {preSelectedUnitId && units.length > 0 && (
                  <div className="p-6 border-2 rounded-lg bg-muted/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-serif font-bold text-foreground">
                          {units[0].name}
                        </h2>
                        {units[0].unit_number && (
                          <p className="text-sm text-muted-foreground">Room {units[0].unit_number}</p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link to="/suites">View All Suites</Link>
                      </Button>
                    </div>

                    {/* Unit specs */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                        <Bed className="h-5 w-5 text-accent mb-1" />
                        <span className="text-sm font-semibold">{units[0].beds || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">Beds</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                        <Bath className="h-5 w-5 text-accent mb-1" />
                        <span className="text-sm font-semibold">{units[0].baths || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">Baths</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                        <Users className="h-5 w-5 text-accent mb-1" />
                        <span className="text-sm font-semibold">{units[0].max_guests || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">Guests</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                        <Sofa className="h-5 w-5 text-accent mb-1" />
                        <span className="text-sm font-semibold">{units[0].sofa_bed ? 'Yes' : 'No'}</span>
                        <span className="text-xs text-muted-foreground">Sofa Bed</span>
                      </div>
                      <div className="flex flex-col items-center p-3 bg-background rounded-lg">
                        <Maximize2 className="h-5 w-5 text-accent mb-1" />
                        <span className="text-sm font-semibold">{units[0].unit_size || 'N/A'}</span>
                        <span className="text-xs text-muted-foreground">Size</span>
                      </div>
                    </div>

                    {/* Photo Gallery */}
                    {units[0].photos && units[0].photos.length > 0 && (
                      <div className="space-y-2">
                        <Label>Suite Gallery</Label>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                          {units[0].photos.map((photo, index) => (
                            <div 
                              key={index}
                              className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border"
                              onClick={() => {
                                setSelectedPhotoIndex(index);
                                setIsPhotoModalOpen(true);
                              }}
                            >
                              <img 
                                src={photo} 
                                alt={`Suite photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                        onSelect={handleDateSelect}
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
                        modifiersClassNames={{
                          booked: "bg-white text-muted-foreground opacity-60 cursor-not-allowed"
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="adults">Adults</Label>
                    <Input
                      id="adults"
                      type="number"
                      min="0"
                      value={adults}
                      onChange={(e) => setAdults(parseInt(e.target.value) || 0)}
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

                {/* Only show dropdown if no pre-selected unit */}
                {!preSelectedUnitId && !preSelectedUnitType && (
                  <>
                    <div>
                      <Label htmlFor="unit">Select Suite Type</Label>
                      {dateRange?.from && dateRange?.to ? (
                        <Select 
                          value={selectedUnitType} 
                          onValueChange={(unitType) => {
                            setSelectedUnitType(unitType);
                            // Auto-select first available unit of this type
                            const group = groupedUnitTypes.find(g => g.unit_type === unitType);
                            if (group && group.available_unit_ids.length > 0) {
                              setSelectedUnit(group.available_unit_ids[0]);
                            }
                          }} 
                          disabled={isLoadingUnits}
                        >
                          <SelectTrigger id="unit">
                            <SelectValue placeholder={isLoadingUnits ? "Loading available suites..." : groupedUnitTypes.length === 0 ? "No suites available for these dates" : "Choose a suite"} />
                          </SelectTrigger>
                          <SelectContent>
                            {groupedUnitTypes.length === 0 && !isLoadingUnits ? (
                              <div className="p-2 text-sm text-muted-foreground">No suites available for selected dates</div>
                            ) : (
                              groupedUnitTypes.map((group) => (
                                <SelectItem key={group.unit_type} value={group.unit_type}>
                                  {group.name}{ratePlanRate ? ` - $${ratePlanRate.weekdayRate}/night` : ''}
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


                    {selectedUnit && units.length > 0 && (
                      <div className="p-4 border rounded-lg bg-muted/50">
                        <div className="flex flex-wrap gap-4 items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bed className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              <span className="font-semibold">Bedrooms:</span> {units.find(u => u.id === selectedUnit)?.beds || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Bath className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              <span className="font-semibold">Bathrooms:</span> {units.find(u => u.id === selectedUnit)?.baths || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              <span className="font-semibold">Max guests:</span> {units.find(u => u.id === selectedUnit)?.max_guests || 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Sofa className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              <span className="font-semibold">Sofa bed:</span> {units.find(u => u.id === selectedUnit)?.sofa_bed ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Maximize2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              <span className="font-semibold">Size:</span> {units.find(u => u.id === selectedUnit)?.unit_size || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Show availability message for pre-selected unit type */}
                {preSelectedUnitType && units.length > 0 && (
                  <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{units.length} unit{units.length > 1 ? 's' : ''}</span> of this type {units.length > 1 ? 'are' : 'is'} available for your dates
                    </p>
                  </div>
                )}

                {/* Pricing Information */}
                {selectedUnit && ratePlanRate && dateRange?.from && dateRange?.to && (
                  <div className="p-4 border rounded-lg bg-accent/5">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Price per night:</span>
                        <span className="text-lg font-semibold">${ratePlanRate.weekdayRate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{calculateNights()} night{calculateNights() !== 1 ? "s" : ""}:</span>
                        <span className="text-sm">${ratePlanRate.weekdayRate} × {calculateNights()}</span>
                      </div>
                      {adults === 3 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Third guest fee:</span>
                          <span className="text-sm">${ratePlanRate.extraAdultRate || 50} × {calculateNights()}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm uppercase">Price:</span>
                          <span className="font-bold">${calculateSubtotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm uppercase">Tax ({units.find(u => u.id === selectedUnit)?.tax_percentage || 14}%):</span>
                          <span className="font-bold">${calculateTax().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="font-semibold uppercase">Grand Total:</span>
                          <span className="text-2xl font-bold text-accent">${calculateTotalPrice().toFixed(2)}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-foreground leading-relaxed text-center italic">
                            All rates are based on double occupancy, with a maximum room capacity of 3 people. A third guest (age 18+) may stay in room, based on availability, for ${ratePlanRate.extraAdultRate || 50} USD (including taxes). Children are free of charge.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photo Gallery - Only show for non-preselected units (already shown above for preselected) */}
                {!preSelectedUnitId && selectedUnit && units.find(u => u.id === selectedUnit)?.photos && units.find(u => u.id === selectedUnit)!.photos!.length > 0 && (
                  <div className="space-y-2">
                    <Label>Suite Gallery</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {units.find(u => u.id === selectedUnit)!.photos!.map((photo, index) => (
                        <div 
                          key={index}
                          className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border"
                          onClick={() => {
                            setSelectedPhotoIndex(index);
                            setIsPhotoModalOpen(true);
                          }}
                        >
                          <img 
                            src={photo} 
                            alt={`Suite photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => {
                    if (adults === 0) {
                      toast({
                        title: "Missing Information",
                        description: "Please specify the number of adults",
                        variant: "destructive",
                      });
                      return;
                    }
                    setStep(2);
                  }}
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
                <Label className="text-lg font-semibold">Guest Information</Label>
                
                {/* Primary Guest Form */}
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First Name <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="First name"
                        value={guestFirstNames[0] || ''}
                        onChange={(e) => updateGuestFirstName(0, e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Last Name <span className="text-destructive">*</span></Label>
                      <Input
                        placeholder="Last name"
                        value={guestLastNames[0] || ''}
                        onChange={(e) => updateGuestLastName(0, e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={guestGenders[0] || ""}
                      onValueChange={(value) => updateGuestGender(0, value as 'Mr.' | 'Mrs.' | 'Miss')}
                    >
                      <SelectTrigger className="w-full mt-2">
                        <SelectValue placeholder="Select title..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="Mr.">Mr.</SelectItem>
                        <SelectItem value="Mrs.">Mrs.</SelectItem>
                        <SelectItem value="Miss">Miss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Nationality */}
                <div>
                  <Label>Nationality <span className="text-destructive">*</span></Label>
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

                {/* Marriage Certificate Notice - Conditional */}
                {isMarriageCertificateRequired() && (
                  <div className="p-4 border-2 border-amber-500/50 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <svg 
                          className="w-6 h-6 text-amber-600 dark:text-amber-500" 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-amber-900 dark:text-amber-100 mb-1">
                          Marriage certificate is required for Egyptian and Arab couples/groups
                        </h4>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Following the Egyptian Law, if any couple are Egyptians or holds an Arab passport, a marriage certificate will be required upon check-in to stay together.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact Email */}
                <div>
                  <Label htmlFor="email">Contact Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="guest@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Contact Phone */}
                <div>
                  <Label>Contact Phone <span className="text-destructive">*</span></Label>
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
                      id="phone"
                      type="tel"
                      placeholder="1234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Special Requests */}
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
                    disabled={
                      !email || 
                      !phone ||
                      !nationality ||
                      guestFirstNames.filter((fn, i) => fn.trim() && guestLastNames[i]?.trim()).length === 0
                    }
                    className="flex-1 bg-accent hover:bg-accent/90"
                  >
                    Confirm booking
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Confirm your Booking</h3>
                
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Check in</span>
                      <span>{dateRange?.from && format(dateRange.from, "dd MMMM, yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Check out</span>
                      <span>{dateRange?.to && format(dateRange.to, "dd MMMM, yyyy")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Nights</span>
                      <span>{calculateNights()}</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">Room Type</span>
                      <div className="text-right">
                        <span className="block">
                          {units.find(u => u.id === selectedUnit)?.booking_com_name || 
                           units.find(u => u.id === selectedUnit)?.name || selectedUnit}
                        </span>
                        {dateRange?.from && (
                          <span className="block text-green-600 font-bold mt-1">
                            FREE cancellation before {format(subDays(dateRange.from, 2), "d MMM yyyy")}
                          </span>
                        )}
                        <button 
                          onClick={() => setIsDetailsModalOpen(true)}
                          className="text-sm underline text-muted-foreground hover:text-foreground mt-1"
                        >
                          Details & Conditions
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rate Details Modal */}
                  <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                    <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-light">Rate Details</DialogTitle>
                      </DialogHeader>
                      
                      <div className="space-y-4 mt-4">
                        {/* Dates */}
                        <div className="flex gap-8">
                          <span className="font-medium w-24">Dates</span>
                          <span>
                            {dateRange?.from && format(dateRange.from, "d MMM")} - {dateRange?.to && format(dateRange.to, "d MMM yyyy")} ({calculateNights()} nights)
                          </span>
                        </div>
                        
                        {/* Guests */}
                        <div className="flex gap-8">
                          <span className="font-medium w-24">Guests</span>
                          <span>
                            {adults} Adult{adults > 1 ? "s" : ""}
                            {children > 0 && `, ${children} Child${children !== 1 ? "ren" : ""}`}
                          </span>
                        </div>
                        
                        {/* Room type */}
                        <div className="flex gap-8">
                          <span className="font-medium w-24">Room type</span>
                          <span>
                            {units.find(u => u.id === selectedUnit)?.booking_com_name || 
                             units.find(u => u.id === selectedUnit)?.name || selectedUnit}
                          </span>
                        </div>
                        
                        {/* Rate */}
                        <div className="flex gap-8">
                          <span className="font-medium w-24">Rate</span>
                          <span>Room only</span>
                        </div>
                        
                        <div className="border-t border-amber-400 pt-4 mt-4">
                          <p className="uppercase text-sm tracking-wide mb-3">Included in this rate</p>
                          <ul className="space-y-2">
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-muted-foreground" />
                              <span>Welcome drink, upon arrival</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-muted-foreground" />
                              <span>Complimentary Internet</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-muted-foreground" />
                              <span>Complimentary Mineral Water in the room upon arrival</span>
                            </li>
                          </ul>
                        </div>
                        
                        {/* Rate Conditions */}
                        <div className="border-t border-amber-400 pt-4 mt-4">
                          <h2 className="text-2xl font-light mb-4">Rate conditions</h2>
                          
                          <Accordion type="multiple" defaultValue={["cancellable", "payment", "noshow"]}>
                            <AccordionItem value="cancellable" className="border-b border-gray-200">
                              <AccordionTrigger className="text-left font-bold text-base hover:no-underline">
                                Rate is cancellable
                              </AccordionTrigger>
                              <AccordionContent className="text-muted-foreground">
                                This rate is cancellable without fee until {dateRange?.from && format(subDays(dateRange.from, 2), "d MMMM yyyy")} 23:59 hotel local time. In case of cancellation beyond {dateRange?.from && format(subDays(dateRange.from, 1), "d MMMM yyyy")} 00:00 local time, a penalty of 1 night will be charged by the hotel on the credit card provided to guarantee the booking.
                              </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="payment" className="border-b border-gray-200">
                              <AccordionTrigger className="text-left font-bold text-base hover:no-underline">
                                Payment at the beginning of your stay
                              </AccordionTrigger>
                              <AccordionContent className="text-muted-foreground">
                                This rate requires no pre-payment. The entire stay must be paid to the hotel at the beginning of your stay.
                              </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="noshow" className="border-b border-gray-200">
                              <AccordionTrigger className="text-left font-bold text-base hover:no-underline">
                                No show
                              </AccordionTrigger>
                              <AccordionContent className="text-muted-foreground">
                                No show exposes the client to a penalty equal to 100% of the total stay. This penalty will be charged on the credit card.
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                        
                        {/* Price breakdown */}
                        {ratePlanRate && (
                          <>
                            <div className="border-t border-amber-400 pt-4 flex justify-between">
                              <span>Average nightly rate before tax</span>
                              <span>US${ratePlanRate.weekdayRate}</span>
                            </div>
                            
                            <div className="border-t border-amber-400 pt-4 flex justify-between font-medium">
                              <span>Room total (tax included)</span>
                              <span>US${(() => {
                                const unit = units.find(u => u.id === selectedUnit);
                                const nights = calculateNights();
                                const subtotal = calculateSubtotal();
                                const taxRate = unit?.tax_percentage || 0;
                                return Math.round(subtotal * (1 + taxRate / 100));
                              })()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div>
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-medium">
                      {adults} Adult{adults > 1 ? "s" : ""}
                      {children > 0 && `, ${children} Child${children !== 1 ? "ren" : ""}`}
                    </p>
                    <p className="text-sm mt-1">
                      {guestFirstNames.map((firstName, i) => 
                        `${firstName.trim()} ${guestLastNames[i]?.trim() || ''}`.trim()
                      ).filter(n => n).join(", ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="font-medium">{email}</p>
                    {phone && <p className="text-sm">{countryCode}{phone}</p>}
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

                  {ratePlanRate && (() => {
                    const breakdown = getRateBreakdown();
                    const hasWeekendRate = ratePlanRate.weekendRate !== ratePlanRate.weekdayRate && breakdown.weekendNights > 0;
                    
                    return (
                      <div className="border-t pt-4">
                        <div className="space-y-3">
                          {/* Rate Header */}
                          {hasWeekendRate ? (
                            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Weekday Rate (Sun–Wed):</span>
                                <span className="font-medium">${breakdown.weekdayRate}/night</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Weekend Rate (Thu–Sat):</span>
                                <span className="font-medium text-amber-600">${breakdown.weekendRate}/night</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between">
                              <span className="text-sm text-muted-foreground">Rate per night:</span>
                              <span className="font-medium">${ratePlanRate.weekdayRate}/night</span>
                            </div>
                          )}

                          {/* Nightly Breakdown */}
                          {hasWeekendRate ? (
                            <div className="space-y-2">
                              {breakdown.weekdayNights > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {breakdown.weekdayNights} weekday night{breakdown.weekdayNights !== 1 ? 's' : ''} × ${breakdown.weekdayRate}
                                  </span>
                                  <span>${(breakdown.weekdayNights * breakdown.weekdayRate).toFixed(2)}</span>
                                </div>
                              )}
                              {breakdown.weekendNights > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-amber-600">
                                    {breakdown.weekendNights} weekend night{breakdown.weekendNights !== 1 ? 's' : ''} × ${breakdown.weekendRate}
                                  </span>
                                  <span className="text-amber-600">${(breakdown.weekendNights * breakdown.weekendRate).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{calculateNights()} nights × ${ratePlanRate.weekdayRate}</span>
                              <span>${(ratePlanRate.weekdayRate * calculateNights()).toFixed(2)}</span>
                            </div>
                          )}

                          {/* Third Guest Fee */}
                          {adults === 3 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Third guest fee ({calculateNights()} nights × ${ratePlanRate.extraAdultRate || 50})</span>
                              <span>${calculateThirdGuestFee().toFixed(2)}</span>
                            </div>
                          )}

                          {/* Totals */}
                          <div className="border-t pt-3 mt-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold uppercase">Subtotal:</span>
                              <span className="font-bold text-lg">${calculateSubtotal().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="font-bold uppercase">Tax ({units.find(u => u.id === selectedUnit)?.tax_percentage || 14}%):</span>
                              <span className="font-bold text-lg">${calculateTax().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-3 mt-2">
                              <span className="font-bold text-lg uppercase">Grand Total:</span>
                              <span className="text-3xl font-bold text-accent">${calculateTotalPrice().toFixed(2)}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-foreground leading-relaxed text-center italic">
                                All rates are based on double occupancy, with a maximum room capacity of 3 people. A third guest (age 18+) may stay in room, based on availability, for ${ratePlanRate?.extraAdultRate || 50} USD (including taxes). Children are free of charge.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* How to secure booking section */}
                <div className="mt-6 space-y-4">
                  <h3 className="text-2xl font-light">How do you want to secure your booking?</h3>
                  
                  <div className="bg-muted/30 rounded-lg p-4">
                    <p className="text-sm">
                      <span className="font-bold">Your credit card will not be charged.</span>{" "}
                      It will be used to guarantee your booking until you arrive at the hotel
                    </p>
                  </div>
                </div>

                {/* Payment Card Section */}
                <div ref={paymentSectionRef} className="mt-6 p-6 bg-white rounded-lg shadow-sm border">
                  <h3 className="text-2xl font-light mb-4">Choose a Payment Card</h3>
                  
                  <p className="text-muted-foreground mb-4 text-sm">
                    No prepayment required. <span className="font-bold">Payment is made at the hotel upon arrival. Card details are used only to confirm your reservation.</span>
                  </p>
                  
                  {/* PCI DSS Compliant Badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-foreground">PCI DSS</span>
                    <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      100% secure & PCI DSS compliant
                    </span>
                    <Lock className="w-4 h-4 text-green-600" />
                  </div>
                  
                  {/* Accepted Cards */}
                  <p className="text-sm mb-3 text-muted-foreground">We only accept the following credit cards:</p>
                  <div className="flex gap-3 mb-6 items-center">
                    <img src={mastercardLogo} alt="Mastercard" className="h-8 object-contain" />
                    <img src={visaLogo} alt="Visa" className="h-6 object-contain" />
                  </div>
                  
                  {/* Card Form Fields (NO CVC) */}
                  <div className="space-y-4">
                    <div>
                      <Input
                        placeholder="Card Holder*"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    
                    <div>
                      <div className="relative">
                        <Input
                          placeholder="Card Number*"
                          value={cardNumber}
                          onChange={(e) => {
                            const formatted = formatCardNumber(e.target.value);
                            setCardNumber(formatted);
                            
                            const digitsOnly = formatted.replace(/\D/g, "");
                            if (digitsOnly.length === 16) {
                              if (!isValidLuhn(digitsOnly)) {
                                setCardNumberError("Invalid card number");
                              } else {
                                setCardNumberError("");
                              }
                            } else {
                              setCardNumberError("");
                            }
                          }}
                          className={cn("bg-background pr-10", cardNumberError && "border-destructive")}
                          maxLength={19}
                        />
                        <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      </div>
                      {cardNumberError && (
                        <p className="text-sm text-destructive mt-1">{cardNumberError}</p>
                      )}
                    </div>
                    
                    <div>
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="MM"
                          value={expiryMonth}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 2);
                            setExpiryMonth(value);
                            
                            if (value.length === 2) {
                              const monthNum = parseInt(value, 10);
                              if (monthNum < 1 || monthNum > 12) {
                                setExpiryError("Invalid month (01-12)");
                              } else if (expiryYear.length === 2 && isCardExpired(value, expiryYear)) {
                                setExpiryError("Card has expired");
                              } else {
                                setExpiryError("");
                              }
                            } else {
                              setExpiryError("");
                            }
                          }}
                          className={cn("bg-background", expiryError && "border-destructive")}
                          maxLength={2}
                        />
                        <Input
                          placeholder="YY"
                          value={expiryYear}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "").slice(0, 2);
                            setExpiryYear(value);
                            
                            if (value.length === 2 && expiryMonth.length === 2) {
                              const monthNum = parseInt(expiryMonth, 10);
                              if (monthNum >= 1 && monthNum <= 12 && isCardExpired(expiryMonth, value)) {
                                setExpiryError("Card has expired");
                              } else {
                                setExpiryError("");
                              }
                            }
                          }}
                          className={cn("bg-background", expiryError && "border-destructive")}
                          maxLength={2}
                        />
                      </div>
                      {expiryError && (
                        <p className="text-sm text-destructive mt-1">{expiryError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Back
                  </Button>
                </div>
                
                {/* Spacer for sticky footer */}
                <div className="h-24" />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Photo Modal */}
      <Dialog open={isPhotoModalOpen} onOpenChange={(open) => {
        if (!open) handleModalClose();
        else setIsPhotoModalOpen(open);
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogClose className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-6 w-6 text-white drop-shadow-lg" />
            <span className="sr-only">Close</span>
          </DialogClose>
          
          {selectedPhotoIndex !== null && selectedUnit && units.find(u => u.id === selectedUnit)?.photos && (
            <div 
              className="relative select-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
            >
              {/* Navigation Arrows */}
              {units.find(u => u.id === selectedUnit)!.photos!.length > 1 && (
                <>
                  <button
                    onClick={() => navigatePhoto('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all hover:scale-110"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={() => navigatePhoto('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all hover:scale-110"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
              
              {/* Image */}
              <div className="overflow-auto max-h-[80vh]">
                <img 
                  src={units.find(u => u.id === selectedUnit)!.photos![selectedPhotoIndex]} 
                  alt={`Suite photo ${selectedPhotoIndex + 1}`}
                  className="w-full h-auto object-contain transition-transform duration-200"
                  style={{ transform: `scale(${imageScale})`, transformOrigin: 'center' }}
                  draggable={false}
                />
              </div>
              
              {/* Photo Counter */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                {selectedPhotoIndex + 1} / {units.find(u => u.id === selectedUnit)!.photos!.length}
              </div>
              
              {/* Zoom Indicator */}
              {imageScale > 1 && (
                <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  {Math.round(imageScale * 100)}%
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Sticky Footer with Confirm Booking Button - Only show on Step 3 */}
      {step === 3 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 p-4">
          <div className="max-w-2xl mx-auto">
            <Button
              onClick={() => {
                // Check if all fields are filled
                if (!cardHolder || !cardNumber || !expiryMonth || !expiryYear) {
                  setShowPaymentSection(true);
                  setTimeout(() => {
                    paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                  toast({
                    title: "Payment Required",
                    description: "Please fill in your payment card details to confirm your booking.",
                  });
                  return;
                }
                
                // Validate card number with Luhn algorithm
                const digitsOnly = cardNumber.replace(/\D/g, "");
                if (digitsOnly.length < 16 || !isValidLuhn(digitsOnly)) {
                  setCardNumberError("Please enter a valid card number");
                  paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  return;
                }
                
                // Validate month is 01-12
                const monthNum = parseInt(expiryMonth, 10);
                if (monthNum < 1 || monthNum > 12) {
                  setExpiryError("Invalid month (01-12)");
                  paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  return;
                }
                
                // Validate expiry date
                if (isCardExpired(expiryMonth, expiryYear)) {
                  setExpiryError("Card has expired");
                  paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  return;
                }
                
                handleSubmit();
              }}
              disabled={isSubmitting}
              className="w-full bg-[#2D2D2D] hover:bg-[#1D1D1D] text-white py-6 text-base font-medium uppercase tracking-wide rounded-lg"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              CONFIRM BOOKING
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingFlow;

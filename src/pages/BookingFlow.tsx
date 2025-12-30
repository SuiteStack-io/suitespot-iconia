import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { Loader2, Bed, Bath, Users, Maximize2, Sofa, X, ChevronLeft, ChevronRight, Upload, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { PublicNav } from "@/components/PublicNav";

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
  unit_type: string | null;
  unit_number: string | null;
  status: string;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  unit_size: string | null;
  sofa_bed: boolean | null;
  price_per_night: number | null;
  weekend_rate: number | null;
  tax_percentage: number | null;
  photos: string[] | null;
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
  
  // Booking data
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [guestFirstNames, setGuestFirstNames] = useState<string[]>([""]);
  const [guestLastNames, setGuestLastNames] = useState<string[]>([""]);
  const [guestTypes, setGuestTypes] = useState<('adult' | 'child')[]>(["adult"]);
  const [guestGenders, setGuestGenders] = useState<('male' | 'female' | '')[]>([""]);
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
            .select("id, name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, price_per_night, weekend_rate, tax_percentage, photos")
            .eq("id", preSelectedUnitId)
            .eq("is_private", false)
            .eq("location", "ICONIA")
            .single();

          if (unitError) throw unitError;
          setUnits(unit ? [unit] : []);
        } else if (preSelectedUnitType) {
          // If a unit type is pre-selected, fetch all units of that type
          let query = supabase
            .from("units")
            .select("id, name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, price_per_night, weekend_rate, tax_percentage, photos")
            .eq("status", "available")
            .eq("unit_type", preSelectedUnitType)
            .eq("is_private", false)
            .eq("location", "ICONIA")
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
            .select("id, name, unit_type, unit_number, status, beds, baths, max_guests, unit_size, sofa_bed, price_per_night, weekend_rate, tax_percentage, photos")
            .eq("status", "available")
            .eq("is_private", false)
            .eq("location", "ICONIA")
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
          name: unit.name,
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

  // Auto-sync guest names array when adults/children selectors change
  useEffect(() => {
    const totalGuests = adults + children;
    
    const newGuestFirstNames = Array(totalGuests).fill('').map((_, i) => guestFirstNames[i] || '');
    const newGuestLastNames = Array(totalGuests).fill('').map((_, i) => guestLastNames[i] || '');
    const newGuestTypes = Array(totalGuests).fill('adult' as 'adult' | 'child').map((_, i) => {
      if (guestTypes[i]) return guestTypes[i];
      return i < adults ? 'adult' : 'child';
    });
    const newGuestGenders = Array(totalGuests).fill('').map((_, i) => guestGenders[i] || '');
    
    setGuestFirstNames(newGuestFirstNames);
    setGuestLastNames(newGuestLastNames);
    setGuestTypes(newGuestTypes);
    setGuestGenders(newGuestGenders);
  }, [adults, children]);

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

  const updateGuestGender = (index: number, gender: 'male' | 'female') => {
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
    const unit = units.find(u => u.id === selectedUnit);
    if (!unit?.price_per_night || !dateRange?.from || !dateRange?.to) return 0;
    
    let subtotal = 0;
    const startDate = new Date(dateRange.from);
    const endDate = new Date(dateRange.to);
    
    // Calculate price for each night based on day of week
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const rate = isWeekendDay(d) && unit.weekend_rate 
        ? unit.weekend_rate 
        : unit.price_per_night;
      subtotal += rate;
    }
    
    // Add $50 per night for third adult guest
    const nights = calculateNights();
    if (adults === 3) {
      subtotal += 50 * nights;
    }
    
    return subtotal;
  };

  const calculateThirdGuestFee = () => {
    if (adults === 3) {
      const nights = calculateNights();
      return 50 * nights;
    }
    return 0;
  };

  // Get detailed breakdown of weekday vs weekend nights
  const getRateBreakdown = () => {
    const unit = units.find(u => u.id === selectedUnit);
    if (!unit?.price_per_night || !dateRange?.from || !dateRange?.to) {
      return { weekdayNights: 0, weekendNights: 0, weekdayRate: 0, weekendRate: 0, dailyBreakdown: [] as { date: Date; isWeekend: boolean; rate: number }[] };
    }

    const dailyBreakdown: { date: Date; isWeekend: boolean; rate: number }[] = [];
    let weekdayNights = 0;
    let weekendNights = 0;

    for (let d = new Date(dateRange.from); d < dateRange.to; d.setDate(d.getDate() + 1)) {
      const isWeekend = isWeekendDay(d);
      const rate = isWeekend && unit.weekend_rate ? unit.weekend_rate : unit.price_per_night;
      dailyBreakdown.push({ date: new Date(d), isWeekend, rate });
      if (isWeekend && unit.weekend_rate) {
        weekendNights++;
      } else {
        weekdayNights++;
      }
    }

    return {
      weekdayNights,
      weekendNights,
      weekdayRate: unit.price_per_night,
      weekendRate: unit.weekend_rate || unit.price_per_night,
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
        price_per_night: units.find(u => u.id === selectedUnit)?.price_per_night || 0,
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
                                  {group.name} ({group.available_count} available)
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

                    {/* Show availability message when a unit type is selected */}
                    {selectedUnitType && groupedUnitTypes.length > 0 && (
                      <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{groupedUnitTypes.find(g => g.unit_type === selectedUnitType)?.available_count || 0} unit{(groupedUnitTypes.find(g => g.unit_type === selectedUnitType)?.available_count || 0) > 1 ? 's' : ''}</span> of this type {(groupedUnitTypes.find(g => g.unit_type === selectedUnitType)?.available_count || 0) > 1 ? 'are' : 'is'} available for your dates
                        </p>
                      </div>
                    )}

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
                {selectedUnit && units.find(u => u.id === selectedUnit)?.price_per_night && dateRange?.from && dateRange?.to && (
                  <div className="p-4 border rounded-lg bg-accent/5">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Price per night:</span>
                        <span className="text-lg font-semibold">${units.find(u => u.id === selectedUnit)?.price_per_night}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{calculateNights()} night{calculateNights() !== 1 ? "s" : ""}:</span>
                        <span className="text-sm">${units.find(u => u.id === selectedUnit)?.price_per_night} × {calculateNights()}</span>
                      </div>
                      {adults === 3 && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Third guest fee:</span>
                          <span className="text-sm">$50 × {calculateNights()}</span>
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
                            All rates are based on double occupancy, with a maximum room capacity of 3 people. A third guest (age 18+) may stay in room, based on availability, for $50 USD (including taxes). Children are free of charge.
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
                
                {/* Guest Names with Types and Genders */}
                <div className="space-y-4">
                  {guestFirstNames.map((firstName, index) => (
                    <div key={index} className="space-y-3 p-4 border rounded-lg">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>First Name <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="First name"
                            value={firstName}
                            onChange={(e) => updateGuestFirstName(index, e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Last Name <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="Last name"
                            value={guestLastNames[index] || ''}
                            onChange={(e) => updateGuestLastName(index, e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-sm text-muted-foreground">
                          Guest Type <span className="text-destructive">*</span>
                        </Label>
                        <RadioGroup
                          value={guestTypes[index]}
                          onValueChange={(value) => updateGuestType(index, value as 'adult' | 'child')}
                          className="flex gap-4 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="adult" id={`adult-${index}`} />
                            <Label htmlFor={`adult-${index}`} className="font-normal cursor-pointer">
                              Adult
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="child" id={`child-${index}`} />
                            <Label htmlFor={`child-${index}`} className="font-normal cursor-pointer">
                              Child
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      
                      {guestTypes[index] === 'adult' && (
                        <div>
                          <Label className="text-sm text-muted-foreground">
                            Gender <span className="text-destructive">*</span>
                          </Label>
                          <RadioGroup
                            value={guestGenders[index] || ""}
                            onValueChange={(value) => updateGuestGender(index, value as 'male' | 'female')}
                            className="flex gap-4 mt-2"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="male" id={`male-${index}`} />
                              <Label htmlFor={`male-${index}`} className="font-normal cursor-pointer">
                                Male
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="female" id={`female-${index}`} />
                              <Label htmlFor={`female-${index}`} className="font-normal cursor-pointer">
                                Female
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  ))}
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
                    <p className="font-medium">
                      {units.find(u => u.id === selectedUnit)?.name || selectedUnit}
                      {units.find(u => u.id === selectedUnit)?.unit_number && 
                        ` (Unit ${units.find(u => u.id === selectedUnit)?.unit_number})`}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-medium">{adults} Adult{adults > 1 ? "s" : ""}, {children} Child{children !== 1 ? "ren" : ""}</p>
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

                  {units.find(u => u.id === selectedUnit)?.price_per_night && (() => {
                    const unit = units.find(u => u.id === selectedUnit);
                    const breakdown = getRateBreakdown();
                    const hasWeekendRate = unit?.weekend_rate && breakdown.weekendNights > 0;
                    
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
                              <span className="font-medium">${unit?.price_per_night}/night</span>
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
                              <span className="text-muted-foreground">{calculateNights()} nights × ${unit?.price_per_night}</span>
                              <span>${((unit?.price_per_night || 0) * calculateNights()).toFixed(2)}</span>
                            </div>
                          )}

                          {/* Third Guest Fee */}
                          {adults === 3 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Third guest fee ({calculateNights()} nights × $50)</span>
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
                              <span className="font-bold uppercase">Tax ({unit?.tax_percentage || 14}%):</span>
                              <span className="font-bold text-lg">${calculateTax().toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t pt-3 mt-2">
                              <span className="font-bold text-lg uppercase">Grand Total:</span>
                              <span className="text-3xl font-bold text-accent">${calculateTotalPrice().toFixed(2)}</span>
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-foreground leading-relaxed text-center italic">
                                All rates are based on double occupancy, with a maximum room capacity of 3 people. A third guest (age 18+) may stay in room, based on availability, for $50 USD (including taxes). Children are free of charge.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
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
                    Confirm and pay
                  </Button>
                </div>
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
    </div>
  );
};

export default BookingFlow;

import { useState, useEffect, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CalendarIcon, Plus, X, Check, ChevronsUpDown, Upload, Download, Loader2 } from "lucide-react";
import { format, differenceInDays, isBefore, isAfter, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { useAuth } from "@/lib/auth";
import { DateRange } from "react-day-picker";

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
  unit_type: string | null;
  booking_com_name: string | null;
  price_per_night: number | null;
  weekend_rate: number | null;
  tax_percentage: number | null;
  default_occupancy: number | null;
  max_guests: number | null;
}

export function CreateReservationDialog() {
  const { userRole, hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const canCreateBooking = hasPermission('can_create_booking');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  
  // Form state
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [numberOfRooms, setNumberOfRooms] = useState<number>(1);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([""]);
  const [roomPrices, setRoomPrices] = useState<(number | "")[]>([""]);
  const [unitId, setUnitId] = useState("");
  const [roomNumber, setRoomNumber] = useState<string>("");
  // Per-room guest counts
  const [roomAdults, setRoomAdults] = useState<number[]>([1]);
  const [roomChildren, setRoomChildren] = useState<number[]>([0]);
  // Main guest only
  const [guestFirstNames, setGuestFirstNames] = useState<string[]>([""]);
  const [guestLastNames, setGuestLastNames] = useState<string[]>([""]);
  const [guestTypes, setGuestTypes] = useState<('adult' | 'child')[]>(["adult"]);
  const [guestGenders, setGuestGenders] = useState<('male' | 'female' | '')[]>([""]);
  const [nationality, setNationality] = useState("");
  const [idPassportFile, setIdPassportFile] = useState<File | null>(null);
  const [idPassportUrl, setIdPassportUrl] = useState<string | null>(null);
  const [idPassportFileBack, setIdPassportFileBack] = useState<File | null>(null);
  const [idPassportUrlBack, setIdPassportUrlBack] = useState<string | null>(null);
  const [idPassportType, setIdPassportType] = useState<'id' | 'passport'>('id');
  const [idUploadProgress, setIdUploadProgress] = useState<number>(0);
  const [idUploadProgressBack, setIdUploadProgressBack] = useState<number>(0);
  const [isIdUploading, setIsIdUploading] = useState<boolean>(false);
  const [isIdUploadingBack, setIsIdUploadingBack] = useState<boolean>(false);
  const [marriageCertificateFile, setMarriageCertificateFile] = useState<File | null>(null);
  const [marriageCertificateUrl, setMarriageCertificateUrl] = useState<string | null>(null);
  const [marriageUploadProgress, setMarriageUploadProgress] = useState<number>(0);
  const [isMarriageUploading, setIsMarriageUploading] = useState<boolean>(false);
  const [contactEmail, setContactEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+20");
  const [contactPhone, setContactPhone] = useState("");
  const [source, setSource] = useState("");
  const [sourceSpecification, setSourceSpecification] = useState("");
  const [pricePerNight, setPricePerNight] = useState<number | "">("");
  const [commissionRate, setCommissionRate] = useState<number>(10.00);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit_card' | ''>('');
  const [cashCurrency, setCashCurrency] = useState<'USD' | 'AED' | 'SAR' | 'EGP' | ''>('');
  const [downloadingImage, setDownloadingImage] = useState(false);
  
  // Ref for downloadable summary
  const reservationSummaryRef = useRef<HTMLDivElement>(null);
  
  // Units data
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [reservedUnitIds, setReservedUnitIds] = useState<string[]>([]);
  const [blockedUnitIds, setBlockedUnitIds] = useState<string[]>([]);
  // Rate plan price lookup: booking_com_name -> weekday_rate
  const [ratePriceMap, setRatePriceMap] = useState<Map<string, number>>(new Map());
  // Extra adult rate lookup: booking_com_name -> extra_adult_rate
  const [extraAdultRateMap, setExtraAdultRateMap] = useState<Map<string, number>>(new Map());
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [bookedDates, setBookedDates] = useState<Date[]>([]);
  
  // Users for source selection
  const [userSources, setUserSources] = useState<string[]>([]);

  // Computed totals from per-room arrays
  const totalAdults = roomAdults.reduce((sum, a) => sum + a, 0);
  const totalChildren = roomChildren.reduce((sum, c) => sum + c, 0);
  const numberOfGuests = totalAdults + totalChildren;

  // Extract dates from range
  const checkInDate = dateRange?.from;
  const checkOutDate = dateRange?.to;

  // Calculate nights
  const nights = checkInDate && checkOutDate 
    ? differenceInDays(checkOutDate, checkInDate) 
    : 0;

  // Sync selectedUnitIds, roomAdults, roomChildren array sizes with numberOfRooms
  useEffect(() => {
    setSelectedUnitIds(Array(numberOfRooms).fill("").map((_, i) => selectedUnitIds[i] || ""));
    setRoomPrices(Array(numberOfRooms).fill("").map((_, i) => roomPrices[i] || ""));
    setRoomAdults(Array(numberOfRooms).fill(1).map((_, i) => roomAdults[i] ?? 1));
    setRoomChildren(Array(numberOfRooms).fill(0).map((_, i) => roomChildren[i] ?? 0));
  }, [numberOfRooms]);

  // Get selected unit for tax calculation (use first room for tax percentage)
  const selectedUnitData = availableUnits.find(u => u.id === selectedUnitIds[0]);
  const taxPercentage = selectedUnitData?.tax_percentage || 14;

  // Update room number when unit changes (legacy support for single room)
  useEffect(() => {
    if (numberOfRooms === 1 && selectedUnitIds[0]) {
      const unit = availableUnits.find(u => u.id === selectedUnitIds[0]);
      setUnitId(selectedUnitIds[0]);
      setRoomNumber(unit?.unit_number || '');
    } else {
      setUnitId("");
      setRoomNumber('');
    }
  }, [selectedUnitIds, numberOfRooms, availableUnits]);

  // Calculate subtotal (before tax) for all rooms
  const subtotal = nights > 0
    ? selectedUnitIds.reduce((total, unitId, index) => {
        const price = roomPrices[index];
        if (price && unitId) {
          return total + (Number(price) * nights);
        }
        return total;
      }, 0)
    : 0;

  // Calculate tax amount
  const taxAmount = subtotal * (taxPercentage / 100);

  // Calculate total price (including tax)
  const totalPrice = subtotal + taxAmount;

  // Auto-set commission rate based on source
  useEffect(() => {
    if (source.toLowerCase().includes('booking')) {
      setCommissionRate(17.4);
    } else {
      setCommissionRate(10.0);
    }
  }, [source]);

  // Handle download summary as image
  const handleDownloadSummary = async () => {
    if (!reservationSummaryRef.current) return;
    
    setDownloadingImage(true);
    try {
      const dataUrl = await toPng(reservationSummaryRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      const guestName = guestFirstNames[0] || 'guest';
      const checkIn = checkInDate ? format(checkInDate, 'yyyy-MM-dd') : 'pending';
      link.download = `reservation-${guestName}-${checkIn}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Reservation summary downloaded');
    } catch (error) {
      console.error('Error downloading summary:', error);
      toast.error('Failed to download summary');
    } finally {
      setDownloadingImage(false);
    }
  };

  // Arab nationalities that require marriage certificate
  const ARAB_NATIONALITIES = [
    "Egypt", "Saudi Arabia", "United Arab Emirates", "Kuwait", "Qatar", "Bahrain", "Oman", 
    "Yemen", "Jordan", "Lebanon", "Syria", "Iraq", "Palestine", 
    "Libya", "Tunisia", "Algeria", "Morocco", "Sudan", "Somalia", 
    "Djibouti", "Mauritania", "Comoros"
  ];

  // Marriage certificate auto-detection disabled — with only 1 guest form we can't detect male+female pairs
  const isMarriageCertificateRequired = () => {
    return false;
  };

  // Fetch booked dates for calendar display
  useEffect(() => {
    const fetchBookedDates = async () => {
      try {
        const { data: reservations, error } = await supabase
          .from("reservations")
          .select("check_in_date, check_out_date, unit_id")
          .eq("status", "confirmed");

        if (error) throw error;

        const { data: allUnitsData } = await supabase
          .from("units")
          .select("id")
          .eq("status", "available");

        const totalUnits = allUnitsData?.length || 0;
        if (totalUnits === 0) return;

        const dateBookings = new Map<string, Set<string>>();
        
        reservations?.forEach(res => {
          const start = new Date(res.check_in_date);
          const end = new Date(res.check_out_date);
          
          for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            if (!dateBookings.has(dateStr)) {
              dateBookings.set(dateStr, new Set());
            }
            dateBookings.get(dateStr)?.add(res.unit_id);
          }
        });

        const fullyBookedDates: Date[] = [];
        dateBookings.forEach((unitIds, dateStr) => {
          if (unitIds.size >= totalUnits) {
            fullyBookedDates.push(new Date(dateStr));
          }
        });

        setBookedDates(fullyBookedDates);
      } catch (error: any) {
        console.error("Error fetching booked dates:", error);
      }
    };

    fetchBookedDates();
  }, []);

  // Check if a date range contains any fully booked dates
  const isRangeValid = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) return true;
    
    const start = new Date(range.from);
    const end = new Date(range.to);
    
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const isBlocked = bookedDates.some(bookedDate => 
        format(bookedDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')
      );
      if (isBlocked) return false;
    }
    return true;
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (isRangeValid(range)) {
      setDateRange(range);
      if (isMobile && range?.from && range?.to) {
        setDatePickerOpen(false);
      }
    } else {
      toast.error("Selected date range contains fully booked dates. Please select different dates.");
    }
  };

  // Fetch all units, users, and rate plan prices on mount
  useEffect(() => {
    fetchUnits();
    fetchUsers();
    fetchRatePlanPrices();

    const profilesChannel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
    };
  }, []);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .order("full_name");

    if (error) {
      console.error("Error fetching users:", error);
      return;
    }

    const names = data?.map(profile => profile.full_name).filter(name => name) || [];
    setUserSources(names);
  };

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
      .select("id, name, unit_number, unit_type, booking_com_name, price_per_night, weekend_rate, tax_percentage, location, default_occupancy, max_guests")
      .eq("location", "ICONIA")
      .order("name");

    if (error) {
      console.error("Error fetching units:", error);
      toast.error("Failed to load units");
      return;
    }

    setAllUnits(data || []);
    setAvailableUnits(data || []);
  };

  const fetchRatePlanPrices = async () => {
    const { data: ratePlans, error } = await supabase
      .from('rate_plans')
      .select('id, name, is_default, room_type, extra_adult_rate, rate_plan_prices(room_type, weekday_rate, unit_id)')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching rate plan prices:', error);
      return;
    }

    const priceMap = new Map<string, number>();
    const extraRateMap = new Map<string, number>();
    for (const rp of ratePlans || []) {
      const prices = (rp as any).rate_plan_prices || [];
      const roomType = rp.room_type as string | null;
      
      // Build extra adult rate map from rate plan
      if (roomType && rp.extra_adult_rate != null) {
        if (!extraRateMap.has(roomType) || rp.is_default) {
          extraRateMap.set(roomType, Number(rp.extra_adult_rate));
        }
      }
      
      for (const p of prices) {
        if (p.unit_id) continue;
        const rt = p.room_type as string;
        if (!priceMap.has(rt)) {
          priceMap.set(rt, Number(p.weekday_rate));
        } else if (rp.is_default) {
          priceMap.set(rt, Number(p.weekday_rate));
        }
      }
    }
    setRatePriceMap(priceMap);
    setExtraAdultRateMap(extraRateMap);
  };

  const checkUnitAvailability = async () => {
    if (!checkInDate || !checkOutDate) return;

    setCheckingAvailability(true);
    const checkIn = format(checkInDate, "yyyy-MM-dd");
    const checkOut = format(checkOutDate, "yyyy-MM-dd");

    const { data: conflictingReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select("unit_id")
      .or(`and(check_in_date.lt.${checkOut},check_out_date.gt.${checkIn})`)
      .eq("status", "confirmed");

    if (reservationsError) {
      console.error("Error checking reservations:", reservationsError);
      toast.error("Failed to check room availability");
      setCheckingAvailability(false);
      return;
    }

    const { data: blockedUnitsData, error: blockedError } = await supabase
      .from("blocked_dates")
      .select("unit_id")
      .gte("blocked_date", checkIn)
      .lt("blocked_date", checkOut);

    if (blockedError) {
      console.error("Error checking blocked dates:", blockedError);
      toast.error("Failed to check blocked dates");
      setCheckingAvailability(false);
      return;
    }

    const reserved = [...new Set(conflictingReservations?.map((r) => r.unit_id).filter(Boolean) || [])] as string[];
    const blocked = [...new Set(blockedUnitsData?.map((b) => b.unit_id).filter(Boolean) || [])] as string[];
    
    setReservedUnitIds(reserved);
    setBlockedUnitIds(blocked);

    const unavailableUnitIds = [...new Set([...reserved, ...blocked])];
    const available = allUnits.filter((unit) => !unavailableUnitIds.includes(unit.id));
    
    setAvailableUnits(available);
    
    const newSelectedUnitIds = selectedUnitIds.map(id => 
      unavailableUnitIds.includes(id) ? "" : id
    );
    if (JSON.stringify(newSelectedUnitIds) !== JSON.stringify(selectedUnitIds)) {
      setSelectedUnitIds(newSelectedUnitIds);
    }
    
    setCheckingAvailability(false);
  };

  const getUnitUnavailabilityReason = (unitId: string): 'reserved' | 'blocked' | null => {
    if (reservedUnitIds.includes(unitId)) return 'reserved';
    if (blockedUnitIds.includes(unitId)) return 'blocked';
    return null;
  };

  const updateGuestFirstName = (index: number, value: string) => {
    const newGuestFirstNames = [...guestFirstNames];
    newGuestFirstNames[index] = value;
    setGuestFirstNames(newGuestFirstNames);
  };

  const updateGuestLastName = (index: number, value: string) => {
    const newGuestLastNames = [...guestLastNames];
    newGuestLastNames[index] = value;
    setGuestLastNames(newGuestLastNames);
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

  // Helper: get base rate for a room (from rate plan or unit fallback)
  const getBaseRateForUnit = (unit: Unit): number | null => {
    const ratePlanPrice = unit.booking_com_name ? ratePriceMap.get(unit.booking_com_name) : null;
    return ratePlanPrice ?? unit.price_per_night ?? null;
  };

  // Helper: get extra adult rate for a unit
  const getExtraAdultRateForUnit = (unit: Unit): number => {
    if (!unit.booking_com_name) return 0;
    return extraAdultRateMap.get(unit.booking_com_name) ?? 0;
  };

  // Helper: calculate occupancy surcharge for a room
  const getOccupancySurcharge = (roomIndex: number): number => {
    const unitId = selectedUnitIds[roomIndex];
    if (!unitId) return 0;
    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) return 0;
    const defaultOcc = unit.default_occupancy ?? 2;
    const adults = roomAdults[roomIndex] ?? 1;
    const extraAdults = Math.max(0, adults - defaultOcc);
    if (extraAdults <= 0) return 0;
    return extraAdults * getExtraAdultRateForUnit(unit);
  };

  // Helper: get the number of extra adults for a room
  const getExtraAdultsCount = (roomIndex: number): number => {
    const unitId = selectedUnitIds[roomIndex];
    if (!unitId) return 0;
    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) return 0;
    const defaultOcc = unit.default_occupancy ?? 2;
    return Math.max(0, (roomAdults[roomIndex] ?? 1) - defaultOcc);
  };

  const updateRoomSelection = (roomIndex: number, unitId: string) => {
    const newSelectedUnitIds = [...selectedUnitIds];
    newSelectedUnitIds[roomIndex] = unitId;
    setSelectedUnitIds(newSelectedUnitIds);
    
    // Auto-fill price from rate plan (preferred) or unit data (fallback), plus occupancy surcharge
    const unit = allUnits.find(u => u.id === unitId);
    if (unit) {
      const baseRate = getBaseRateForUnit(unit);
      const defaultOcc = unit.default_occupancy ?? 2;
      const adults = roomAdults[roomIndex] ?? 1;
      const extraAdults = Math.max(0, adults - defaultOcc);
      const surcharge = extraAdults * getExtraAdultRateForUnit(unit);
      const price = baseRate ? baseRate + surcharge : null;
      if (price) {
        const newRoomPrices = [...roomPrices];
        newRoomPrices[roomIndex] = price;
        setRoomPrices(newRoomPrices);
      }
    }
  };

  const updateRoomAdults = (roomIndex: number, adults: number) => {
    const newRoomAdults = [...roomAdults];
    newRoomAdults[roomIndex] = adults;
    setRoomAdults(newRoomAdults);
    
    // Recalculate price when adults change
    const unitId = selectedUnitIds[roomIndex];
    if (!unitId) return;
    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) return;
    
    const baseRate = getBaseRateForUnit(unit);
    if (baseRate == null) return;
    
    const defaultOcc = unit.default_occupancy ?? 2;
    const extraAdults = Math.max(0, adults - defaultOcc);
    const surcharge = extraAdults * getExtraAdultRateForUnit(unit);
    const newPrice = baseRate + surcharge;
    
    const newRoomPrices = [...roomPrices];
    newRoomPrices[roomIndex] = newPrice;
    setRoomPrices(newRoomPrices);
  };

  const updateRoomChildrenCount = (roomIndex: number, childCount: number) => {
    const newRoomChildren = [...roomChildren];
    newRoomChildren[roomIndex] = childCount;
    setRoomChildren(newRoomChildren);
  };

  const updateRoomPrice = (roomIndex: number, price: number | "") => {
    const newRoomPrices = [...roomPrices];
    newRoomPrices[roomIndex] = price;
    setRoomPrices(newRoomPrices);
  };

  // Helper to get minimum price for a room (base rate + occupancy surcharge)
  const getMinPriceForRoom = (roomIndex: number): number | null => {
    const unitId = selectedUnitIds[roomIndex];
    if (!unitId) return null;
    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) return null;
    const baseRate = getBaseRateForUnit(unit);
    if (baseRate == null) return null;
    return baseRate + getOccupancySurcharge(roomIndex);
  };

  // Check if room price is valid (>= minimum, unless admin)
  const isRoomPriceValid = (roomIndex: number): boolean => {
    if (userRole === 'admin') return true;
    
    const price = roomPrices[roomIndex];
    const minPrice = getMinPriceForRoom(roomIndex);
    if (minPrice === null || price === "") return true;
    return Number(price) >= minPrice;
  };

  const handleIdPassportUpload = async (file: File, isBack: boolean = false) => {
    if (isBack) {
      setIdPassportFileBack(file);
      setIsIdUploadingBack(true);
      setIdUploadProgressBack(0);
    } else {
      setIdPassportFile(file);
      setIsIdUploading(true);
      setIdUploadProgress(0);
    }
    
    const progressInterval = setInterval(() => {
      if (isBack) {
        setIdUploadProgressBack(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      } else {
        setIdUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }
    }, 100);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-passports')
        .upload(filePath, file);

      clearInterval(progressInterval);
      if (isBack) {
        setIdUploadProgressBack(100);
      } else {
        setIdUploadProgress(100);
      }

      if (uploadError) {
        console.error('Error uploading ID/Passport:', uploadError);
        toast.error('Failed to upload ID/Passport');
        if (isBack) {
          setIdPassportFileBack(null);
          setIsIdUploadingBack(false);
          setIdUploadProgressBack(0);
        } else {
          setIdPassportFile(null);
          setIsIdUploading(false);
          setIdUploadProgress(0);
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('id-passports')
        .getPublicUrl(filePath);
      
      if (isBack) {
        setIdPassportUrlBack(publicUrl);
      } else {
        setIdPassportUrl(publicUrl);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      if (isBack) {
        setIsIdUploadingBack(false);
        setIdUploadProgressBack(0);
      } else {
        setIsIdUploading(false);
        setIdUploadProgress(0);
      }
      toast.success(`ID/Passport ${isBack ? 'back' : 'front'} uploaded successfully`);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Upload error:', error);
      toast.error('Failed to upload ID/Passport');
      if (isBack) {
        setIdPassportFileBack(null);
        setIsIdUploadingBack(false);
        setIdUploadProgressBack(0);
      } else {
        setIdPassportFile(null);
        setIsIdUploading(false);
        setIdUploadProgress(0);
      }
    }
  };

  const handleIdPassportDelete = (isBack: boolean = false) => {
    if (isBack) {
      setIdPassportFileBack(null);
      setIdPassportUrlBack(null);
      setIdUploadProgressBack(0);
      setIsIdUploadingBack(false);
      const input = document.getElementById('idPassportBack') as HTMLInputElement;
      if (input) input.value = '';
    } else {
      setIdPassportFile(null);
      setIdPassportUrl(null);
      setIdUploadProgress(0);
      setIsIdUploading(false);
      const input = document.getElementById('idPassport') as HTMLInputElement;
      if (input) input.value = '';
    }
  };

  const handleMarriageCertificateUpload = async (file: File) => {
    setMarriageCertificateFile(file);
    setIsMarriageUploading(true);
    setMarriageUploadProgress(0);
    
    const progressInterval = setInterval(() => {
      setMarriageUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('marriage-certificates')
        .upload(filePath, file);

      clearInterval(progressInterval);
      setMarriageUploadProgress(100);

      if (uploadError) {
        console.error('Error uploading marriage certificate:', uploadError);
        toast.error('Failed to upload marriage certificate');
        setMarriageCertificateFile(null);
        setIsMarriageUploading(false);
        setMarriageUploadProgress(0);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('marriage-certificates')
        .getPublicUrl(filePath);
      
      setMarriageCertificateUrl(publicUrl);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsMarriageUploading(false);
      setMarriageUploadProgress(0);
      toast.success('Marriage certificate uploaded successfully');
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Upload error:', error);
      toast.error('Failed to upload marriage certificate');
      setMarriageCertificateFile(null);
      setIsMarriageUploading(false);
      setMarriageUploadProgress(0);
    }
  };

  const handleMarriageCertificateDelete = () => {
    setMarriageCertificateFile(null);
    setMarriageCertificateUrl(null);
    setMarriageUploadProgress(0);
    setIsMarriageUploading(false);
    const input = document.getElementById('marriage-certificate') as HTMLInputElement;
    if (input) input.value = '';
  };

  const validateForm = () => {
    const missingFields: string[] = [];
    
    if (!checkInDate) {
      missingFields.push("Check-in date");
    }
    if (!checkOutDate) {
      missingFields.push("Check-out date");
    }
    if (checkInDate && isBefore(startOfDay(checkInDate), startOfDay(new Date()))) {
      toast.error("Check-in date cannot be in the past");
      return false;
    }
    if (checkInDate && checkOutDate && !isAfter(checkOutDate, checkInDate)) {
      toast.error("Check-out date must be after check-in date");
      return false;
    }
    
    // Room selection
    const emptyRoomSelections = selectedUnitIds.filter(id => !id).length;
    if (emptyRoomSelections > 0) {
      missingFields.push(`Room selection (${emptyRoomSelections} room${emptyRoomSelections > 1 ? 's' : ''} not selected)`);
    }
    
    const uniqueRooms = new Set(selectedUnitIds.filter(id => id));
    if (uniqueRooms.size < selectedUnitIds.filter(id => id).length) {
      toast.error("You cannot select the same room multiple times");
      return false;
    }
    
    // Price validation
    const emptyPrices = roomPrices.filter((price, index) => selectedUnitIds[index] && (!price || Number(price) <= 0)).length;
    if (emptyPrices > 0) {
      missingFields.push(`Price per night for all rooms (${emptyPrices} room${emptyPrices > 1 ? 's' : ''} missing price)`);
    }
    
    const hasNonIntegerPrice = roomPrices.some((price, index) => {
      return selectedUnitIds[index] && price && !Number.isInteger(Number(price));
    });
    if (hasNonIntegerPrice) {
      toast.error("All prices must be whole numbers");
      return false;
    }
    
    // Main guest validation
    if (!guestFirstNames[0]?.trim() || !guestLastNames[0]?.trim()) {
      missingFields.push("Main guest's first and last name");
    }
    
    // Main guest gender validation (if adult)
    if (guestTypes[0] === 'adult' && !guestGenders[0]) {
      missingFields.push("Gender selection for main guest");
    }
    
    // Nationality
    if (!nationality.trim()) {
      missingFields.push("Guest nationality");
    }
    
    // ID/Passport validation
    if (!idPassportFile) {
      missingFields.push(idPassportType === 'id' ? "ID front image" : "Passport image");
    }
    if (idPassportType === 'id' && !idPassportFileBack) {
      missingFields.push("ID back image");
    }
    
    // Contact information
    if (!contactEmail.trim()) {
      missingFields.push("Contact email");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      toast.error("Please enter a valid email address");
      return false;
    }
    
    if (!contactPhone.trim()) {
      missingFields.push("Contact phone number");
    }
    
    // Source
    if (!source) {
      missingFields.push("Booking source");
    }
    
    if (source === "Others" && !sourceSpecification.trim()) {
      missingFields.push("Source specification (when selecting Others)");
    }
    
    // Payment method
    if (!paymentMethod) {
      missingFields.push("Payment method");
    }
    
    if (paymentMethod === 'cash' && !cashCurrency) {
      missingFields.push("Currency (for cash payment)");
    }
    
    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(", ");
      toast.error(
        `Please complete the following required fields: ${fieldsList}`,
        {
          duration: 6000,
        }
      );
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!userRole || (userRole !== 'admin' && userRole !== 'manager')) {
      toast.error('You do not have permission to create reservations. Admin or Manager role required.');
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Only main guest
      const combinedNames = [`${guestFirstNames[0].trim()} ${guestLastNames[0]?.trim() || ''}`.trim()].filter(n => n);

      const finalSource = source === "Others" && sourceSpecification.trim()
        ? `Others - ${sourceSpecification.trim()}`
        : source;

      const groupId = numberOfRooms > 1 ? crypto.randomUUID() : null;
      
      const reservationPromises = selectedUnitIds.map(async (unitIdValue, roomIndex) => {
        if (!unitIdValue) return null;

        const priceForRoom = Number(roomPrices[roomIndex]);
        const subtotalForRoom = priceForRoom * nights;
        const taxAmountForRoom = subtotalForRoom * (taxPercentage / 100);
        const totalForRoomWithTax = subtotalForRoom + taxAmountForRoom;
        const netRevenue = totalForRoomWithTax / (1 + taxPercentage / 100);
        const commissionAmount = (netRevenue * commissionRate) / 100;

        const roomGuestCount = (roomAdults[roomIndex] ?? 1) + (roomChildren[roomIndex] ?? 0);

        const reservationData = {
          booking_reference: `MAN-${Date.now()}-${roomIndex + 1}`,
          check_in_date: format(checkInDate!, "yyyy-MM-dd"),
          check_out_date: format(checkOutDate!, "yyyy-MM-dd"),
          unit_id: unitIdValue,
          number_of_guests: roomGuestCount,
          adults: roomAdults[roomIndex] ?? 1,
          children: roomChildren[roomIndex] ?? 0,
          guest_names: combinedNames,
          guest_types: [guestTypes[0]].filter(Boolean),
          guest_genders: [guestGenders[0]].filter(Boolean),
          guest_nationality: nationality,
          marriage_certificate_url: marriageCertificateUrl || null,
          id_passport_url: idPassportUrl || null,
          id_passport_url_back: idPassportUrlBack || null,
          source: finalSource,
          status: "confirmed",
          channel: "Manual",
          price_per_night: priceForRoom,
          total_price: totalForRoomWithTax,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_revenue: netRevenue,
          currency: paymentMethod === 'credit_card' ? 'EGP' : (paymentMethod === 'cash' ? cashCurrency : 'USD'),
          payment_method: paymentMethod,
          contact_email: contactEmail,
          contact_phone: `${countryCode}${contactPhone}`,
          notes: notes || null,
          guest_ages: [],
          group_id: groupId,
        };

        const { data: insertedReservation, error } = await supabase
          .from("reservations")
          .insert([reservationData])
          .select()
          .single();

        if (error) throw error;
        return insertedReservation;
      });

      const insertedReservations = (await Promise.all(reservationPromises)).filter(Boolean);

      if (insertedReservations.length === 0) {
        throw new Error("Failed to create any reservations");
      }

      // Send email notification for each room
      for (const reservation of insertedReservations) {
        const selectedUnit = allUnits.find(u => u.id === reservation.unit_id);
        const unitName = selectedUnit ? `${selectedUnit.name} ${selectedUnit.unit_number || ''}`.trim() : 'Unit';
        const unitType = selectedUnit?.unit_type || '';

        const resIndex = insertedReservations.indexOf(reservation);
        const priceForRoom = Number(roomPrices[resIndex]);
        const subtotalForRoom = priceForRoom * nights;
        const taxAmountForRoom = subtotalForRoom * (taxPercentage / 100);

        try {
          await supabase.functions.invoke('send-reservation-notification', {
            body: {
              reservationId: reservation.id,
              guestNames: combinedNames,
              checkIn: format(checkInDate!, "yyyy-MM-dd"),
              checkOut: format(checkOutDate!, "yyyy-MM-dd"),
              unitName,
              unitId: reservation.unit_id,
              unitType,
              totalPrice: reservation.total_price,
              subtotal: subtotalForRoom,
              taxAmount: taxAmountForRoom,
              taxPercentage: taxPercentage,
              numberOfGuests: (roomAdults[resIndex] ?? 1) + (roomChildren[resIndex] ?? 0),
              adults: roomAdults[resIndex] ?? 1,
              children: roomChildren[resIndex] ?? 0,
              source,
              notes: notes || null,
              guestNationality: nationality || null,
              customerEmail: contactEmail || null,
              customerPhone: contactPhone ? `${countryCode}${contactPhone}` : null,
              isMultiRoom: numberOfRooms > 1,
              roomNumber: resIndex + 1,
              totalRooms: numberOfRooms,
            },
          });
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
        }
      }

      toast.success(
        numberOfRooms > 1 
          ? `${numberOfRooms} reservations created successfully!` 
          : "Reservation created successfully!"
      );
      
      // Reset form
      setDateRange(undefined);
      setNumberOfRooms(1);
      setSelectedUnitIds([""]);
      setRoomPrices([""]);
      setUnitId("");
      setRoomAdults([1]);
      setRoomChildren([0]);
      setGuestFirstNames([""]);
      setGuestLastNames([""]);
      setGuestTypes(["adult"]);
      setGuestGenders([""]);
      setNationality("");
      setIdPassportFile(null);
      setIdPassportUrl(null);
      setIdPassportFileBack(null);
      setIdPassportUrlBack(null);
      setIdPassportType('id');
      setMarriageCertificateFile(null);
      setMarriageCertificateUrl(null);
      setContactEmail("");
      setCountryCode("+20");
      setContactPhone("");
      setSource("");
      setSourceSpecification("");
      setPricePerNight("");
      setNotes("");
      setOpen(false);
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      
      if (error.code === '42501') {
        toast.error('You do not have permission to create reservations. Please contact an administrator.');
      } else if (error.code === '23505') {
        toast.error('A reservation with this booking reference already exists.');
      } else if (error.message?.includes('violates row-level security')) {
        toast.error('Permission denied. Your account may not have the required role to create reservations.');
      } else if (error.message?.includes('not found')) {
        toast.error('The selected unit was not found. Please refresh and try again.');
      } else if (error.details) {
        toast.error(`Error: ${error.message}. ${error.details}`);
      } else {
        toast.error(`Failed to create reservation: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = 
    checkInDate &&
    checkOutDate &&
    selectedUnitIds.every(id => id) &&
    numberOfGuests > 0 &&
    guestFirstNames[0]?.trim() !== "" &&
    guestLastNames[0]?.trim() !== "" &&
    nationality.trim() !== "" &&
    contactEmail.trim() !== "" &&
    contactPhone.trim() !== "" &&
    source &&
    (source !== "Others" || sourceSpecification.trim() !== "") &&
    roomPrices.every((price, index) => selectedUnitIds[index] ? price && Number(price) > 0 : true) &&
    selectedUnitIds.every((_, index) => isRoomPriceValid(index));

  const resetForm = () => {
    setDateRange(undefined);
    setUnitId("");
    setRoomAdults([1]);
    setRoomChildren([0]);
    setGuestFirstNames([""]);
    setGuestLastNames([""]);
    setGuestTypes(["adult"]);
    setGuestGenders([""]);
    setNationality("");
    setContactEmail("");
    setCountryCode("+20");
    setContactPhone("");
    setSource("");
    setSourceSpecification("");
    setPricePerNight("");
    setPaymentMethod('');
    setCashCurrency('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      resetForm();
    }
  };

  // Don't render if user doesn't have permission
  if (!canCreateBooking) {
    return null;
  }

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
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                    disabled={(date) => {
                      const isPast = date < startOfDay(new Date());
                      const isFullyBooked = bookedDates.some(
                        bookedDate => format(bookedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")
                      );
                      return isPast || isFullyBooked;
                    }}
                    className={cn("pointer-events-auto")}
                    modifiers={{
                      booked: bookedDates,
                    }}
                    modifiersClassNames={{
                      booked: "bg-white text-muted-foreground opacity-60 cursor-not-allowed",
                    }}
                  />
                  {!isMobile && (
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
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {nights > 0 && (
            <p className="text-sm text-muted-foreground">
              Total nights: <span className="font-semibold">{nights}</span>
            </p>
          )}

          {/* Number of Rooms */}
          <div className="space-y-2">
            <Label htmlFor="numberOfRooms">
              Number of Rooms <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={numberOfRooms.toString()} 
              onValueChange={(value) => setNumberOfRooms(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? 'Room' : 'Rooms'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room Selections - 2x2 grid: Room Name, Price, Adults, Children */}
          {Array.from({ length: numberOfRooms }).map((_, roomIndex) => {
            const selectedUnit = allUnits.find(u => u.id === selectedUnitIds[roomIndex]);
            const maxGuestsForRoom = selectedUnit?.max_guests ?? 4;
            const extraAdultsCount = getExtraAdultsCount(roomIndex);
            const surcharge = getOccupancySurcharge(roomIndex);
            const extraRate = selectedUnit ? getExtraAdultRateForUnit(selectedUnit) : 0;
            
            return (
              <div key={roomIndex} className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <h3 className="font-semibold text-sm">
                  Room {roomIndex + 1} {numberOfRooms > 1 && `of ${numberOfRooms}`}
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Row 1: Room Name */}
                  <div className="space-y-2">
                    <Label htmlFor={`unitId-${roomIndex}`}>
                      Room Name <span className="text-destructive">*</span>
                    </Label>
                    <Select 
                      value={selectedUnitIds[roomIndex]} 
                      onValueChange={(value) => updateRoomSelection(roomIndex, value)} 
                      disabled={checkingAvailability}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          checkingAvailability 
                            ? "Checking availability..." 
                            : !checkInDate || !checkOutDate
                            ? "Select dates first"
                            : availableUnits.length === 0
                            ? "No units available"
                            : "Select a room"
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUnits
                          .filter(unit => !selectedUnitIds.includes(unit.id) || unit.id === selectedUnitIds[roomIndex])
                          .map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}{unit.unit_type ? ` - ${unit.unit_type}` : ''} {unit.unit_number ? `(#${unit.unit_number})` : ''}
                            </SelectItem>
                          ))}
                        
                        {checkInDate && checkOutDate && allUnits
                          .filter(unit => !availableUnits.some(au => au.id === unit.id))
                          .map((unit) => {
                            const reason = getUnitUnavailabilityReason(unit.id);
                            return (
                              <SelectItem 
                                key={unit.id} 
                                value={unit.id} 
                                disabled
                                className="opacity-60"
                              >
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span>
                                    {unit.name}{unit.unit_type ? ` - ${unit.unit_type}` : ''} {unit.unit_number ? `(#${unit.unit_number})` : ''}
                                  </span>
                                  <span className={cn(
                                    "text-xs px-1.5 py-0.5 rounded-full font-medium ml-2",
                                    reason === 'reserved' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                    reason === 'blocked' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  )}>
                                    {reason === 'reserved' ? 'Reserved' : 'Blocked'}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 1: Price/Night */}
                  <div className="space-y-2">
                    <Label htmlFor={`roomPrice-${roomIndex}`}>
                      Price/Night (USD) <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id={`roomPrice-${roomIndex}`}
                      type="number"
                      value={roomPrices[roomIndex]}
                      onChange={(e) => updateRoomPrice(roomIndex, e.target.value ? Number(e.target.value) : "")}
                      placeholder="Enter price"
                      min={userRole === 'admin' ? 0 : (getMinPriceForRoom(roomIndex) || 0)}
                      step="1"
                      className={cn(!isRoomPriceValid(roomIndex) && userRole !== 'admin' && "border-destructive focus-visible:ring-destructive")}
                    />
                    {getMinPriceForRoom(roomIndex) !== null && (
                      <p className="text-xs text-muted-foreground">
                        Standard rate: ${getMinPriceForRoom(roomIndex)?.toFixed(2)}/night
                      </p>
                    )}
                    {surcharge > 0 && selectedUnit && (
                      <p className="text-xs text-muted-foreground">
                        Includes ${extraRate}/night extra guest fee ({extraAdultsCount} additional adult{extraAdultsCount > 1 ? 's' : ''})
                      </p>
                    )}
                    {!isRoomPriceValid(roomIndex) && userRole !== 'admin' && (
                      <p className="text-xs text-destructive">
                        Rate cannot be lower than the standard rate of ${getMinPriceForRoom(roomIndex)?.toFixed(2)}/night
                      </p>
                    )}
                  </div>

                  {/* Row 2: Adults */}
                  <div className="space-y-2">
                    <Label htmlFor={`roomAdults-${roomIndex}`} className="text-sm">
                      Adults
                    </Label>
                    <Select 
                      value={(roomAdults[roomIndex] ?? 1).toString()} 
                      onValueChange={(value) => updateRoomAdults(roomIndex, parseInt(value))}
                    >
                      <SelectTrigger id={`roomAdults-${roomIndex}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: maxGuestsForRoom }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? 'Adult' : 'Adults'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Row 2: Children */}
                  <div className="space-y-2">
                    <Label htmlFor={`roomChildren-${roomIndex}`} className="text-sm">
                      Children
                    </Label>
                    <Select 
                      value={(roomChildren[roomIndex] ?? 0).toString()} 
                      onValueChange={(value) => updateRoomChildrenCount(roomIndex, parseInt(value))}
                    >
                      <SelectTrigger id={`roomChildren-${roomIndex}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? 'Child' : 'Children'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Total Pricing Summary - Downloadable */}
          {subtotal > 0 && (
            <div className="space-y-3">
              <div ref={reservationSummaryRef} className="p-4 bg-muted/50 rounded-lg space-y-3">
                {/* Dates Section */}
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    {checkInDate && format(checkInDate, 'PPP')} — {checkOutDate && format(checkOutDate, 'PPP')}
                  </p>
                  <p className="text-xs text-muted-foreground">{nights} {nights === 1 ? 'night' : 'nights'}</p>
                </div>
                
                {/* Room(s) Info */}
                <div className="space-y-1 border-t pt-2">
                  {selectedUnitIds.map((unitId, index) => {
                    const unit = availableUnits.find(u => u.id === unitId);
                    if (!unit) return null;
                    return (
                      <p key={index} className="text-sm">
                        {numberOfRooms > 1 ? `Room ${index + 1}: ` : ''}{unit.name}{unit.unit_number ? ` (#${unit.unit_number})` : ''} — ${roomPrices[index]}/night · {roomAdults[index] ?? 1}A {roomChildren[index] ?? 0}C
                      </p>
                    );
                  })}
                </div>
                
                {/* Total guests */}
                <div className="text-xs text-muted-foreground border-t pt-2">
                  Total guests: {totalAdults} {totalAdults === 1 ? 'adult' : 'adults'}, {totalChildren} {totalChildren === 1 ? 'child' : 'children'}
                </div>
                
                {/* Pricing Breakdown */}
                <div className="space-y-1 border-t pt-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal ({numberOfRooms} {numberOfRooms === 1 ? 'room' : 'rooms'} × {nights} {nights === 1 ? 'night' : 'nights'}):</span>
                    <span className="font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax ({taxPercentage}%):</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Download Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSummary}
                disabled={!checkInDate || !checkOutDate || downloadingImage}
                className="w-full"
              >
                {downloadingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Summary
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Main Guest Details — always 1 guest form */}
          <div className="space-y-2">
            <Label>
              Main Guest Details <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2 p-3 border rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-sm">First Name</Label>
                  <Input
                    placeholder="First name"
                    value={guestFirstNames[0]}
                    onChange={(e) => updateGuestFirstName(0, e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm">Last Name</Label>
                  <Input
                    placeholder="Last name"
                    value={guestLastNames[0] || ''}
                    onChange={(e) => updateGuestLastName(0, e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Guest Type <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={guestTypes[0]}
                  onValueChange={(value) => updateGuestType(0, value as 'adult' | 'child')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="adult" id="adult-0" />
                    <Label htmlFor="adult-0" className="font-normal cursor-pointer">
                      Adult
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="child" id="child-0" />
                    <Label htmlFor="child-0" className="font-normal cursor-pointer">
                      Child
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              {guestTypes[0] === 'adult' && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <RadioGroup
                    value={guestGenders[0] || ""}
                    onValueChange={(value) => updateGuestGender(0, value as 'male' | 'female')}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="male-0" />
                      <Label htmlFor="male-0" className="font-normal cursor-pointer">
                        Male
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="female-0" />
                      <Label htmlFor="female-0" className="font-normal cursor-pointer">
                        Female
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Additional guests will provide their details at check-in
            </p>
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

          {/* ID/Passport Upload */}
          <div className="space-y-2">
            <Label htmlFor="idPassport">
              Upload ID/Passport <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={idPassportType}
              onValueChange={(value: 'id' | 'passport') => {
                setIdPassportType(value);
                if (value === 'passport') {
                  setIdPassportFileBack(null);
                  setIdPassportUrlBack(null);
                  setIdUploadProgressBack(0);
                  setIsIdUploadingBack(false);
                }
              }}
              className="flex gap-4 mb-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="id" id="type-id" />
                <Label htmlFor="type-id" className="font-normal cursor-pointer">
                  ID
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="passport" id="type-passport" />
                <Label htmlFor="type-passport" className="font-normal cursor-pointer">
                  Passport
                </Label>
              </div>
            </RadioGroup>
            
            {/* Front Image */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                {idPassportType === 'id' ? 'Front' : 'Image'}
              </Label>
              {idPassportFile ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-background rounded border">
                    <span className="text-sm flex-1 truncate">{idPassportFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleIdPassportDelete(false)}
                      className="hover:text-destructive"
                      disabled={isIdUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {isIdUploading && (
                    <div className="space-y-1">
                      <Progress value={idUploadProgress} className="h-2 [&>div]:bg-blue-500" />
                      <p className="text-xs text-muted-foreground text-center">{idUploadProgress}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="idPassport"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.startsWith('image/')) {
                          toast.error("Only image files are supported");
                          e.target.value = '';
                          return;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          toast.error('File size must be less than 10MB');
                          e.target.value = '';
                          return;
                        }
                        handleIdPassportUpload(file, false);
                      }
                    }}
                    className="hidden"
                  />
                  <Label
                    htmlFor="idPassport"
                    className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Label>
                </div>
              )}
            </div>

            {/* Back Image (only for ID) */}
            {idPassportType === 'id' && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Back <span className="text-destructive">*</span>
                </Label>
                {idPassportFileBack ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-background rounded border">
                      <span className="text-sm flex-1 truncate">{idPassportFileBack.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleIdPassportDelete(true)}
                        className="hover:text-destructive"
                        disabled={isIdUploadingBack}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {isIdUploadingBack && (
                      <div className="space-y-1">
                        <Progress value={idUploadProgressBack} className="h-2 [&>div]:bg-blue-500" />
                        <p className="text-xs text-muted-foreground text-center">{idUploadProgressBack}%</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      id="idPassportBack"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (!file.type.startsWith('image/')) {
                            toast.error("Only image files are supported");
                            e.target.value = '';
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error('File size must be less than 10MB');
                            e.target.value = '';
                            return;
                          }
                          handleIdPassportUpload(file, true);
                        }
                      }}
                      className="hidden"
                    />
                    <Label
                      htmlFor="idPassportBack"
                      className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Marriage Certificate Upload - Conditional (disabled since auto-detection no longer possible) */}
          {isMarriageCertificateRequired() && (
            <div className="space-y-2 p-4 border-2 border-amber-500 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Label htmlFor="marriage-certificate" className="text-base font-semibold">
                    Marriage Certificate <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Required for Arab couples (male + female adults)
                  </p>
                </div>
              </div>
              
              {marriageCertificateFile ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-background rounded border">
                    <span className="text-sm flex-1 truncate">{marriageCertificateFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleMarriageCertificateDelete}
                      className="hover:text-destructive"
                      disabled={isMarriageUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {isMarriageUploading && (
                    <div className="space-y-1">
                      <Progress value={marriageUploadProgress} className="h-2 [&>div]:bg-blue-500" />
                      <p className="text-xs text-muted-foreground text-center">{marriageUploadProgress}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="marriage-certificate"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
                        if (!validTypes.includes(file.type)) {
                          toast.error('Please upload a valid image (JPG, PNG, GIF, WEBP) or PDF file');
                          e.target.value = '';
                          return;
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          toast.error('File size must be less than 10MB');
                          e.target.value = '';
                          return;
                        }
                        handleMarriageCertificateUpload(file);
                      }
                    }}
                    className="flex-1"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          )}

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

          {/* Source */}
          <div className="space-y-2">
            <Label htmlFor="source">
              Source <span className="text-destructive">*</span>
            </Label>
            <Select value={source} onValueChange={(value) => {
              setSource(value);
              if (value !== "Others") {
                setSourceSpecification("");
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a source" />
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
          </div>

          {/* Source Specification for "Others" */}
          {source === "Others" && (
            <div className="space-y-2">
              <Label htmlFor="sourceSpecification">
                Pls Specify <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sourceSpecification"
                value={sourceSpecification}
                onChange={(e) => setSourceSpecification(e.target.value)}
                placeholder="Please specify the source"
              />
            </div>
          )}

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">
              Payment Method <span className="text-destructive">*</span>
            </Label>
            <Select value={paymentMethod} onValueChange={(value: 'cash' | 'credit_card') => {
              setPaymentMethod(value);
              if (value !== 'cash') {
                setCashCurrency('');
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Currency (only for Cash) */}
          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <Label htmlFor="cashCurrency">
                Currency <span className="text-destructive">*</span>
              </Label>
              <Select value={cashCurrency} onValueChange={(value: 'USD' | 'AED' | 'SAR' | 'EGP') => setCashCurrency(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">Dollars (USD)</SelectItem>
                  <SelectItem value="AED">Dirhams (AED)</SelectItem>
                  <SelectItem value="SAR">Riyals (SAR)</SelectItem>
                  <SelectItem value="EGP">Egyptian Pounds (EGP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Notes / Special Requests */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes / Special Requests</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requests or notes about this reservation..."
            rows={3}
          />
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronLeft, ChevronRight, Download, ArrowLeft, FileText, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isWithinInterval, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SlideMenu } from "@/components/SlideMenu";
import { downloadCheckInPDF } from "@/lib/generateCheckInPDF";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface CheckInAgreement {
  reservation_id: string;
  guest_full_name: string;
  guest_nationality: string | null;
  guest_date_of_birth: string | null;
  guest_phone: string;
  guest_email: string;
  signature_url: string;
  signed_at: string;
}

interface GuestRecord {
  reservationId: string;
  guestName: string;
  nationality: string | null;
  
  contactPhone: string | null;
  numberOfGuests: number;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  bookingReference: string;
  status: string;
  unitName: string | null;
  source: string;
  guestIndex: number;
}

const Guests = () => {
  const { userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<GuestRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [searchField, setSearchField] = useState<string>("all");
  const [checkInAgreements, setCheckInAgreements] = useState<Map<string, CheckInAgreement>>(new Map());
  const [guestFormFilter, setGuestFormFilter] = useState<string>("all");
  const [downloadingForm, setDownloadingForm] = useState<string | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<number>>(new Set());
  const [surveyLoading, setSurveyLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && userRole !== "admin") {
      navigate("/");
    }
  }, [userRole, authLoading, navigate]);

  useEffect(() => {
    fetchGuests();
    fetchCheckInAgreements();
  }, []);

  useEffect(() => {
    filterGuests();
  }, [searchQuery, guests, currentWeekStart, viewMode, selectedMonth, statusFilter, searchField, guestFormFilter, checkInAgreements]);

  const fetchCheckInAgreements = async () => {
    try {
      const { data, error } = await supabase
        .from('check_in_agreements')
        .select('reservation_id, guest_full_name, guest_nationality, guest_date_of_birth, guest_phone, guest_email, signature_url, signed_at');

      if (error) throw error;

      if (data) {
        const agreementsMap = new Map<string, CheckInAgreement>();
        data.forEach((agreement) => {
          agreementsMap.set(agreement.reservation_id, agreement as CheckInAgreement);
        });
        setCheckInAgreements(agreementsMap);
      }
    } catch (error) {
      console.error("Error fetching check-in agreements:", error);
    }
  };

  const fetchGuests = async () => {
    try {
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select(`
          *,
          units!unit_id (name)
        `)
        .order("check_in_date", { ascending: false });

      if (error) throw error;

      const guestRecords: GuestRecord[] = [];
      
      reservations?.forEach((reservation) => {
        reservation.guest_names?.forEach((guestName: string, index: number) => {
          guestRecords.push({
            reservationId: reservation.id,
            guestName,
            nationality: reservation.guest_nationality,
            
            contactPhone: reservation.contact_phone,
            numberOfGuests: reservation.number_of_guests,
            adults: reservation.adults || 1,
            children: reservation.children || 0,
            checkInDate: reservation.check_in_date,
            checkOutDate: reservation.check_out_date,
            bookingReference: reservation.booking_reference,
            status: reservation.status,
            unitName: reservation.units?.name || null,
            source: reservation.source,
            guestIndex: index,
          });
        });
      });

      setGuests(guestRecords);
      setFilteredGuests(guestRecords);
    } catch (error) {
      console.error("Error fetching guests:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterGuests = () => {
    let filtered = guests;

    if (viewMode === "week") {
      const weekEnd = addDays(currentWeekStart, 6);
      
      filtered = guests.filter((guest) => {
        const checkIn = new Date(guest.checkInDate);
        const checkOut = new Date(guest.checkOutDate);
        
        // Check if the reservation overlaps with the current week
        return isWithinInterval(currentWeekStart, { start: checkIn, end: checkOut }) ||
               isWithinInterval(weekEnd, { start: checkIn, end: checkOut }) ||
               isWithinInterval(checkIn, { start: currentWeekStart, end: weekEnd }) ||
               isWithinInterval(checkOut, { start: currentWeekStart, end: weekEnd });
      });
    } else {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      
      filtered = guests.filter((guest) => {
        const checkIn = new Date(guest.checkInDate);
        const checkOut = new Date(guest.checkOutDate);
        
        // Check if the reservation overlaps with the selected month
        return isWithinInterval(monthStart, { start: checkIn, end: checkOut }) ||
               isWithinInterval(monthEnd, { start: checkIn, end: checkOut }) ||
               isWithinInterval(checkIn, { start: monthStart, end: monthEnd }) ||
               isWithinInterval(checkOut, { start: monthStart, end: monthEnd });
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      
      if (searchField === "all") {
        filtered = filtered.filter(
          (guest) =>
            guest.guestName.toLowerCase().includes(query) ||
            guest.nationality?.toLowerCase().includes(query) ||
            guest.bookingReference.toLowerCase().includes(query)
        );
      } else if (searchField === "name") {
        filtered = filtered.filter((guest) =>
          guest.guestName.toLowerCase().includes(query)
        );
      } else if (searchField === "nationality") {
        filtered = filtered.filter((guest) =>
          guest.nationality?.toLowerCase().includes(query)
        );
      } else if (searchField === "booking") {
        filtered = filtered.filter((guest) =>
          guest.bookingReference.toLowerCase().includes(query)
        );
      }
    }

    if (statusFilter === "active") {
      filtered = filtered.filter((guest) => guest.status !== "cancelled");
    } else if (statusFilter !== "all") {
      filtered = filtered.filter((guest) => guest.status === statusFilter);
    }

    // Filter by guest form status
    if (guestFormFilter === "completed") {
      filtered = filtered.filter((guest) => checkInAgreements.has(guest.reservationId));
    } else if (guestFormFilter === "pending") {
      filtered = filtered.filter((guest) => !checkInAgreements.has(guest.reservationId));
    }
    
    setFilteredGuests(filtered);
  };

  const handleDownloadGuestForm = async (guest: GuestRecord) => {
    const agreement = checkInAgreements.get(guest.reservationId);
    if (!agreement) return;

    setDownloadingForm(guest.reservationId);
    try {
      await downloadCheckInPDF({
        guestName: agreement.guest_full_name,
        guestNationality: agreement.guest_nationality || '',
        guestDateOfBirth: agreement.guest_date_of_birth || '',
        guestPhone: agreement.guest_phone,
        guestEmail: agreement.guest_email,
        unitName: guest.unitName || 'N/A',
        checkInDate: guest.checkInDate,
        checkOutDate: guest.checkOutDate,
        signatureDataUrl: agreement.signature_url,
        signedAt: new Date(agreement.signed_at),
      }, `check-in-agreement-${guest.bookingReference}.pdf`);
      toast.success('Guest form downloaded');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download guest form');
    } finally {
      setDownloadingForm(null);
    }
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  };

  const navigatePreviousWeek = () => {
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const navigateNextWeek = () => {
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const navigatePreviousMonth = () => {
    setSelectedMonth(prev => subMonths(prev, 1));
  };

  const navigateNextMonth = () => {
    setSelectedMonth(prev => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  const weekDays = getWeekDays();
  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 0 }));
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
      pending: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
      cancelled: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
      "checked-in": "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
      "checked-out": "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
    };
    return colors[status] || "";
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const shouldHighlight = (field: string) => {
    return searchQuery.trim() && (searchField === "all" || searchField === field);
  };

  const exportToCSV = () => {
    // Prepare CSV headers
    const headers = [
      "Guest Name",
      "Type",
      "Nationality",
      "Email",
      "Phone",
      "Check-in",
      "Check-out",
      "Nights",
      "Unit",
      "Adults",
      "Children",
      "Total Guests",
      "Source",
      "Booking Reference",
      "Guest Form",
      "Status"
    ];

    // Prepare CSV rows
    const guestsToExport = selectedGuests.size > 0
      ? filteredGuests.filter((_, i) => selectedGuests.has(i))
      : filteredGuests;

    const rows = guestsToExport.map(guest => {
      const isAdult = guest.guestIndex < guest.adults;
      const checkIn = new Date(guest.checkInDate);
      const checkOut = new Date(guest.checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      
      return [
        guest.guestName,
        isAdult ? "Adult" : "Child",
        guest.nationality || "-",
        checkInAgreements.get(guest.reservationId)?.guest_email || "-",
        guest.contactPhone || "-",
        format(new Date(guest.checkInDate), "MMM dd, yyyy"),
        format(new Date(guest.checkOutDate), "MMM dd, yyyy"),
        nights.toString(),
        guest.unitName || "-",
        guest.adults.toString(),
        guest.children.toString(),
        guest.numberOfGuests.toString(),
        guest.source,
        guest.bookingReference,
        checkInAgreements.has(guest.reservationId) ? "Completed" : "Pending",
        guest.status
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `guests_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <SlideMenu userRole={userRole} />
              
              {/* Mobile back button - icon only */}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="md:hidden"
                size="icon"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              {/* Desktop back button with text */}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="hidden md:flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              
              <div>
                <h1 className="text-3xl font-bold">Guests</h1>
                {!isMobile && (
                  <p className="text-muted-foreground">All guest records from reservations</p>
                )}
              </div>
            </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                setSurveyLoading(true);
                try {
                  const { data, error } = await supabase.functions.invoke("send-checkout-surveys");
                  if (error) throw error;
                  toast.success(`Survey emails queued for ${data.reservationsFound} recent checkouts`);
                } catch (error: any) {
                  console.error("Error triggering surveys:", error);
                  toast.error(error.message || "Failed to trigger survey emails");
                } finally {
                  setSurveyLoading(false);
                }
              }}
              variant="outline"
              disabled={surveyLoading}
            >
              {surveyLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Surveys
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
              {selectedGuests.size > 0 && (
                <Badge variant="secondary" className="ml-2">{selectedGuests.size}</Badge>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <div className="mb-6 space-y-4">
            <div className={cn(
              "flex items-center gap-4",
              isMobile ? "flex-col items-stretch" : "justify-between"
            )}>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                >
                  Week
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                >
                  Month
                </Button>
              </div>

              {viewMode === "week" ? (
                <div className="flex items-center gap-2">
                  {!isCurrentWeek && (
                    <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
                      Today
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={navigatePreviousWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium text-center min-w-[200px]">
                    {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
                  </div>
                  <Button variant="outline" size="sm" onClick={navigateNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {!isCurrentMonth && (
                    <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
                      Today
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={navigatePreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-sm font-medium text-center min-w-[200px]">
                    {format(selectedMonth, 'MMMM yyyy')}
                  </div>
                  <Button variant="outline" size="sm" onClick={navigateNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <div className={cn(
              "flex gap-4",
              isMobile ? "flex-col" : ""
            )}>
              <div className={cn(
                "flex gap-2",
                isMobile ? "flex-col" : "flex-1"
              )}>
                <Select value={searchField} onValueChange={setSearchField}>
                  <SelectTrigger className={cn(isMobile ? "w-full" : "w-[160px]")}>
                    <SelectValue placeholder="Search by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Search by</SelectItem>
                    <SelectItem value="name">Guest Name</SelectItem>
                    <SelectItem value="nationality">Nationality</SelectItem>
                    <SelectItem value="booking">Booking Ref</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder={
                      searchField === "all" 
                        ? "name, nationality, or booking reference..." 
                        : searchField === "name"
                        ? "guest name..."
                        : searchField === "nationality"
                        ? "nationality..."
                        : "booking reference..."
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn(isMobile ? "w-full" : "w-[180px]")}>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="checked-in">Checked-in</SelectItem>
                  <SelectItem value="checked-out">Checked-out</SelectItem>
                </SelectContent>
              </Select>

              <Select value={guestFormFilter} onValueChange={setGuestFormFilter}>
                <SelectTrigger className={cn(isMobile ? "w-full" : "w-[180px]")}>
                  <SelectValue placeholder="Guest Forms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
                  <SelectItem value="completed">Form Completed</SelectItem>
                  <SelectItem value="pending">Form Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredGuests.length > 0 && selectedGuests.size === filteredGuests.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedGuests(new Set(filteredGuests.map((_, i) => i)));
                        } else {
                          setSelectedGuests(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Form Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Room Name</TableHead>
                  <TableHead>Total Guests</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Guest Form</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-muted-foreground">
                      No guests found for this {viewMode}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGuests.map((guest, index) => {
                    // Determine if this guest is an adult or child based on their position
                    const isAdult = guest.guestIndex < guest.adults;
                    const checkIn = new Date(guest.checkInDate);
                    const checkOut = new Date(guest.checkOutDate);
                    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <TableRow key={`${guest.bookingReference}-${index}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedGuests.has(index)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedGuests);
                              if (checked) { next.add(index); } else { next.delete(index); }
                              setSelectedGuests(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {shouldHighlight("name") 
                            ? highlightText(guest.guestName, searchQuery)
                            : guest.guestName
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={isAdult ? "default" : "secondary"} className="text-xs">
                            {isAdult ? "Adult" : "Child"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {guest.nationality 
                            ? shouldHighlight("nationality")
                              ? highlightText(guest.nationality, searchQuery)
                              : guest.nationality
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{checkInAgreements.get(guest.reservationId)?.guest_email || "-"}</TableCell>
                        <TableCell>{guest.contactPhone || "-"}</TableCell>
                        <TableCell>{format(new Date(guest.checkInDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell>{format(new Date(guest.checkOutDate), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="font-medium">{nights}</TableCell>
                        <TableCell>{guest.unitName || "-"}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {guest.adults} Adult{guest.adults !== 1 ? 's' : ''}, {guest.children} Child{guest.children !== 1 ? 'ren' : ''}
                          </div>
                        </TableCell>
                        <TableCell>{guest.source}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {shouldHighlight("booking")
                            ? highlightText(guest.bookingReference, searchQuery)
                            : guest.bookingReference
                          }
                        </TableCell>
                        <TableCell>
                          {checkInAgreements.has(guest.reservationId) ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadGuestForm(guest)}
                              disabled={downloadingForm === guest.reservationId}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                            >
                              {downloadingForm === guest.reservationId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <FileText className="h-4 w-4 mr-1" />
                                  <Download className="h-3 w-3" />
                                </>
                              )}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("capitalize", getStatusColor(guest.status))}>
                            {guest.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredGuests.length} of {guests.length} guests
          </div>
        </div>

      </div>
    </div>
  );
};

export default Guests;

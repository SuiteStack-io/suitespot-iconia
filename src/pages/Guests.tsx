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
import { Search, ArrowLeft, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isWithinInterval, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface GuestRecord {
  guestName: string;
  nationality: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  numberOfGuests: number;
  checkInDate: string;
  checkOutDate: string;
  bookingReference: string;
  status: string;
  unitName: string | null;
  source: string;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && userRole !== "admin") {
      navigate("/");
    }
  }, [userRole, authLoading, navigate]);

  useEffect(() => {
    fetchGuests();
  }, []);

  useEffect(() => {
    filterGuests();
  }, [searchQuery, guests, currentWeekStart, viewMode, selectedMonth, statusFilter]);

  const fetchGuests = async () => {
    try {
      const { data: reservations, error } = await supabase
        .from("reservations")
        .select(`
          *,
          units (name)
        `)
        .order("check_in_date", { ascending: false });

      if (error) throw error;

      const guestRecords: GuestRecord[] = [];
      
      reservations?.forEach((reservation) => {
        reservation.guest_names?.forEach((guestName: string) => {
          guestRecords.push({
            guestName,
            nationality: reservation.guest_nationality,
            contactEmail: reservation.contact_email,
            contactPhone: reservation.contact_phone,
            numberOfGuests: reservation.number_of_guests,
            checkInDate: reservation.check_in_date,
            checkOutDate: reservation.check_out_date,
            bookingReference: reservation.booking_reference,
            status: reservation.status,
            unitName: reservation.units?.name || null,
            source: reservation.source,
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
      filtered = filtered.filter(
        (guest) =>
          guest.guestName.toLowerCase().includes(query) ||
          guest.nationality?.toLowerCase().includes(query) ||
          guest.contactEmail?.toLowerCase().includes(query) ||
          guest.contactPhone?.toLowerCase().includes(query) ||
          guest.bookingReference.toLowerCase().includes(query) ||
          guest.source.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((guest) => guest.status === statusFilter);
    }
    
    setFilteredGuests(filtered);
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

  const exportToCSV = () => {
    // Prepare CSV headers
    const headers = [
      "Guest Name",
      "Nationality",
      "Email",
      "Phone",
      "Check-in",
      "Check-out",
      "Unit",
      "Number of Guests",
      "Source",
      "Booking Reference",
      "Status"
    ];

    // Prepare CSV rows
    const rows = filteredGuests.map(guest => [
      guest.guestName,
      guest.nationality || "-",
      guest.contactEmail || "-",
      guest.contactPhone || "-",
      format(new Date(guest.checkInDate), "MMM dd, yyyy"),
      format(new Date(guest.checkOutDate), "MMM dd, yyyy"),
      guest.unitName || "-",
      guest.numberOfGuests.toString(),
      guest.source,
      guest.bookingReference,
      guest.status
    ]);

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Guests</h1>
              {!isMobile && (
                <p className="text-muted-foreground">All guest records from reservations</p>
              )}
            </div>
          </div>
          
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
            
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name, email, phone, nationality, source, or booking reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="checked-in">Checked-in</SelectItem>
                  <SelectItem value="checked-out">Checked-out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Nationality</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground">
                      No guests found for this {viewMode}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGuests.map((guest, index) => (
                    <TableRow key={`${guest.bookingReference}-${index}`}>
                      <TableCell className="font-medium">{guest.guestName}</TableCell>
                      <TableCell>{guest.nationality || "-"}</TableCell>
                      <TableCell>{guest.contactEmail || "-"}</TableCell>
                      <TableCell>{guest.contactPhone || "-"}</TableCell>
                      <TableCell>{format(new Date(guest.checkInDate), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{format(new Date(guest.checkOutDate), "MMM dd, yyyy")}</TableCell>
                      <TableCell>{guest.unitName || "-"}</TableCell>
                      <TableCell>{guest.numberOfGuests}</TableCell>
                      <TableCell>{guest.source}</TableCell>
                      <TableCell className="font-mono text-sm">{guest.bookingReference}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(guest.status)}>
                          {guest.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
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

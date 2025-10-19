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
import { Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

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
}

const Guests = () => {
  const { userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<GuestRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

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
  }, [searchQuery, guests]);

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
    if (!searchQuery.trim()) {
      setFilteredGuests(guests);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = guests.filter(
      (guest) =>
        guest.guestName.toLowerCase().includes(query) ||
        guest.nationality?.toLowerCase().includes(query) ||
        guest.contactEmail?.toLowerCase().includes(query) ||
        guest.contactPhone?.toLowerCase().includes(query) ||
        guest.bookingReference.toLowerCase().includes(query)
    );
    setFilteredGuests(filtered);
  };

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
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Guests</h1>
            <p className="text-muted-foreground">All guest records from reservations</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, phone, nationality, or booking reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground">
                      No guests found
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

import { useEffect, useState } from "react";
import { useGuestAuth } from "@/lib/guestAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckoutCountdown } from "@/components/guest/CheckoutCountdown";
import { QuickActions } from "@/components/guest/QuickActions";
import { AmenitiesChecklist } from "@/components/guest/AmenitiesChecklist";
import { TicketSubmission } from "@/components/guest/TicketSubmission";
import TicketHistory from "@/components/guest/TicketHistory";
import NearbyMap from "@/components/guest/NearbyMap";

interface Reservation {
  id: string;
  check_in_date: string;
  check_out_date: string;
  guest_names: string[];
  unit_id: string;
  units: {
    id: string;
    name: string;
    address: string;
  } | null;
}

export default function GuestDashboard() {
  const { guestAccount } = useGuestAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReservation = async () => {
      if (!guestAccount?.reservation_id) return;

      const { data, error} = await supabase
        .from("reservations")
        .select(`
          id,
          unit_id,
          check_in_date,
          check_out_date,
          guest_names,
          units!unit_id (
            id,
            name,
            address
          )
        `)
        .eq("id", guestAccount.reservation_id)
        .single();

      if (error) {
        console.error("Error fetching reservation:", error);
      } else {
        setReservation(data);
      }
      setLoading(false);
    };

    fetchReservation();
  }, [guestAccount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Reservation Not Found</CardTitle>
            <CardDescription>
              We couldn't find your reservation details.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, {reservation.guest_names[0]}!
          </h1>
          <p className="text-muted-foreground">
            {reservation.units?.name} • {reservation.units?.address}
          </p>
        </div>

        <CheckoutCountdown checkoutDate={reservation.check_out_date} />

        <QuickActions unitId={reservation.units?.id || ""} />

        <div className="grid gap-6 md:grid-cols-2">
          <AmenitiesChecklist unitId={reservation.unit_id} />
          
          <TicketSubmission
            reservationId={reservation.id}
            guestAccountId={guestAccount?.id || ""}
            unitId={reservation.unit_id}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <NearbyMap unitId={reservation.unit_id} />
          <TicketHistory guestAccountId={guestAccount?.id || ""} />
        </div>
      </div>
    </div>
  );
}

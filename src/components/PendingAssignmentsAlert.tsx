import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingReservation {
  id: string;
  booking_reference: string;
  check_in_date: string;
  check_out_date: string;
  guest_names: string[];
  notes: string | null;
}

export const PendingAssignmentsAlert = () => {
  const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingAssignments();
    
    // Set up real-time subscription for new pending assignments
    const channel = supabase
      .channel('pending-assignments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: 'status=eq.pending_assignment',
        },
        () => {
          fetchPendingAssignments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingAssignments = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, booking_reference, check_in_date, check_out_date, guest_names, notes')
      .eq('status', 'pending_assignment')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending assignments:', error);
    } else {
      setPendingReservations(data || []);
    }
    setLoading(false);
  };

  if (loading || pendingReservations.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6 border-destructive bg-destructive/10">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold flex items-center gap-2">
        🚨 Over-Booking Conflicts Detected
        <Badge variant="destructive" className="ml-2">
          {pendingReservations.length}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm">
          The following reservations require manual unit assignment because all units were booked:
        </p>
        <div className="space-y-2">
          {pendingReservations.slice(0, 3).map((reservation) => (
            <div
              key={reservation.id}
              className="bg-background/50 rounded p-3 border border-destructive/20"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-sm">
                    Booking #{reservation.booking_reference}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Guest: {reservation.guest_names[0]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check-in: {new Date(reservation.check_in_date).toLocaleDateString()} → 
                    Check-out: {new Date(reservation.check_out_date).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/admin/reservation/${reservation.id}`)}
                  className="gap-2"
                >
                  Assign Unit
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          {pendingReservations.length > 3 && (
            <p className="text-xs text-muted-foreground mt-2">
              + {pendingReservations.length - 3} more pending assignments
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/calendar')}
          className="mt-2"
        >
          View All in Calendar
        </Button>
      </AlertDescription>
    </Alert>
  );
};

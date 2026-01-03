import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ConflictData {
  booking1_id: string;
  ref1: string;
  guests1: string[];
  checkin1: string;
  checkout1: string;
  booking2_id: string;
  ref2: string;
  guests2: string[];
  checkin2: string;
  checkout2: string;
  unit_name: string;
  unit_number: string;
}

export const ConflictAlert = () => {
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const checkForConflicts = async () => {
    try {
      // Query for overlapping bookings manually
      const { data: reservations } = await supabase
        .from('reservations')
        .select('*, units(name, unit_number)')
        .eq('status', 'confirmed')
        .is('cancelled_at', null)
        .order('check_in_date');
      
      if (reservations) {
        // Find overlaps manually
        const foundConflicts: ConflictData[] = [];
        for (let i = 0; i < reservations.length; i++) {
          for (let j = i + 1; j < reservations.length; j++) {
            const r1 = reservations[i];
            const r2 = reservations[j];
            
            if (r1.unit_id === r2.unit_id &&
                r1.check_in_date < r2.check_out_date &&
                r1.check_out_date > r2.check_in_date) {
              foundConflicts.push({
                booking1_id: r1.id,
                ref1: r1.booking_reference,
                guests1: r1.guest_names,
                checkin1: r1.check_in_date,
                checkout1: r1.check_out_date,
                booking2_id: r2.id,
                ref2: r2.booking_reference,
                guests2: r2.guest_names,
                checkin2: r2.check_in_date,
                checkout2: r2.check_out_date,
                unit_name: (r1.units as any)?.name || 'Unknown',
                unit_number: (r1.units as any)?.unit_number || 'N/A',
              });
            }
          }
        }
        setConflicts(foundConflicts);
      }
    } catch (err) {
      console.error('Error in conflict detection:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkForConflicts();

    // Set up realtime subscription for new reservations
    const channel = supabase
      .channel('reservation-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reservations'
      }, () => {
        checkForConflicts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || conflicts.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold">
        {conflicts.length} Double Booking{conflicts.length > 1 ? 's' : ''} Detected!
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          {conflicts.slice(0, 3).map((conflict, idx) => (
            <div key={idx} className="text-sm bg-destructive/10 p-3 rounded-md border border-destructive/20">
              <div className="font-semibold mb-1">
                Room {conflict.unit_number} ({conflict.unit_name})
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  • {conflict.guests1.join(', ')} ({conflict.ref1}) - {conflict.checkin1} to {conflict.checkout1}
                </div>
                <div>
                  • {conflict.guests2.join(', ')} ({conflict.ref2}) - {conflict.checkin2} to {conflict.checkout2}
                </div>
              </div>
            </div>
          ))}
          {conflicts.length > 3 && (
            <div className="text-sm text-muted-foreground">
              ...and {conflicts.length - 3} more conflict{conflicts.length - 3 > 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/calendar')}
            className="bg-background hover:bg-background/80"
          >
            View Calendar
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/rooms')}
            className="bg-background hover:bg-background/80"
          >
            Manage Rooms
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

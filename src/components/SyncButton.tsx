import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const SyncButton = () => {
  const [syncing, setSyncing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLastSync();
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const fetchLastSync = async () => {
    const { data } = await supabase
      .from('sync_status')
      .select('last_sync_at')
      .eq('sync_type', 'booking.com')
      .single();

    if (data?.last_sync_at) {
      setLastSync(new Date(data.last_sync_at));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-booking-gmail', {
        body: { trigger_type: 'manual' }
      });

      if (error) throw error;

      const bookingsCreated = data?.bookingsCreated || 0;
      const bookingsSkipped = data?.bookingsSkipped || 0;

      if (bookingsCreated > 0) {
        toast({
          title: "Sync Complete",
          description: `Created ${bookingsCreated} new booking${bookingsCreated > 1 ? 's' : ''}, skipped ${bookingsSkipped}`,
        });
      } else if (bookingsSkipped > 0) {
        toast({
          title: "Sync Complete",
          description: `No new bookings found (${bookingsSkipped} existing)`,
        });
      } else {
        toast({
          title: "Sync Complete",
          description: "No new bookings found",
        });
      }

      // Set 30 second cooldown
      setCooldown(30);
      setLastSync(new Date());
      fetchLastSync();
      
      // Refresh the page to show new bookings
      window.location.reload();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync bookings",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={syncing || cooldown > 0}
      variant="outline"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Sync Bookings'}
    </Button>
  );
};

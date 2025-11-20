import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { LogOut, CalendarDays, ChevronDown, DoorOpen, Home, Settings as SettingsIcon, RefreshCw, Upload, Ticket, BarChart3, Bell, Map, Image as ImageIcon } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const Index = () => {
  const { user, loading, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const { permission, requestPermission } = useNotifications();

  useEffect(() => {
    if (permission === "default") {
      // Request browser notification permission on first load
      requestPermission();
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-booking-gmail', { body: { trigger_type: 'manual' } });
      if (error) throw error;
      toast({ title: "Sync Complete", description: "Bookings synced successfully" });
      window.location.reload();
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading, navigate]);
  useEffect(() => { if (window.location.pathname === '/' && user) navigate('/admin'); }, [user, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>;
  if (!user) return null;

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-start justify-between">
          <div className={isMobile ? "flex flex-col items-center gap-2" : "flex items-center gap-3"}>
            <img src={suitespotLogo} alt="SuiteSpot Logo" className={isMobile ? "h-14 w-14" : "h-10 w-10"} />
            <div><h1 className="text-xl font-bold">SuiteSpot Reservations</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/homepage-management')}>
                  <Home className="h-4 w-4 mr-2" />
                  Content
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/booking-com-reservations')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Booking.com
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/guest-tickets')}>
                  <Ticket className="h-4 w-4 mr-2" />
                  Tickets
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Home className="h-4 w-4 mr-2" />Menu<ChevronDown className="h-4 w-4 ml-2" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/calendar')}>Calendar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/rooms')}>Rooms</DropdownMenuItem>
                {isAdmin && (<><DropdownMenuItem onClick={() => navigate('/users')}>Users</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/guests')}>Guests</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/ticket-analytics')}><BarChart3 className="h-4 w-4 mr-2" />Analytics</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/locations-management')}><Map className="h-4 w-4 mr-2" />Locations</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/media-library')}><ImageIcon className="h-4 w-4 mr-2" />Media Library</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem></>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}><RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />Sync</Button>
            <Button variant="outline" size="sm" onClick={() => signOut()}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto p-6 space-y-6">
        {permission !== "granted" && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between"><div className="flex items-center gap-3"><Bell className="h-5 w-5 text-yellow-600" /><p className="text-sm text-yellow-800">Enable notifications for ticket alerts</p></div><Button onClick={requestPermission} variant="outline" size="sm">Enable</Button></div>)}
        <Dashboard />
        <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-bold">Reservations</h2><CreateReservationDialog /></div>
        <ReservationsList />
        <WeeklyCalendar />
      </div>
    </div>
  );
};

export default Index;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { LogOut, CalendarDays, ChevronDown, DoorOpen, Home, Settings as SettingsIcon, RefreshCw, Upload, Ticket, BarChart3, Bell, Map, Image as ImageIcon, UserCircle, ArrowUp } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

const Index = () => {
  const { user, loading, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const { permission, requestPermission } = useNotifications();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (permission === "default") {
      // Request browser notification permission on first load
      requestPermission();
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading, navigate]);
  useEffect(() => { if (window.location.pathname === '/' && user) navigate('/admin'); }, [user, navigate]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="text-muted-foreground">Loading...</div></div>;
  if (!user) return null;

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-start justify-between">
          <div className={isMobile ? "flex flex-col items-center gap-2" : "flex items-center gap-3"}>
            <img src={suitespotLogo} alt="SuiteSpot Logo" className={isMobile ? "h-14 w-14" : "h-10 w-10"} />
            <div><h1 className="text-xl font-bold">SuiteSpot Reservations</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            {isAdmin && (
              <>
                {/* Desktop: horizontal layout */}
                <div className="hidden md:flex items-center gap-2">
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
                  <Button variant="outline" size="sm" onClick={() => navigate('/guest/login')}>
                    <UserCircle className="h-4 w-4 mr-2" />
                    Guest Login
                  </Button>
                </div>
                
                {/* Mobile: vertical layout - Content, Booking.com, Menu order */}
                <div className="md:hidden flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate('/homepage-management')} className="w-full">
                    <Home className="h-4 w-4 mr-2" />
                    Content
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate('/booking-com-reservations')} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Booking.com
                  </Button>
                  
                  {/* Menu dropdown on mobile - stacked below */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        <Home className="h-4 w-4 mr-2" />
                        Menu
                        <ChevronDown className="h-4 w-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate('/calendar')}>Calendar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/rooms')}>ICONIA Rooms</DropdownMenuItem>
                      {isAdmin && (
                        <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/almaza-bay')}>Almaza Bay</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/kyc-management')}>KYC Management</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/selection-sessions')}>Selection Sessions</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/session-audit-log')}>Session Audit Log</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/ticket-analytics')}>Analytics</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/guest-accounts')}>App Accounts</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/guests')}>Guests</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/locations-management')}>Locations</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/media-library')}>Media Library</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/users')}>Users</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate('/guest-tickets')}>Tickets</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/guest/login')}>Guest Login</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
            
            {/* Menu dropdown - desktop only */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden md:flex">
                  <Home className="h-4 w-4 mr-2" />
                  Menu
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/calendar')}>Calendar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/rooms')}>ICONIA Rooms</DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/almaza-bay')}>Almaza Bay</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/kyc-management')}>KYC Management</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/selection-sessions')}>Selection Sessions</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/session-audit-log')}>Session Audit Log</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/ticket-analytics')}>Analytics</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/guest-accounts')}>App Accounts</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/guests')}>Guests</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/locations-management')}>Locations</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/media-library')}>Media Library</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/users')}>Users</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/guest-tickets')} className="md:hidden">Tickets</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/guest/login')} className="md:hidden">Guest Login</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="hidden md:flex">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button variant="outline" size="sm" onClick={() => signOut()} className="hidden md:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
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
      
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 h-12 w-12 rounded-full shadow-lg z-50"
          size="icon"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};

export default Index;

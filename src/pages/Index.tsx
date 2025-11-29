import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, Bell, ArrowUp } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { SlideMenu } from '@/components/SlideMenu';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';

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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left side: Hamburger Menu + Logo */}
          <div className="flex items-center gap-3">
            <SlideMenu isAdmin={isAdmin} />
            <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10" />
            <h1 className="text-xl font-bold hidden sm:block">SuiteSpot Reservations</h1>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSync} 
              disabled={syncing} 
              className="hidden md:flex"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => signOut()} 
              className="hidden md:flex"
            >
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

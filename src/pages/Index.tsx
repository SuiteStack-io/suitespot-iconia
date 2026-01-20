import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { LogOut, RefreshCw, Bell, ArrowUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/NotificationBell';
import { SlideMenu } from '@/components/SlideMenu';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/hooks/useNotifications';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const Index = () => {
  const { user, loading, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const { permission, requestPermission } = useNotifications();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      if (!error && data?.full_name) {
        setUserName(data.full_name);
      }
    };
    
    fetchProfile();
  }, [user]);

  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatRole = (role: string | null) => {
    if (!role) return "";
    return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
  };

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left side: Hamburger Menu + Logo */}
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10" />
            <h1 className="text-xl sm:text-[28px] font-playfair font-bold tracking-normal">SuiteSpot Reservations</h1>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center gap-2">
            {/* User Profile Display */}
            <div className="flex items-center gap-2 mr-2">
              {/* Mobile: Dropdown menu */}
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Avatar className="h-9 w-9 bg-muted cursor-pointer">
                      <AvatarFallback className="text-sm font-medium text-muted-foreground">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5 text-sm font-medium">{userName}</div>
                    <div className="px-2 pb-2 text-xs text-muted-foreground">{formatRole(userRole)}</div>
                    <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Desktop: Avatar + Name */}
              <div className="hidden md:flex items-center gap-2">
                <Avatar className="h-9 w-9 bg-muted">
                  <AvatarFallback className="text-sm font-medium text-muted-foreground">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">{userName}</span>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {formatRole(userRole)}
                  </span>
                </div>
              </div>
            </div>

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

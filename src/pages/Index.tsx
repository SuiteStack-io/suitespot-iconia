import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { LogOut, CalendarDays, ChevronDown, Upload } from 'lucide-react';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { uploadLogoToStorage } from '@/utils/uploadLogo';
import { toast } from 'sonner';

const Index = () => {
  const { user, loading, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleUploadLogo = async () => {
    toast.loading('Uploading logo...');
    const result = await uploadLogoToStorage();
    if (result.success) {
      toast.success('Logo uploaded successfully!');
      console.log('Logo URL:', result.url);
    } else {
      toast.error('Failed to upload logo');
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-start justify-between">
          {/* Logo and title - horizontal on desktop, stacked on mobile */}
          <div className={isMobile ? "flex flex-col items-center gap-2" : "flex items-center gap-3"}>
            <img src={suitespotLogo} alt="SuiteSpot Logo" className={isMobile ? "h-14 w-14" : "h-10 w-10"} />
            <div className={isMobile ? "text-center" : ""}>
              <h1 className={isMobile ? "text-xl font-bold leading-tight" : "text-xl font-bold"}>
                {isMobile ? (
                  <>
                    <div>SuiteSpot</div>
                    <div>Reservations</div>
                  </>
                ) : (
                  'SuiteSpot Reservations'
                )}
              </h1>
              <p className="text-sm text-muted-foreground">Manage your bookings with ease</p>
            </div>
          </div>

          {/* Right side - user info and action buttons */}
          <div className={isMobile ? "flex flex-col items-end gap-2" : "flex items-center gap-2"}>
            {/* User info display with dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-sm font-medium">
                      {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {userRole || 'No role'}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-sm font-semibold text-accent">
                      {(() => {
                        const fullName = user.user_metadata?.full_name;
                        if (fullName) {
                          const names = fullName.split(' ');
                          if (names.length > 1) {
                            return (names[0][0] + names[names.length - 1][0]).toUpperCase();
                          }
                          return fullName.substring(0, 2).toUpperCase();
                        }
                        return (user.email || 'U').substring(0, 2).toUpperCase();
                      })()}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/my-reservations')}>
                  My Reservations
                </DropdownMenuItem>
                {userRole === 'admin' && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/users')}>
                      Users
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/guests')}>
                      Guests
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/analytics')}>
                      Analytics
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Action buttons - horizontal on desktop, stacked on mobile */}
            <div className={isMobile ? "flex flex-col gap-2 w-full" : "flex items-center gap-2"}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/calendar')} 
                className={isMobile ? "w-full justify-start" : ""}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                <span className={isMobile ? "" : "hidden md:inline"}>
                  {isMobile ? "Calendar" : "Calendar View"}
                </span>
                <span className={isMobile ? "hidden" : "md:hidden inline"}>Calendar</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => signOut()} 
                className={isMobile ? "w-full justify-start" : ""}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {userRole === 'admin' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm mb-2">One-time setup: Upload logo to storage for email notifications</p>
            <Button onClick={handleUploadLogo} size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Logo to Storage
            </Button>
          </div>
        )}
        
        <section>
          <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
          <Dashboard />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">{isMobile ? 'Reservations' : 'All Reservations'}</h2>
            <CreateReservationDialog />
          </div>
          <ReservationsList />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Weekly Calendar</h2>
          <WeeklyCalendar />
        </section>
      </main>
    </div>
  );
};

export default Index;

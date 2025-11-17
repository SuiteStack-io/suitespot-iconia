import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { LogOut, CalendarDays, ChevronDown, DoorOpen, Home, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { SyncButton } from '@/components/SyncButton';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const { user, loading, signOut, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Redirect to admin from root if logged in
  useEffect(() => {
    if (window.location.pathname === '/' && user) {
      navigate('/admin');
    }
  }, [user, navigate]);

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

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className={isMobile ? "container mx-auto px-4 py-4" : "container mx-auto px-4 py-4 flex items-start justify-between"}>
          {/* Logo and title - horizontal on desktop, stacked on mobile */}
          <div className={isMobile ? "flex items-center justify-between w-full mb-3" : "flex items-center gap-3"}>
            <div className="flex items-center gap-3">
              <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10" />
              <div>
                <h1 className="text-xl font-bold">
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

            {/* User dropdown on mobile - top right */}
            {isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20 hover:bg-accent/20 transition-colors cursor-pointer">
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
                      <DropdownMenuItem onClick={() => {
                        const syncButtons = document.querySelectorAll('button');
                        const syncButton = Array.from(syncButtons).find(btn => 
                          btn.textContent?.includes('Sync Bookings') || btn.textContent?.includes('Syncing')
                        );
                        if (syncButton && !syncButton.disabled) {
                          syncButton.click();
                        }
                      }}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Bookings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/users')}>
                        Users
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/guests')}>
                        Guests
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/analytics')}>
                        Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/settings')}>
                        <SettingsIcon className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Right side - desktop only user info and action buttons */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {/* Hidden sync button for programmatic access */}
              {isAdmin && (
                <div className="hidden">
                  <SyncButton />
                </div>
              )}
              
              {/* Navigation and Admin tools */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/homepage-management')}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Content
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/calendar')}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Calendar
                </Button>
                
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/rooms')}
                    >
                      <DoorOpen className="h-4 w-4 mr-2" />
                      Rooms
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/booking-com-reservations')}
                    >
                      <DoorOpen className="h-4 w-4 mr-2" />
                      Booking.com Import
                    </Button>
                    <NotificationCenter />
                  </>
                )}
              </div>
              
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
                      <DropdownMenuItem onClick={() => {
                        const syncButtons = document.querySelectorAll('button');
                        const syncButton = Array.from(syncButtons).find(btn => 
                          btn.textContent?.includes('Sync Bookings') || btn.textContent?.includes('Syncing')
                        );
                        if (syncButton && !syncButton.disabled) {
                          syncButton.click();
                        }
                      }}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sync Bookings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/users')}>
                        Users
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/guests')}>
                        Guests
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/analytics')}>
                        Analytics
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/settings')}>
                        <SettingsIcon className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Mobile action buttons */}
          {isMobile && (
            <div className="flex flex-col gap-2 w-full">
              {/* Hidden sync button for programmatic access */}
              {isAdmin && (
                <div className="hidden">
                  <SyncButton />
                </div>
              )}
              
              {isAdmin && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/booking-com-reservations')} 
                  className="w-full justify-start"
                >
                  <DoorOpen className="h-4 w-4 mr-2" />
                  Booking.com
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/calendar')} 
                className="w-full justify-start"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Calendar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => signOut()} 
                className="w-full justify-start"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
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

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { AddUserDialog } from '@/components/AddUserDialog';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { RevenueBySource } from '@/components/RevenueBySource';
import { Button } from '@/components/ui/button';
import { Hotel, LogOut, CalendarDays } from 'lucide-react';

const Index = () => {
  const { user, loading, signOut, userRole } = useAuth();
  const navigate = useNavigate();

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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Hotel className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SuiteSpot Reservations</h1>
              <p className="text-sm text-muted-foreground">Manage your bookings with ease</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* User info display */}
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/10 rounded-lg border border-accent/20">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {userRole || 'No role'}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-accent">
                  {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                </span>
              </div>
            </div>

            {/* Existing buttons */}
            <Button variant="outline" size="sm" onClick={() => navigate('/calendar')}>
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendar View
            </Button>
            {userRole === 'admin' && <AddUserDialog />}
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
          <Dashboard />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Revenue Analytics</h2>
          <RevenueBySource />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">All Reservations</h2>
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

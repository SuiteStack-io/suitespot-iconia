import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Dashboard } from '@/components/Dashboard';
import { ReservationsList } from '@/components/ReservationsList';
import { AddUserDialog } from '@/components/AddUserDialog';
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
          <div className="flex items-center gap-2">
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
          <h2 className="text-2xl font-bold mb-4">All Reservations</h2>
          <ReservationsList />
        </section>
      </main>
    </div>
  );
};

export default Index;

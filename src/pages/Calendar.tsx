import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { RoomCalendar } from '@/components/RoomCalendar';
import { BlockedDatesManager } from '@/components/BlockedDatesManager';
import { MobileCalendarView } from '@/components/MobileCalendarView';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { SlideMenu } from '@/components/SlideMenu';
import { ArrowLeft } from 'lucide-react';

const Calendar = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <SlideMenu isAdmin={userRole === 'admin'} />
          
          {/* Mobile back button - icon only */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="md:hidden"
            size="icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Desktop back button with text */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="hidden md:flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Room Calendar</h1>
            <p className="text-sm text-muted-foreground">View and manage room bookings</p>
          </div>
        </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {isMobile ? (
          <MobileCalendarView />
        ) : (
          <>
            <RoomCalendar />
            <BlockedDatesManager />
          </>
        )}
      </main>
    </div>
  );
};

export default Calendar;

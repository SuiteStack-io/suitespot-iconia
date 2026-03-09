import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { RoomCalendar } from '@/components/RoomCalendar';
import { BlockedDatesManager } from '@/components/BlockedDatesManager';
import { MobileCalendarView } from '@/components/MobileCalendarView';
import { useIsMobile } from '@/hooks/use-mobile';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BulkAvailabilityEditor, type PendingAvailability } from '@/components/pms/BulkAvailabilityEditor';

const PMSAvailability = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [pendingAvailability, setPendingAvailability] = useState<PendingAvailability[]>([]);

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
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="PMS" currentPage="Availability" />
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">Room Calendar</h1>
              <p className="text-sm text-muted-foreground">View and manage room bookings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="calendar">
          <TabsList className="mb-6">
            <TabsTrigger value="calendar">Room Calendar</TabsTrigger>
            <TabsTrigger value="bulk" className="flex items-center gap-2">
              Bulk Editor
              {pendingAvailability.length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {pendingAvailability.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-8">
            {isMobile ? (
              <MobileCalendarView />
            ) : (
              <>
                <RoomCalendar />
                <BlockedDatesManager />
              </>
            )}
          </TabsContent>

          <TabsContent value="bulk">
            <BulkAvailabilityEditor
              pendingAvailability={pendingAvailability}
              setPendingAvailability={setPendingAvailability}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PMSAvailability;

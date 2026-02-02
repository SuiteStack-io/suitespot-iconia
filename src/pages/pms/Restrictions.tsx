import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { Lock } from 'lucide-react';

const PMSRestrictions = () => {
  const { userRole } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Restrictions</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-6">
        <AdminBreadcrumb section="PMS" currentPage="Restrictions" />
        
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Lock className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Booking Restrictions</h2>
          <p className="text-muted-foreground max-w-md">
            Manage booking restrictions and rules. Set minimum stay requirements, closed to arrival/departure dates, and more.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PMSRestrictions;

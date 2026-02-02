import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { DollarSign } from 'lucide-react';

const PMSPrices = () => {
  const { userRole } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Prices</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-6">
        <AdminBreadcrumb section="PMS" currentPage="Prices" />
        
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <DollarSign className="h-12 w-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Price Management</h2>
          <p className="text-muted-foreground max-w-md">
            Configure pricing and rate plans. Set seasonal rates, special offers, and pricing rules.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PMSPrices;

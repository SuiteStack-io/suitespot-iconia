import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ReservationsList } from '@/components/ReservationsList';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SlideMenu } from '@/components/SlideMenu';

const ReservationsListPage = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <SlideMenu isAdmin={isAdmin} />
            
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
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">Reservations List</h1>
              <p className="text-muted-foreground">
                View and manage all reservations
              </p>
            </div>
            
            <CreateReservationDialog />
          </div>
        </div>

        <ReservationsList />
      </div>
    </div>
  );
};

export default ReservationsListPage;

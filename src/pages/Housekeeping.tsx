import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Checkbox } from '@/components/ui/checkbox';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';

interface CleaningRoom {
  id: string;
  unit_id: string;
  unit_number: string;
  unit_name: string;
  check_out_date: string;
  guest_names: string[];
  priority: 'urgent' | 'normal';
  status: 'pending' | 'in-progress' | 'completed';
}

const Housekeeping = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, userRole } = useAuth();
  const [rooms, setRooms] = useState<CleaningRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    
    fetchRoomsNeedingCleaning();
    
    // Real-time updates
    const channel = supabase
      .channel('housekeeping-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchRoomsNeedingCleaning();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loading, navigate]);

  const fetchRoomsNeedingCleaning = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    // Fetch rooms that were checked out today or yesterday
    const { data } = await supabase
      .from('reservations')
      .select('id, check_out_date, guest_names, units(id, name, unit_number)')
      .eq('status', 'checked-out')
      .gte('check_out_date', yesterday)
      .order('check_out_date', { ascending: false });

    if (data) {
      const cleaningRooms: CleaningRoom[] = data
        .filter(r => r.units)
        .map(r => ({
          id: r.id,
          unit_id: (r.units as any).id,
          unit_number: (r.units as any).unit_number || '',
          unit_name: (r.units as any).name || '',
          check_out_date: r.check_out_date,
          guest_names: r.guest_names,
          priority: r.check_out_date === today ? 'urgent' : 'normal',
          status: 'pending' as const,
        }));

      setRooms(cleaningRooms);
    }
  };

  const handleMarkCleaned = async (roomId: string) => {
    setUpdating(roomId);
    try {
      // In a real implementation, you'd update a housekeeping table
      // For now, we'll just show a success message
      toast({
        title: 'Success',
        description: 'Room marked as cleaned',
      });

      // Remove from list
      setRooms(rooms.filter(r => r.id !== roomId));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkMarkCleaned = async () => {
    if (selectedRooms.size === 0) return;
    
    setUpdating('bulk');
    try {
      toast({
        title: 'Success',
        description: `${selectedRooms.size} rooms marked as cleaned`,
      });

      // Remove from list
      setRooms(rooms.filter(r => !selectedRooms.has(r.id)));
      setSelectedRooms(new Set());
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  };

  const toggleRoomSelection = (id: string) => {
    const newSelection = new Set(selectedRooms);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRooms(newSelection);
  };

  const selectAllRooms = () => {
    if (selectedRooms.size === rooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(rooms.map(r => r.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const urgentRooms = rooms.filter(r => r.priority === 'urgent');
  const normalRooms = rooms.filter(r => r.priority === 'normal');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Housekeeping" />
          <div className="flex items-center gap-4 mt-4">
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
            
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-primary" />
                Housekeeping Dashboard
              </h1>
              <p className="text-muted-foreground">
                Rooms that need cleaning after checkout
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Bulk Actions */}
          {selectedRooms.size > 0 && (
            <Card className="bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="font-medium">{selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''} selected</p>
                <Button
                  onClick={handleBulkMarkCleaned}
                  disabled={updating === 'bulk'}
                  className="gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark as Cleaned
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Urgent - Today's Checkouts */}
          {urgentRooms.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span className="text-orange-600">Urgent - Today's Checkouts</span>
                    <Badge variant="destructive">{urgentRooms.length}</Badge>
                  </div>
                  {urgentRooms.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllRooms}
                    >
                      {selectedRooms.size === rooms.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {urgentRooms.map((room) => (
                  <Card key={room.id} className="bg-orange-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={selectedRooms.has(room.id)}
                            onCheckedChange={() => toggleRoomSelection(room.id)}
                          />
                          <div>
                            <p className="text-lg font-bold text-primary">
                              Room #{room.unit_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {room.unit_name}
                            </p>
                            <p className="text-sm">
                              Last guest: {room.guest_names[0]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Checked out: {format(new Date(room.check_out_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleMarkCleaned(room.id)}
                          disabled={updating === room.id}
                          size="sm"
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Cleaned
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Normal Priority */}
          {normalRooms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Recent Checkouts
                  <Badge variant="secondary">{normalRooms.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {normalRooms.map((room) => (
                  <Card key={room.id} className="bg-accent/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={selectedRooms.has(room.id)}
                            onCheckedChange={() => toggleRoomSelection(room.id)}
                          />
                          <div>
                            <p className="text-lg font-bold text-primary">
                              Room #{room.unit_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {room.unit_name}
                            </p>
                            <p className="text-sm">
                              Last guest: {room.guest_names[0]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Checked out: {format(new Date(room.check_out_date), 'MMM dd, yyyy')}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleMarkCleaned(room.id)}
                          disabled={updating === room.id}
                          size="sm"
                          variant="outline"
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Cleaned
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {rooms.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">All Clean!</p>
                <p className="text-muted-foreground">
                  No rooms need cleaning at the moment
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Housekeeping;

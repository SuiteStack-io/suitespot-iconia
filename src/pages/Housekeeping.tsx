import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Sparkles, AlertCircle, ArrowLeft, Clock, History, Filter, Users, Calendar, Bed, Mail } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Checkbox } from '@/components/ui/checkbox';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type FilterType = 'all' | 'urgent' | 'recent';

interface CleaningRoom {
  id: string;
  unit_id: string;
  unit_number: string;
  unit_name: string;
  check_out_date: string;
  guest_names: string[];
  priority: 'urgent' | 'normal';
  status: 'pending' | 'in-progress' | 'completed';
  estimated_cleaning_minutes?: number;
}

interface CleaningLog {
  id: string;
  unit_name: string;
  unit_number: string;
  cleaned_by_name: string;
  cleaning_completed_at: string;
  actual_duration_minutes: number | null;
  estimated_minutes: number;
  guest_names: string[];
}

interface OccupiedRoom {
  id: string;
  unit_id: string;
  unit_number: string;
  unit_name: string;
  guest_names: string[];
  number_of_guests: number;
  check_in_date: string;
  check_out_date: string;
  days_occupied: number;
  days_remaining: number;
  last_cleaned_date: string | null;
  next_cleaning_date: string;
  housekeeping_notes: string | null;
  estimated_cleaning_minutes?: number;
  needs_mid_stay_cleaning: boolean;
}

const Housekeeping = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, userRole } = useAuth();
  const [rooms, setRooms] = useState<CleaningRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [cleaningHistory, setCleaningHistory] = useState<CleaningLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [occupiedRooms, setOccupiedRooms] = useState<OccupiedRoom[]>([]);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checkout' | 'occupied'>('checkout');
  const [triggeringNotifications, setTriggeringNotifications] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    
    fetchRoomsNeedingCleaning();
    fetchCleaningHistory();
    fetchOccupiedRooms();
    
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
          fetchOccupiedRooms();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'housekeeping_logs',
        },
        () => {
          fetchCleaningHistory();
          fetchOccupiedRooms();
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
      .select('id, check_out_date, guest_names, units(id, name, unit_number, estimated_cleaning_minutes)')
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
          estimated_cleaning_minutes: (r.units as any).estimated_cleaning_minutes || 45,
        }));

      setRooms(cleaningRooms);
    }
  };

  const fetchCleaningHistory = async () => {
    const { data } = await supabase
      .from('housekeeping_logs')
      .select(`
        id,
        cleaning_completed_at,
        actual_duration_minutes,
        reservations(guest_names),
        units(name, unit_number, estimated_cleaning_minutes),
        profiles(full_name)
      `)
      .order('cleaning_completed_at', { ascending: false })
      .limit(20);

    if (data) {
      const logs: CleaningLog[] = data.map(log => ({
        id: log.id,
        unit_name: (log.units as any)?.name || 'Unknown',
        unit_number: (log.units as any)?.unit_number || '',
        cleaned_by_name: (log.profiles as any)?.full_name || 'Staff',
        cleaning_completed_at: log.cleaning_completed_at,
        actual_duration_minutes: log.actual_duration_minutes,
        estimated_minutes: (log.units as any)?.estimated_cleaning_minutes || 45,
        guest_names: (log.reservations as any)?.guest_names || [],
      }));
      setCleaningHistory(logs);
    }
  };

  const fetchOccupiedRooms = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Fetch checked-in reservations
    const { data } = await supabase
      .from('reservations')
      .select(`
        id,
        check_in_date,
        check_out_date,
        guest_names,
        number_of_guests,
        housekeeping_notes,
        units(id, name, unit_number, estimated_cleaning_minutes)
      `)
      .eq('status', 'checked-in')
      .order('check_in_date', { ascending: true });

    if (data) {
      // For each reservation, get the most recent cleaning log
      const occupiedRoomsPromises = data.map(async (r) => {
        const { data: lastCleaning } = await supabase
          .from('housekeeping_logs')
          .select('cleaning_completed_at')
          .eq('reservation_id', r.id)
          .order('cleaning_completed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const checkInDate = new Date(r.check_in_date);
        const checkOutDate = new Date(r.check_out_date);
        const todayDate = new Date(today);
        
        const daysOccupied = differenceInDays(todayDate, checkInDate) + 1;
        const daysRemaining = differenceInDays(checkOutDate, todayDate);
        
        // Next cleaning is on the 4th day (check-in + 3 days)
        const nextCleaningDate = format(addDays(checkInDate, 3), 'yyyy-MM-dd');
        const needsMidStayCleaning = daysOccupied >= 4 && !lastCleaning;

        return {
          id: r.id,
          unit_id: (r.units as any).id,
          unit_number: (r.units as any).unit_number || '',
          unit_name: (r.units as any).name || '',
          guest_names: r.guest_names,
          number_of_guests: r.number_of_guests,
          check_in_date: r.check_in_date,
          check_out_date: r.check_out_date,
          days_occupied: daysOccupied,
          days_remaining: daysRemaining,
          last_cleaned_date: lastCleaning?.cleaning_completed_at || null,
          next_cleaning_date: nextCleaningDate,
          housekeeping_notes: r.housekeeping_notes,
          estimated_cleaning_minutes: (r.units as any).estimated_cleaning_minutes || 45,
          needs_mid_stay_cleaning: needsMidStayCleaning,
        } as OccupiedRoom;
      });

      const occupiedRoomsData = await Promise.all(occupiedRoomsPromises);
      setOccupiedRooms(occupiedRoomsData.filter(r => r.unit_id));
    }
  };

  const handleUpdateNotes = async (reservationId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ housekeeping_notes: notes })
        .eq('id', reservationId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Housekeeping notes updated',
      });

      setEditingNotes(null);
      fetchOccupiedRooms();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMarkCleaned = async (roomId: string) => {
    setUpdating(roomId);
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      // Log the cleaning action with timestamp
      const { error } = await supabase
        .from('housekeeping_logs')
        .insert({
          reservation_id: roomId,
          unit_id: room.unit_id,
          cleaned_by: user?.id,
          cleaning_completed_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Room marked as cleaned and logged',
      });

      // Remove from list and refresh history
      setRooms(rooms.filter(r => r.id !== roomId));
      fetchCleaningHistory();
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
      const selectedRoomsList = rooms.filter(r => selectedRooms.has(r.id));
      
      // Log all cleaning actions
      const cleaningLogs = selectedRoomsList.map(room => ({
        reservation_id: room.id,
        unit_id: room.unit_id,
        cleaned_by: user?.id,
        cleaning_completed_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('housekeeping_logs')
        .insert(cleaningLogs);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${selectedRooms.size} rooms marked as cleaned and logged`,
      });

      // Remove from list and refresh history
      setRooms(rooms.filter(r => !selectedRooms.has(r.id)));
      setSelectedRooms(new Set());
      fetchCleaningHistory();
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

  const handleTriggerCleaningNotifications = async () => {
    setTriggeringNotifications(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mid-stay-cleaning-notifications');
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: data?.message || 'Cleaning notifications sent successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send cleaning notifications',
        variant: 'destructive',
      });
    } finally {
      setTriggeringNotifications(false);
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

  // Apply filters
  const getFilteredRooms = () => {
    switch (filter) {
      case 'urgent':
        return rooms.filter(r => r.priority === 'urgent');
      case 'recent':
        return rooms.filter(r => r.priority === 'normal');
      default:
        return rooms;
    }
  };

  const filteredRooms = getFilteredRooms();
  const urgentRooms = filteredRooms.filter(r => r.priority === 'urgent');
  const normalRooms = filteredRooms.filter(r => r.priority === 'normal');

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
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-primary" />
                Housekeeping Dashboard
              </h1>
              <p className="text-muted-foreground">
                Rooms that need cleaning after checkout
              </p>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerCleaningNotifications}
              disabled={triggeringNotifications}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              {triggeringNotifications ? 'Sending...' : 'Send Cleaning Alerts'}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'checkout' | 'occupied')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="checkout">After Checkout</TabsTrigger>
              <TabsTrigger value="occupied">Occupied Rooms</TabsTrigger>
            </TabsList>

            {/* After Checkout Tab */}
            <TabsContent value="checkout" className="space-y-6 mt-6">
              {/* Filter and History Toggle */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    All ({rooms.length})
                  </Button>
                  <Button
                    variant={filter === 'urgent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('urgent')}
                    className="gap-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    Urgent ({rooms.filter(r => r.priority === 'urgent').length})
                  </Button>
                  <Button
                    variant={filter === 'recent' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('recent')}
                    className="gap-2"
                  >
                    <Clock className="h-4 w-4" />
                    Recent ({rooms.filter(r => r.priority === 'normal').length})
                  </Button>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="gap-2"
                >
                  <History className="h-4 w-4" />
                  {showHistory ? 'Hide' : 'Show'} History
                </Button>
              </div>

              {/* Cleaning History */}
              {showHistory && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Recent Cleaning History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {cleaningHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No cleaning history yet
                        </p>
                      ) : (
                        cleaningHistory.map((log) => (
                          <Card key={log.id} className="bg-accent/20">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-bold text-primary">
                                    Room #{log.unit_number} - {log.unit_name}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Guest: {log.guest_names[0] || 'N/A'}
                                  </p>
                                  <p className="text-sm">
                                    Cleaned by: {log.cleaned_by_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(log.cleaning_completed_at), 'MMM dd, yyyy HH:mm')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className="gap-1">
                                    <Clock className="h-3 w-3" />
                                    Est: {log.estimated_minutes}min
                                  </Badge>
                                  {log.actual_duration_minutes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Actual: {Math.round(log.actual_duration_minutes)}min
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                            <Badge variant="outline" className="gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Est. {room.estimated_cleaning_minutes || 45} min
                            </Badge>
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
                            <Badge variant="outline" className="gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              Est. {room.estimated_cleaning_minutes || 45} min
                            </Badge>
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
          {filteredRooms.length === 0 && rooms.length > 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No rooms match this filter</p>
                <p className="text-muted-foreground">
                  Try selecting a different filter option
                </p>
              </CardContent>
            </Card>
          )}

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
            </TabsContent>

            {/* Occupied Rooms Tab */}
            <TabsContent value="occupied" className="space-y-6 mt-6">
              {occupiedRooms.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Bed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">No Occupied Rooms</p>
                    <p className="text-muted-foreground">
                      No guests are currently checked in
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {occupiedRooms.map((room) => (
                    <Card key={room.id} className={room.needs_mid_stay_cleaning ? 'border-orange-200' : ''}>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Left Column - Room & Guest Info */}
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-lg font-bold text-primary">
                                Room #{room.unit_number}
                              </p>
                              {room.needs_mid_stay_cleaning && (
                                <Badge variant="destructive" className="text-xs">
                                  Cleaning Due
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{room.unit_name}</p>
                            
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{room.guest_names[0]}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span>{room.number_of_guests} guest{room.number_of_guests !== 1 ? 's' : ''}</span>
                              </div>
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Est. {room.estimated_cleaning_minutes} min
                              </Badge>
                            </div>
                          </div>

                          {/* Middle Column - Dates & Status */}
                          <div>
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Check-in / Check-out</p>
                                <div className="flex items-center gap-2 text-sm">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  <span>{format(new Date(room.check_in_date), 'MMM dd')} - {format(new Date(room.check_out_date), 'MMM dd')}</span>
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Stay Duration</p>
                                <div className="flex gap-4 text-sm">
                                  <Badge variant="secondary">Day {room.days_occupied}</Badge>
                                  <span className="text-muted-foreground">{room.days_remaining} days left</span>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Last Cleaned</p>
                                <p className="text-sm">
                                  {room.last_cleaned_date 
                                    ? format(new Date(room.last_cleaned_date), 'MMM dd, yyyy')
                                    : <span className="text-muted-foreground">Not cleaned yet</span>
                                  }
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Next Cleaning (Day 4)</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">
                                    {format(new Date(room.next_cleaning_date), 'MMM dd, yyyy')}
                                  </p>
                                  {new Date(room.next_cleaning_date) <= new Date() && (
                                    <Badge variant="destructive" className="text-xs">Due Now</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right Column - Notes */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Housekeeping Notes</p>
                            {editingNotes === room.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  defaultValue={room.housekeeping_notes || ''}
                                  placeholder="Add housekeeping notes..."
                                  className="min-h-[100px] text-sm"
                                  id={`notes-${room.id}`}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      const textarea = document.getElementById(`notes-${room.id}`) as HTMLTextAreaElement;
                                      handleUpdateNotes(room.id, textarea.value);
                                    }}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingNotes(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                onClick={() => setEditingNotes(room.id)}
                                className="min-h-[100px] text-sm p-3 rounded-md border bg-accent/20 cursor-pointer hover:bg-accent/30 transition-colors"
                              >
                                {room.housekeeping_notes || (
                                  <span className="text-muted-foreground italic">Click to add notes...</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Housekeeping;

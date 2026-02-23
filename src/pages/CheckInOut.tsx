import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, CheckCircle, Filter, SortAsc, ArrowLeft, FileSignature, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SlideMenu } from '@/components/SlideMenu';
import { CheckInDialog } from '@/components/CheckInDialog';
import { CheckOutDialog } from '@/components/CheckOutDialog';
import { PassportUploadDialog } from '@/components/PassportUploadDialog';

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  guest_types: string[] | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  number_of_guests: number;
  group_id: string | null;
  access_cards_given: number | null;
  units: { name: string; booking_com_name: string | null; unit_number: string | null } | null;
}

const CheckInOut = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, userRole, hasPermission } = useAuth();
  const [arrivals, setArrivals] = useState<Reservation[]>([]);
  const [departures, setDepartures] = useState<Reservation[]>([]);
  const [filteredArrivals, setFilteredArrivals] = useState<Reservation[]>([]);
  const [filteredDepartures, setFilteredDepartures] = useState<Reservation[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('room');
  const [selectedArrivals, setSelectedArrivals] = useState<Set<string>>(new Set());
  const [selectedDepartures, setSelectedDepartures] = useState<Set<string>>(new Set());
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [passportDialogOpen, setPassportDialogOpen] = useState(false);
  const [passportReservation, setPassportReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }
    
    fetchTodayReservations();
    
    // Real-time updates
    const channel = supabase
      .channel('checkinout-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchTodayReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loading, navigate]);

  const fetchTodayReservations = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');

    // Fetch arrivals (check-in today, status = confirmed) with group_id for split-stay filtering
    const { data: arrivalsData } = await supabase
      .from('reservations')
      .select('id, booking_reference, guest_names, guest_types, check_in_date, check_out_date, status, number_of_guests, group_id, access_cards_given, units!unit_id(name, booking_com_name, unit_number)')
      .eq('check_in_date', today)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });

    // Fetch reservations ending today (to identify transfer-in segments)
    const { data: endingToday } = await supabase
      .from('reservations')
      .select('id, group_id')
      .eq('check_out_date', today)
      .neq('status', 'cancelled');

    // Filter arrivals: exclude if another reservation in same group ends today (transfer-in)
    const filteredArrivalsData = (arrivalsData || []).filter(arrival => {
      if (!arrival.group_id) return true; // No group = not a split-stay
      const isTransferIn = (endingToday || []).some(
        ending => ending.group_id === arrival.group_id && ending.id !== arrival.id
      );
      return !isTransferIn;
    });

    // Fetch departures (check-out today, all relevant statuses including already processed)
    const { data: departuresData } = await supabase
      .from('reservations')
      .select('id, booking_reference, guest_names, guest_types, check_in_date, check_out_date, status, number_of_guests, group_id, access_cards_given, units!unit_id(name, booking_com_name, unit_number)')
      .eq('check_out_date', today)
      .in('status', ['checked-in', 'confirmed', 'checked-out', 'completed'])
      .order('created_at', { ascending: false });

    // Fetch reservations starting today (to identify transfer-out segments)
    const { data: startingToday } = await supabase
      .from('reservations')
      .select('id, group_id')
      .eq('check_in_date', today)
      .neq('status', 'cancelled');

    // Filter departures: exclude if another reservation in same group starts today (transfer-out)
    const filteredDeparturesData = (departuresData || []).filter(departure => {
      if (!departure.group_id) return true; // No group = not a split-stay
      const isTransferOut = (startingToday || []).some(
        starting => starting.group_id === departure.group_id && starting.id !== departure.id
      );
      return !isTransferOut;
    });

    setArrivals(filteredArrivalsData as Reservation[]);
    setDepartures(filteredDeparturesData as Reservation[]);
    
    // Extract unique room types from filtered reservations
    const allReservations = [...filteredArrivalsData, ...filteredDeparturesData];
    const roomTypes = new Set(
      allReservations
        .map(r => r.units?.booking_com_name || r.units?.name)
        .filter((name): name is string => name !== null && name !== undefined)
    );
    setAvailableRoomTypes(Array.from(roomTypes));
  };

  useEffect(() => {
    applyFilters();
  }, [arrivals, departures, roomTypeFilter, sortBy]);

  const applyFilters = () => {
    let filteredArr = [...arrivals];
    let filteredDep = [...departures];

    // Apply room type filter
    if (roomTypeFilter !== 'all') {
      filteredArr = filteredArr.filter(r => (r.units?.booking_com_name || r.units?.name) === roomTypeFilter);
      filteredDep = filteredDep.filter(r => (r.units?.booking_com_name || r.units?.name) === roomTypeFilter);
    }

    // Apply sorting
    const sortFn = (a: Reservation, b: Reservation) => {
      if (sortBy === 'room') {
        const roomA = a.units?.unit_number || '';
        const roomB = b.units?.unit_number || '';
        return roomA.localeCompare(roomB);
      } else {
        const nameA = a.guest_names[0] || '';
        const nameB = b.guest_names[0] || '';
        return nameA.localeCompare(nameB);
      }
    };

    filteredArr.sort(sortFn);
    filteredDep.sort(sortFn);

    setFilteredArrivals(filteredArr);
    setFilteredDepartures(filteredDep);
  };

  const handleCheckIn = async (reservationId: string, accessCards: number) => {
    setUpdating(reservationId);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'checked-in',
          checked_in_at: new Date().toISOString(),
          access_cards_given: accessCards 
        })
        .eq('id', reservationId);

      if (error) throw error;

      // Send check-in notification to all admins
      try {
        await supabase.functions.invoke('send-checkin-notification', {
          body: { reservationId }
        });
      } catch (notifError) {
        console.error('Failed to send check-in notification:', notifError);
      }

      toast({
        title: 'Success',
        description: 'Guest checked in successfully',
      });

      setCheckInDialogOpen(false);
      setSelectedReservation(null);
      fetchTodayReservations();
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

  const handleCheckOut = async (reservationId: string) => {
    setUpdating(reservationId);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'checked-out',
          checked_out_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (error) throw error;

      // Send check-out notification to admins and housekeeping staff
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.functions.invoke('send-checkout-notification', {
          body: { reservationId, userId: user?.id, checkedOutAt: new Date().toISOString() }
        });
      } catch (notifError) {
        console.error('Failed to send check-out notification:', notifError);
      }

      toast({
        title: 'Success',
        description: 'Guest checked out successfully',
      });

      setCheckOutDialogOpen(false);
      setSelectedReservation(null);
      fetchTodayReservations();
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

  const handleBulkCheckIn = async () => {
    if (selectedArrivals.size === 0) return;
    
    setUpdating('bulk');
    try {
      const now = new Date().toISOString();
      const updates = Array.from(selectedArrivals).map(id =>
        supabase.from('reservations').update({ 
          status: 'checked-in',
          checked_in_at: now
        }).eq('id', id)
      );

      await Promise.all(updates);

      // Send check-in notifications for all checked-in guests
      const notificationPromises = Array.from(selectedArrivals).map(reservationId =>
        supabase.functions.invoke('send-checkin-notification', {
          body: { reservationId }
        }).catch(err => console.error('Failed to send check-in notification:', err))
      );
      
      await Promise.all(notificationPromises);

      toast({
        title: 'Success',
        description: `${selectedArrivals.size} guests checked in successfully`,
      });

      setSelectedArrivals(new Set());
      fetchTodayReservations();
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

  const handleBulkCheckOut = async () => {
    if (selectedDepartures.size === 0) return;
    
    setUpdating('bulk');
    try {
      const updates = Array.from(selectedDepartures).map(id =>
        supabase.from('reservations').update({ 
          status: 'checked-out',
          checked_out_at: new Date().toISOString()
        }).eq('id', id)
      );

      await Promise.all(updates);

      // Send check-out notifications for all checked-out guests
      const { data: { user } } = await supabase.auth.getUser();
      const checkoutTimestamp = new Date().toISOString();
      const notificationPromises = Array.from(selectedDepartures).map(reservationId =>
        supabase.functions.invoke('send-checkout-notification', {
          body: { reservationId, userId: user?.id, checkedOutAt: checkoutTimestamp }
        }).catch(err => console.error('Failed to send check-out notification:', err))
      );
      
      await Promise.all(notificationPromises);

      toast({
        title: 'Success',
        description: `${selectedDepartures.size} guests checked out successfully`,
      });

      setSelectedDepartures(new Set());
      fetchTodayReservations();
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

  const toggleArrivalSelection = (id: string) => {
    const newSelection = new Set(selectedArrivals);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedArrivals(newSelection);
  };

  const toggleDepartureSelection = (id: string) => {
    const newSelection = new Set(selectedDepartures);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedDepartures(newSelection);
  };

  const selectAllArrivals = () => {
    if (selectedArrivals.size === filteredArrivals.length) {
      setSelectedArrivals(new Set());
    } else {
      setSelectedArrivals(new Set(filteredArrivals.map(r => r.id)));
    }
  };

  const selectAllDepartures = () => {
    if (selectedDepartures.size === filteredDepartures.length) {
      setSelectedDepartures(new Set());
    } else {
      setSelectedDepartures(new Set(filteredDepartures.map(r => r.id)));
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

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            
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
              <h1 className="text-3xl font-bold mb-2">Check-In / Check-Out</h1>
              <p className="text-muted-foreground">
                Manage today's arrivals and departures
              </p>
            </div>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by room type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Room Types</SelectItem>
                {availableRoomTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="room">Room Number</SelectItem>
                <SelectItem value="guest">Guest Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Today's Arrivals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-blue-600" />
                  Today's Arrivals ({filteredArrivals.length})
                </div>
                <div className="flex items-center gap-2">
                  {hasPermission('can_check_in') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllArrivals}
                      >
                        {selectedArrivals.size === filteredArrivals.length && filteredArrivals.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      {selectedArrivals.size > 0 && (
                        <Button
                          size="sm"
                          onClick={handleBulkCheckIn}
                          disabled={updating === 'bulk'}
                        >
                          Check In ({selectedArrivals.size})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredArrivals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No arrivals matching filters
                </p>
              ) : (
                filteredArrivals.map((reservation) => (
                  <Card key={reservation.id} className="bg-accent/20">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedArrivals.has(reservation.id)}
                            onCheckedChange={() => toggleArrivalSelection(reservation.id)}
                          />
                          {reservation.units?.unit_number && (
                            <p className="text-lg font-bold text-primary">
                              Room #{reservation.units.unit_number}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {reservation.booking_reference}
                            </p>
                            <div className="space-y-1 mt-1">
                              {reservation.guest_names.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <p className="text-sm">{name}</p>
                                  {reservation.guest_types && reservation.guest_types[idx] && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {reservation.guest_types[idx]}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {reservation.units?.name || 'No unit assigned'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.number_of_guests} guest{reservation.number_of_guests !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPassportReservation(reservation);
                                setPassportDialogOpen(true);
                              }}
                              className="gap-2"
                            >
                              <Upload className="h-4 w-4" />
                              Passport Upload
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/guest-checkin/${reservation.id}`, '_blank')}
                              className="gap-2"
                            >
                              <FileSignature className="h-4 w-4" />
                              Guest Form
                            </Button>
                            {hasPermission('can_check_in') && (
                              <Button
                                onClick={() => {
                                  setSelectedReservation(reservation);
                                  setCheckInDialogOpen(true);
                                }}
                                disabled={updating === reservation.id}
                                className="gap-2"
                              >
                                <CheckCircle className="h-4 w-4" />
                                Check In
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>

          {/* Today's Departures */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogOut className="h-5 w-5 text-orange-600" />
                  Today's Departures ({filteredDepartures.length})
                </div>
                <div className="flex items-center gap-2">
                  {hasPermission('can_check_out') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllDepartures}
                      >
                        {selectedDepartures.size === filteredDepartures.length && filteredDepartures.length > 0 ? 'Deselect All' : 'Select All'}
                      </Button>
                      {selectedDepartures.size > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkCheckOut}
                          disabled={updating === 'bulk'}
                        >
                          Check Out ({selectedDepartures.size})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredDepartures.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No departures matching filters
                </p>
              ) : (
                filteredDepartures.map((reservation) => (
                  <Card key={reservation.id} className="bg-accent/20">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedDepartures.has(reservation.id)}
                            onCheckedChange={() => toggleDepartureSelection(reservation.id)}
                          />
                          {reservation.units?.unit_number && (
                            <p className="text-lg font-bold text-primary">
                              Room #{reservation.units.unit_number}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {reservation.booking_reference}
                            </p>
                            <div className="space-y-1 mt-1">
                              {reservation.guest_names.map((name, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <p className="text-sm">{name}</p>
                                  {reservation.guest_types && reservation.guest_types[idx] && (
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {reservation.guest_types[idx]}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {reservation.units?.name || 'No unit assigned'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {reservation.number_of_guests} guest{reservation.number_of_guests !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {hasPermission('can_check_out') && (
                            <Button
                              onClick={() => {
                                setSelectedReservation(reservation);
                                setCheckOutDialogOpen(true);
                              }}
                              disabled={updating === reservation.id}
                              variant="outline"
                              className="gap-2"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Check Out
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Check-In Dialog */}
        <CheckInDialog
          open={checkInDialogOpen}
          onOpenChange={setCheckInDialogOpen}
          reservation={selectedReservation}
          onConfirm={(accessCards) => {
            if (selectedReservation) {
              handleCheckIn(selectedReservation.id, accessCards);
            }
          }}
          loading={updating === selectedReservation?.id}
        />

        {/* Check-Out Dialog */}
        <CheckOutDialog
          open={checkOutDialogOpen}
          onOpenChange={setCheckOutDialogOpen}
          reservation={selectedReservation}
          onConfirm={() => {
            if (selectedReservation) {
              handleCheckOut(selectedReservation.id);
            }
          }}
          loading={updating === selectedReservation?.id}
        />

        {/* Passport Upload Dialog */}
        <PassportUploadDialog
          open={passportDialogOpen}
          onOpenChange={setPassportDialogOpen}
          reservationId={passportReservation?.id || ''}
          guestName={passportReservation?.guest_names[0] || 'Guest'}
        />
      </div>
    </div>
  );
};

export default CheckInOut;

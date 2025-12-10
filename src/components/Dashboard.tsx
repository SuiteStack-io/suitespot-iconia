import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, LogIn, LogOut, TrendingUp, DollarSign, CheckCircle, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { ConflictAlert } from './ConflictAlert';
import { PendingAssignmentsAlert } from './PendingAssignmentsAlert';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DashboardStats {
  todayArrivals: number;
  todayDepartures: number;
  inHouse: number;
  newBookings: number;
  totalRevenue: number;
  netRevenue: number;
  totalCommission: number;
}

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  guest_types: string[] | null;
  guest_genders: string[] | null;
  check_in_date: string;
  check_out_date: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  status: string;
  total_price: number;
  number_of_guests: number;
  children: number | null;
  adults: number | null;
  units: { name: string; unit_number: string | null } | null;
}

const statusColors = {
  Upcoming: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'In-House': 'bg-green-100 text-green-800 hover:bg-green-100',
  'Checked-Out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  Cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    todayArrivals: 0,
    todayDepartures: 0,
    inHouse: 0,
    newBookings: 0,
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogReservations, setDialogReservations] = useState<Reservation[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
  
  // Undo confirmation modal state
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const [undoReservationId, setUndoReservationId] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    
    // Real-time updates for reservations
    const reservationsChannel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    // Real-time updates for units
    const unitsChannel = supabase
      .channel('units-changes-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(unitsChannel);
    };
  }, []);

  const fetchStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    // Today's arrivals
    const { data: arrivals } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('check_in_date', today)
      .neq('status', 'Cancelled');

    // Today's departures
    const { data: departures } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('check_out_date', today)
      .neq('status', 'Cancelled');

    // In-house count (confirmed reservations where check-in has passed and check-out hasn't)
    const { data: inHouse } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('status', 'confirmed')
      .lte('check_in_date', today)
      .gt('check_out_date', today);

    // New bookings in last 24h
    const { data: newBookings } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .gte('created_at', yesterday);

    // Revenue calculations
    const { data: revenueData } = await supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount')
      .neq('status', 'Cancelled');

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    setStats({
      todayArrivals: arrivals?.length || 0,
      todayDepartures: departures?.length || 0,
      inHouse: inHouse?.length || 0,
      newBookings: newBookings?.length || 0,
      totalRevenue,
      netRevenue,
      totalCommission,
    });
  };

  const handleCardClick = async (cardType: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    
    let query = supabase
      .from('reservations')
      .select('id, booking_reference, guest_names, guest_types, guest_genders, check_in_date, check_out_date, checked_in_at, checked_out_at, status, total_price, number_of_guests, children, adults, units(name, unit_number)');
    
    switch (cardType) {
      case 'arrivals':
        setDialogTitle("Today's Arrivals");
        query = query.eq('check_in_date', today).neq('status', 'Cancelled');
        break;
      case 'departures':
        setDialogTitle("Today's Departures");
        query = query.eq('check_out_date', today).neq('status', 'Cancelled');
        break;
      case 'inhouse':
        setDialogTitle('In-House Now');
        query = query.eq('status', 'confirmed')
          .lte('check_in_date', today)
          .gt('check_out_date', today);
        break;
      case 'newbookings':
        setDialogTitle('New Bookings (Last 24h)');
        query = query.gte('created_at', yesterday);
        break;
    }
    
    const { data } = await query.order('check_in_date', { ascending: true });
    setDialogReservations((data as any) || []);
    setSelectedReservations(new Set());
    setDialogOpen(true);
  };

  const handleStatusChange = async (reservationId: string, newStatus: string, sendNotification: boolean = true) => {
    setUpdating(reservationId);
    try {
      // Build update payload with timestamps
      const updatePayload: any = { status: newStatus };
      
      if (newStatus === 'checked-in') {
        updatePayload.checked_in_at = new Date().toISOString();
      } else if (newStatus === 'checked-out') {
        updatePayload.checked_out_at = new Date().toISOString();
      }
      
      // If undoing checkout, clear the checked_out_at
      if (newStatus === 'checked-in' && !sendNotification) {
        updatePayload.checked_out_at = null;
      }

      const { error } = await supabase
        .from('reservations')
        .update(updatePayload)
        .eq('id', reservationId);

      if (error) throw error;

      // Send check-in notification if status changed to checked-in AND notification requested
      if (newStatus === 'checked-in' && sendNotification) {
        try {
          await supabase.functions.invoke('send-checkin-notification', {
            body: { reservationId }
          });
        } catch (notifError) {
          console.error('Failed to send check-in notification:', notifError);
        }
      }

      // Send check-out notification to admins and housekeeping if status changed to checked-out AND notification requested
      if (newStatus === 'checked-out' && sendNotification) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.functions.invoke('send-checkout-notification', {
            body: { reservationId, userId: user?.id }
          });
        } catch (notifError) {
          console.error('Failed to send check-out notification:', notifError);
        }
      }

      toast({
        title: 'Success',
        description: `Status updated to ${newStatus}`,
      });

      // Refresh the dialog reservations and stats
      fetchStats();
      // Re-fetch the current dialog data
      const currentType = dialogReservations.length > 0 && dialogTitle.includes('Arrivals') ? 'arrivals' : 
                          dialogTitle.includes('Departures') ? 'departures' : 
                          dialogTitle.includes('In-House') ? 'inhouse' : 'newbookings';
      if (dialogOpen) {
        handleCardClick(currentType);
      }
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

  const handleUndoClick = (reservationId: string) => {
    setUndoReservationId(reservationId);
    setUndoConfirmOpen(true);
  };

  const handleUndoConfirm = async (sendNotification: boolean) => {
    if (!undoReservationId) return;
    
    await handleStatusChange(undoReservationId, 'checked-in', sendNotification);
    setUndoConfirmOpen(false);
    setUndoReservationId(null);
  };

  const handleBulkCheckOut = async () => {
    if (selectedReservations.size === 0) return;
    
    setUpdating('bulk');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      
      // Update all selected reservations with timestamp
      const updates = Array.from(selectedReservations).map(id =>
        supabase.from('reservations').update({ 
          status: 'checked-out',
          checked_out_at: now
        }).eq('id', id)
      );

      await Promise.all(updates);

      // Send check-out notifications for all checked-out guests
      const notificationPromises = Array.from(selectedReservations).map(reservationId =>
        supabase.functions.invoke('send-checkout-notification', {
          body: { reservationId, userId: user?.id }
        }).catch(err => console.error('Failed to send check-out notification:', err))
      );
      
      await Promise.all(notificationPromises);

      toast({
        title: 'Success',
        description: `${selectedReservations.size} guests checked out successfully`,
      });

      setSelectedReservations(new Set());
      fetchStats();
      
      // Re-fetch the current dialog data
      const currentType = dialogReservations.length > 0 && dialogTitle.includes('Arrivals') ? 'arrivals' : 
                          dialogTitle.includes('Departures') ? 'departures' : 
                          dialogTitle.includes('In-House') ? 'inhouse' : 'newbookings';
      if (dialogOpen) {
        handleCardClick(currentType);
      }
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

  const toggleReservationSelection = (id: string) => {
    const newSelection = new Set(selectedReservations);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedReservations(newSelection);
  };

  const selectAllReservations = () => {
    if (selectedReservations.size === dialogReservations.length) {
      setSelectedReservations(new Set());
    } else {
      setSelectedReservations(new Set(dialogReservations.map(r => r.id)));
    }
  };

  const statCards = [
    {
      title: "Today's Arrivals",
      value: stats.todayArrivals,
      icon: LogIn,
      color: 'text-blue-600',
      isRevenue: false,
      type: 'arrivals',
    },
    {
      title: "Today's Departures",
      value: stats.todayDepartures,
      icon: LogOut,
      color: 'text-orange-600',
      isRevenue: false,
      type: 'departures',
    },
    {
      title: 'In-House Now',
      value: stats.inHouse,
      icon: Calendar,
      color: 'text-green-600',
      isRevenue: false,
      type: 'inhouse',
    },
    {
      title: 'New Bookings (24h)',
      value: stats.newBookings,
      icon: TrendingUp,
      color: 'text-purple-600',
      isRevenue: false,
      type: 'newbookings',
    },
  ];

  return (
    <>
      <PendingAssignmentsAlert />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleCardClick(stat.type)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stat.isRevenue ? `$${stat.value.toFixed(2)}` : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Conflict Alert */}
      <div className="mt-6">
        <ConflictAlert />
      </div>

      {/* Availability Calendar */}
      <div className="mt-6">
        <AvailabilityCalendar />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{dialogTitle}</span>
              {dialogTitle.includes('Departures') && dialogReservations.length > 0 && (
                <div className="flex items-center gap-2">
                  {/* Direct checkout for single departure */}
                  {dialogReservations.length === 1 && (dialogReservations[0].status === 'checked-in' || dialogReservations[0].status === 'confirmed') && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(dialogReservations[0].id, 'checked-out')}
                      disabled={updating === dialogReservations[0].id}
                      className="gap-1"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Check Out
                    </Button>
                  )}
                  {dialogReservations.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={selectAllReservations}
                      >
                        {selectedReservations.size === dialogReservations.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      {selectedReservations.size > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkCheckOut}
                          disabled={updating === 'bulk'}
                        >
                          Check Out ({selectedReservations.size})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {dialogReservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reservations found</p>
            ) : (
              dialogReservations.map((reservation) => (
                <Card 
                  key={reservation.id}
                  className="hover:bg-accent/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1">
                        {dialogTitle.includes('Departures') && (
                          <Checkbox
                            checked={selectedReservations.has(reservation.id)}
                            onCheckedChange={() => toggleReservationSelection(reservation.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div 
                          className="space-y-1 flex-1 cursor-pointer"
                          onClick={() => {
                            setDialogOpen(false);
                            navigate(`/reservation/${reservation.id}`);
                          }}
                        >
                        {reservation.units?.unit_number && (
                          <p className="text-lg font-bold text-primary">
                            Room #{reservation.units.unit_number}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{reservation.booking_reference}</p>
                          <Badge 
                            variant="outline" 
                            className={statusColors[reservation.status as keyof typeof statusColors]}
                          >
                            {reservation.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {reservation.guest_names.map((name, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">{name}</p>
                              {reservation.guest_types && reservation.guest_types[idx] && (
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {reservation.guest_types[idx]}
                                </Badge>
                              )}
                              {reservation.guest_genders && reservation.guest_genders[idx] && (
                                <Badge variant="outline" className="text-xs">
                                  {reservation.guest_genders[idx]}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>{reservation.number_of_guests} {reservation.number_of_guests === 1 ? 'guest' : 'guests'}</span>
                          {reservation.children !== null && reservation.children > 0 && (
                            <>
                              <span>•</span>
                              <span>{reservation.children} {reservation.children === 1 ? 'child' : 'children'}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm">
                          {reservation.units?.name || 'No unit assigned'}
                        </p>
                      </div>
                    </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-sm space-y-1">
                          <p>Check-in: {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}</p>
                          <p>Check-out: {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}</p>
                          {reservation.checked_in_at && (
                            <p className="text-green-600 text-xs">
                              Checked in: {format(new Date(reservation.checked_in_at), 'MMM dd, h:mm a')}
                            </p>
                          )}
                          {reservation.checked_out_at && (
                            <p className="text-orange-600 text-xs">
                              Checked out: {format(new Date(reservation.checked_out_at), 'MMM dd, h:mm a')}
                            </p>
                          )}
                          <p className="font-semibold">${reservation.total_price.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-2">
                          {reservation.status === 'confirmed' && !dialogTitle.includes('Departures') && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reservation.id, 'checked-in');
                              }}
                              disabled={updating === reservation.id}
                              className="gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Check In
                            </Button>
                          )}
                          {reservation.status === 'confirmed' && dialogTitle.includes('Departures') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reservation.id, 'checked-out');
                              }}
                              disabled={updating === reservation.id}
                              className="gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Check Out
                            </Button>
                          )}
                          {reservation.status === 'checked-in' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(reservation.id, 'checked-out');
                              }}
                              disabled={updating === reservation.id}
                              className="gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Check Out
                            </Button>
                          )}
                          {dialogTitle.includes('Departures') && (reservation.status === 'checked-out' || reservation.status === 'completed') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUndoClick(reservation.id);
                              }}
                              disabled={updating === reservation.id}
                              className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <Undo2 className="h-3 w-3" />
                              Undo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo Confirmation Dialog */}
      <AlertDialog open={undoConfirmOpen} onOpenChange={setUndoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Check-Out</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the guest's status to checked-in. Do you want to send a check-in notification email to admins?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setUndoConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => handleUndoConfirm(false)}
              disabled={updating === undoReservationId}
            >
              No, just undo
            </Button>
            <Button
              onClick={() => handleUndoConfirm(true)}
              disabled={updating === undoReservationId}
            >
              Yes, send notification
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, LogIn, LogOut, TrendingUp, DollarSign, CheckCircle, Undo2, XCircle, FileSignature, ArrowRightLeft, Clock } from 'lucide-react';
import { CheckInDialog } from './CheckInDialog';
import { CheckOutDialog } from './CheckOutDialog';
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
import { Skeleton } from '@/components/ui/skeleton';
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
  arrivalsCheckedIn: number;
  todayDepartures: number;
  departuresCheckedOut: number;
  inHouse: number;
  newBookings: number;
  newBookingsDirect: number;
  newBookingsBookingCom: number;
  recentCancellations: number;
  totalRevenue: number;
  netRevenue: number;
  totalCommission: number;
  todayTransfers: number;
}

interface RoomTransfer {
  guestName: string;
  fromRoom: string;
  fromRoomNumber: string;
  toRoom: string;
  toRoomNumber: string;
  fromReservationId: string;
  toReservationId: string;
  groupId: string;
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
  cancelled_at: string | null;
  status: string;
  total_price: number;
  number_of_guests: number;
  children: number | null;
  adults: number | null;
  source: string;
  channel: string;
  group_id: string | null;
  payment_method: string | null;
  access_cards_given: number | null;
  units: { name: string; booking_com_name: string | null; unit_number: string | null } | null;
  check_in_agreements?: { id: string }[] | null;
  arrival_time: string | null;
  notes: string | null;
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
    arrivalsCheckedIn: 0,
    todayDepartures: 0,
    departuresCheckedOut: 0,
    inHouse: 0,
    newBookings: 0,
    newBookingsDirect: 0,
    newBookingsBookingCom: 0,
    recentCancellations: 0,
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
    todayTransfers: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogReservations, setDialogReservations] = useState<Reservation[]>([]);
  const [dialogTransfers, setDialogTransfers] = useState<RoomTransfer[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
  const [dialogLoading, setDialogLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // Undo confirmation modal state
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);
  const [undoReservationId, setUndoReservationId] = useState<string | null>(null);
  const [undoType, setUndoType] = useState<'checkin' | 'checkout'>('checkout');
  
  // Check-in/Check-out dialog state
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkOutDialogOpen, setCheckOutDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // IntersectionObserver for progressive card loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 10);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dialogReservations, visibleCount]);

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
    const sevenDaysAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd');

    // Today's arrivals (with group_id and status for split-stay filtering)
    const { data: allArrivals } = await supabase
      .from('reservations')
      .select('id, group_id, status')
      .eq('check_in_date', today)
      .neq('status', 'cancelled')
      .is('cancelled_at', null);

    // Reservations ending today (for identifying transfers)
    const { data: endingToday } = await supabase
      .from('reservations')
      .select('id, group_id, unit_id')
      .eq('check_out_date', today)
      .neq('status', 'cancelled')
      .is('cancelled_at', null);

    // Filter arrivals: exclude if another reservation in same group ends today (transfer-in)
    const filteredArrivals = (allArrivals || []).filter(arrival => {
      if (!arrival.group_id) return true; // No group = not a split-stay
      const isTransferIn = (endingToday || []).some(
        ending => ending.group_id === arrival.group_id && ending.id !== arrival.id
      );
      return !isTransferIn;
    });

    // Count how many arrivals are already checked in
    const arrivalsCheckedIn = filteredArrivals.filter(
      arrival => arrival.status === 'checked-in'
    ).length;

    // Today's departures (with group_id and status for split-stay filtering)
    const { data: allDepartures } = await supabase
      .from('reservations')
      .select('id, group_id, status')
      .eq('check_out_date', today)
      .neq('status', 'cancelled')
      .is('cancelled_at', null);

    // Reservations starting today (for identifying transfers)
    const { data: startingToday } = await supabase
      .from('reservations')
      .select('id, group_id, unit_id')
      .eq('check_in_date', today)
      .neq('status', 'cancelled')
      .is('cancelled_at', null);

    // Filter departures: exclude if another reservation in same group starts today (transfer-out)
    const filteredDepartures = (allDepartures || []).filter(departure => {
      if (!departure.group_id) return true; // No group = not a split-stay
      const isTransferOut = (startingToday || []).some(
        starting => starting.group_id === departure.group_id && starting.id !== departure.id
      );
      return !isTransferOut;
    });

    // Count how many departures are already checked out
    const departuresCheckedOut = filteredDepartures.filter(
      departure => departure.status === 'checked-out' || departure.status === 'completed'
    ).length;

    // In-house: only guests who have officially checked in (status = 'checked-in')
    const { data: inHouse } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('status', 'checked-in')
      .gte('check_out_date', today)
      .is('cancelled_at', null);

    // New bookings in last 24h
    const { data: newBookings } = await supabase
      .from('reservations')
      .select('id, channel')
      .gte('created_at', yesterday)
      .is('cancelled_at', null);

    // Calculate booking source breakdown
    const newBookingsBookingCom = (newBookings || []).filter(
      b => b.channel === 'Booking.com'
    ).length;
    const newBookingsDirect = (newBookings?.length || 0) - newBookingsBookingCom;

    // Recent cancellations (last 24h)
    const { data: cancellations } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('status', 'cancelled')
      .gte('cancelled_at', yesterday);

    // Revenue calculations
    const { data: revenueData } = await supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount')
      .neq('status', 'cancelled')
      .is('cancelled_at', null);

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + ((r.total_price || 0) - (r.commission_amount || 0)), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    // Count today's transfers (where one segment ends and another starts in same group with DIFFERENT rooms)
    const todayTransfers = (endingToday || []).filter(ending => {
      if (!ending.group_id) return false;
      return (startingToday || []).some(
        starting => 
          starting.group_id === ending.group_id && 
          starting.id !== ending.id &&
          starting.unit_id !== ending.unit_id // Must be different rooms
      );
    }).length;

    setStats({
      todayArrivals: filteredArrivals.length,
      arrivalsCheckedIn,
      todayDepartures: filteredDepartures.length,
      departuresCheckedOut,
      inHouse: inHouse?.length || 0,
      newBookings: newBookings?.length || 0,
      newBookingsDirect,
      newBookingsBookingCom,
      recentCancellations: cancellations?.length || 0,
      totalRevenue,
      netRevenue,
      totalCommission,
      todayTransfers,
    });
  };

  const handleCardClick = async (cardType: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    const sevenDaysAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd');
    
    const baseSelect = '*, units(name, booking_com_name, unit_number), check_in_agreements(id)';
    
    // Clear transfers when opening a non-transfer dialog
    setDialogTransfers([]);
    setDialogLoading(true);
    setVisibleCount(10);
    setDialogOpen(true);
    
    if (cardType === 'transfers') {
      setDialogTitle("Today's Room Transfers");
      
      // Get reservations ending today with full data
      const { data: endingTodayFull } = await supabase
        .from('reservations')
        .select('id, group_id, unit_id, guest_names, units(name, booking_com_name, unit_number)')
        .eq('check_out_date', today)
        .neq('status', 'cancelled')
        .is('cancelled_at', null);
      
      // Get reservations starting today with full data
      const { data: startingTodayFull } = await supabase
        .from('reservations')
        .select('id, group_id, unit_id, guest_names, units(name, booking_com_name, unit_number)')
        .eq('check_in_date', today)
        .neq('status', 'cancelled')
        .is('cancelled_at', null);
      
      // Build transfer pairs - only include actual room changes
      const transfers: RoomTransfer[] = [];
      (endingTodayFull || []).forEach(ending => {
        if (!ending.group_id) return;
        const startingMatch = (startingTodayFull || []).find(
          starting => 
            starting.group_id === ending.group_id && 
            starting.id !== ending.id &&
            starting.unit_id !== ending.unit_id // Must be different rooms
        );
        if (startingMatch) {
          transfers.push({
            guestName: ending.guest_names?.[0] || 'Unknown Guest',
            fromRoom: ending.units?.name || 'Unknown',
            fromRoomNumber: ending.units?.unit_number || '',
            toRoom: startingMatch.units?.name || 'Unknown',
            toRoomNumber: startingMatch.units?.unit_number || '',
            fromReservationId: ending.id,
            toReservationId: startingMatch.id,
            groupId: ending.group_id,
          });
        }
      });
      
      setDialogTransfers(transfers);
      setDialogReservations([]);
      setDialogLoading(false);
      return;
    }
    
    if (cardType === 'arrivals') {
      setDialogTitle("Today's Arrivals");
      
      // Fetch arrivals with group_id
      const { data: arrivals } = await supabase
        .from('reservations')
        .select(baseSelect)
        .eq('check_in_date', today)
        .neq('status', 'cancelled')
        .is('cancelled_at', null)
        .order('check_in_date', { ascending: true });
      
      // Fetch reservations ending today (to identify transfers)
      const { data: endingToday } = await supabase
        .from('reservations')
        .select('id, group_id')
        .eq('check_out_date', today)
        .neq('status', 'cancelled')
        .is('cancelled_at', null);
      
      // Filter out transfer-in segments (where another segment in same group ends today)
      const filtered = (arrivals || []).filter(arrival => {
        if (!arrival.group_id) return true;
        const isTransferIn = (endingToday || []).some(
          ending => ending.group_id === arrival.group_id && ending.id !== arrival.id
        );
        return !isTransferIn;
      });
      
      setDialogReservations(filtered as any);
      setSelectedReservations(new Set());
      setDialogLoading(false);
      return;
    }
    
    if (cardType === 'departures') {
      setDialogTitle("Today's Departures");
      
      // Fetch departures with group_id
      const { data: departures } = await supabase
        .from('reservations')
        .select(baseSelect)
        .eq('check_out_date', today)
        .neq('status', 'cancelled')
        .is('cancelled_at', null)
        .order('check_in_date', { ascending: true });
      
      // Fetch reservations starting today (to identify transfers)
      const { data: startingToday } = await supabase
        .from('reservations')
        .select('id, group_id')
        .eq('check_in_date', today)
        .neq('status', 'cancelled')
        .is('cancelled_at', null);
      
      // Filter out transfer-out segments (where another segment in same group starts today)
      const filtered = (departures || []).filter(departure => {
        if (!departure.group_id) return true;
        const isTransferOut = (startingToday || []).some(
          starting => starting.group_id === departure.group_id && starting.id !== departure.id
        );
        return !isTransferOut;
      });
      
      setDialogReservations(filtered as any);
      setSelectedReservations(new Set());
      setDialogLoading(false);
      return;
    }
    
    let query = supabase
      .from('reservations')
      .select(baseSelect);
    
    switch (cardType) {
      case 'inhouse':
        setDialogTitle('In-House Now');
        query = query
          .eq('status', 'checked-in')
          .gte('check_out_date', today)
          .is('cancelled_at', null);
        break;
      case 'newbookings':
        setDialogTitle('New Bookings (Last 24h)');
        query = query.gte('created_at', yesterday);
        break;
      case 'cancellations':
        setDialogTitle('Recent Cancellations (Last 24h)');
        query = query.eq('status', 'cancelled').gte('cancelled_at', yesterday);
        break;
    }
    
    const { data } = await query.order('check_in_date', { ascending: true });
    setDialogReservations((data as any) || []);
    setSelectedReservations(new Set());
    setDialogLoading(false);
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
      if (newStatus === 'checked-in') {
        updatePayload.checked_out_at = null;
      }
      
      // If undoing checkin (reverting to confirmed), clear checked_in_at
      if (newStatus === 'confirmed') {
        updatePayload.checked_in_at = null;
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
            body: { reservationId, userId: user?.id, checkedOutAt: new Date().toISOString() }
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
      const currentType = dialogTitle.includes('Arrivals') ? 'arrivals' : 
                          dialogTitle.includes('Departures') ? 'departures' : 
                          dialogTitle.includes('In-House') ? 'inhouse' : 
                          dialogTitle.includes('Cancellations') ? 'cancellations' : 'newbookings';
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

  const handleUndoClick = (reservationId: string, type: 'checkin' | 'checkout') => {
    setUndoReservationId(reservationId);
    setUndoType(type);
    setUndoConfirmOpen(true);
  };

  const handleUndoConfirm = async (sendNotification: boolean) => {
    if (!undoReservationId) return;
    
    if (undoType === 'checkout') {
      // Undo check-out → back to checked-in
      await handleStatusChange(undoReservationId, 'checked-in', sendNotification);
    } else {
      // Undo check-in → back to confirmed
      await handleStatusChange(undoReservationId, 'confirmed', sendNotification);
    }
    setUndoConfirmOpen(false);
    setUndoReservationId(null);
  };

  const handleCheckInWithCards = async (reservationId: string, accessCards: number) => {
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

      // Send check-in notification
      try {
        await supabase.functions.invoke('send-checkin-notification', {
          body: { reservationId }
        });
      } catch (notifError) {
        console.error('Failed to send check-in notification:', notifError);
      }

      toast({
        title: "Guest checked in",
        description: `Access cards issued: ${accessCards}`,
      });

      fetchStats();
      // Refresh the dialog data
      if (dialogOpen) {
        handleCardClick('arrivals');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
      setCheckInDialogOpen(false);
      setSelectedReservation(null);
    }
  };

  const handleCheckOutWithDialog = async () => {
    if (!selectedReservation) return;
    
    setUpdating(selectedReservation.id);
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'checked-out',
          checked_out_at: new Date().toISOString()
        })
        .eq('id', selectedReservation.id);

      if (error) throw error;

      // Send check-out notification
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.functions.invoke('send-checkout-notification', {
          body: { reservationId: selectedReservation.id, userId: user?.id }
        });
      } catch (notifError) {
        console.error('Failed to send check-out notification:', notifError);
      }

      toast({
        title: "Guest checked out",
        description: "Check-out completed successfully",
      });

      fetchStats();
      // Refresh the dialog data
      if (dialogOpen) {
        const currentType = dialogTitle.includes('Arrivals') ? 'arrivals' : 
                            dialogTitle.includes('Departures') ? 'departures' : 
                            dialogTitle.includes('In-House') ? 'inhouse' : 'departures';
        handleCardClick(currentType);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
      setCheckOutDialogOpen(false);
      setSelectedReservation(null);
    }
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
      const checkoutTimestamp = new Date().toISOString();
      const notificationPromises = Array.from(selectedReservations).map(reservationId =>
        supabase.functions.invoke('send-checkout-notification', {
          body: { reservationId, userId: user?.id, checkedOutAt: checkoutTimestamp }
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
      const currentType = dialogTitle.includes('Arrivals') ? 'arrivals' : 
                          dialogTitle.includes('Departures') ? 'departures' : 
                          dialogTitle.includes('In-House') ? 'inhouse' : 
                          dialogTitle.includes('Cancellations') ? 'cancellations' : 'newbookings';
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

  // Parse arrival time from notes field
  const parseArrivalTimeFromNotes = (notes: string | null): string | null => {
    if (!notes) return null;
    const patterns = [
      /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})[:\.](\d{2})/i,
      /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})\s*(am|pm)/i,
    ];
    for (const pattern of patterns) {
      const match = notes.match(pattern);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutesOrAmPm = match[2];
        if (minutesOrAmPm && /^(am|pm)$/i.test(minutesOrAmPm)) {
          if (minutesOrAmPm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
          if (minutesOrAmPm.toLowerCase() === 'am' && hours === 12) hours = 0;
          return `${hours.toString().padStart(2, '0')}:00`;
        } else {
          return `${hours.toString().padStart(2, '0')}:${minutesOrAmPm}`;
        }
      }
    }
    return null;
  };

  // Get effective arrival time: stored value OR parsed from notes
  const getEffectiveArrivalTime = (reservation: Reservation): string | null => {
    if (reservation.arrival_time) return reservation.arrival_time;
    return parseArrivalTimeFromNotes(reservation.notes);
  };

  const statCards = [
    {
      title: "Today's Arrivals",
      value: stats.todayArrivals,
      icon: LogIn,
      color: 'text-blue-600',
      isRevenue: false,
      type: 'arrivals',
      subtitle: stats.todayArrivals > 0 
        ? `${stats.arrivalsCheckedIn}/${stats.todayArrivals} checked in` 
        : undefined,
    },
    {
      title: "Today's Departures",
      value: stats.todayDepartures,
      icon: LogOut,
      color: 'text-orange-600',
      isRevenue: false,
      type: 'departures',
      subtitle: stats.todayDepartures > 0 
        ? `${stats.departuresCheckedOut}/${stats.todayDepartures} checked out` 
        : undefined,
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
      subtitle: stats.newBookings > 0 
        ? `${stats.newBookingsDirect} Direct (${Math.round((stats.newBookingsDirect / stats.newBookings) * 100)}%) · ${stats.newBookingsBookingCom} Booking.com (${Math.round((stats.newBookingsBookingCom / stats.newBookings) * 100)}%)` 
        : undefined,
    },
    {
      title: 'Recent Cancellations (24h)',
      value: stats.recentCancellations,
      icon: XCircle,
      color: 'text-red-600',
      isRevenue: false,
      type: 'cancellations',
    },
    {
      title: 'Room Transfers',
      value: stats.todayTransfers,
      icon: ArrowRightLeft,
      color: 'text-amber-600',
      isRevenue: false,
      type: 'transfers',
    },
  ];

  return (
    <>
      <PendingAssignmentsAlert />
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleCardClick(stat.type)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="flex items-baseline justify-between">
                  <div className="text-xl sm:text-2xl font-bold">
                    {stat.isRevenue ? `$${stat.value.toFixed(2)}` : stat.value}
                  </div>
                  {stat.subtitle && (
                    <span className="text-xs text-muted-foreground">
                      {stat.subtitle}
                    </span>
                  )}
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
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="sticky top-0 bg-background z-10 pb-4 border-b shrink-0 pr-14">
            <DialogTitle className="flex items-center justify-between">
              <span>{dialogTitle}</span>
              {dialogTitle.includes('Departures') && dialogReservations.length > 0 && (
                <div className="flex items-center gap-2 mr-6">
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
          <div className="space-y-2 overflow-y-auto flex-1 pt-4">
            {dialogLoading ? (
              // Skeleton loaders while data is fetching
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))
            ) : dialogTitle.includes('Room Transfers') ? (
              // Transfer-specific view
              dialogTransfers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No room transfers today</p>
              ) : (
                dialogTransfers.map((transfer, index) => (
                  <Card key={index} className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-lg">{transfer.guestName}</span>
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                            Room Transfer
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex-1 p-3 bg-white rounded-lg border">
                            <p className="text-muted-foreground text-xs">FROM</p>
                            <p className="font-semibold">{transfer.fromRoom}</p>
                            {transfer.fromRoomNumber && (
                              <p className="text-primary">Room #{transfer.fromRoomNumber}</p>
                            )}
                          </div>
                          <ArrowRightLeft className="h-5 w-5 text-amber-600 flex-shrink-0" />
                          <div className="flex-1 p-3 bg-white rounded-lg border">
                            <p className="text-muted-foreground text-xs">TO</p>
                            <p className="font-semibold">{transfer.toRoom}</p>
                            {transfer.toRoomNumber && (
                              <p className="text-primary">Room #{transfer.toRoomNumber}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDialogOpen(false);
                            navigate(`/reservation/${transfer.toReservationId}`);
                          }}
                          className="w-fit"
                        >
                          View Reservation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )
            ) : dialogReservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reservations found</p>
            ) : (
              <>
              {dialogReservations.slice(0, visibleCount).map((reservation) => (
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{reservation.booking_reference}</p>
                          <Badge 
                            variant="outline" 
                            className={statusColors[reservation.status as keyof typeof statusColors]}
                          >
                            {reservation.status}
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className={reservation.channel === 'Booking.com' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-emerald-100 text-emerald-800'}
                          >
                            {reservation.channel === 'Booking.com' ? 'Booking.com' : reservation.source}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              (reservation.channel === 'Booking.com' || reservation.payment_method === 'card')
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }
                          >
                            {reservation.channel === 'Booking.com' ? 'card' : (reservation.payment_method || 'card')}
                          </Badge>
                          {dialogTitle.includes('Arrivals') && (() => {
                            const arrivalTime = getEffectiveArrivalTime(reservation);
                            if (!arrivalTime) return null;
                            return (
                              <Badge
                                variant="outline"
                                className="bg-violet-100 text-violet-800 border-violet-300 gap-1"
                              >
                                <Clock className="h-3 w-3" />
                                Guest arrives at {arrivalTime}
                              </Badge>
                            );
                          })()}
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
                              Checked in: {new Date(reservation.checked_in_at).toLocaleString('en-US', { 
                                timeZone: 'Africa/Cairo',
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
                              })}
                            </p>
                          )}
                          {reservation.checked_out_at && (
                            <p className="text-orange-600 text-xs">
                              Checked out: {new Date(reservation.checked_out_at).toLocaleString('en-US', { 
                                timeZone: 'Africa/Cairo',
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
                              })}
                            </p>
                          )}
                          {reservation.cancelled_at && (
                            <p className="text-red-600 text-xs">
                              Cancelled: {new Date(reservation.cancelled_at).toLocaleString('en-US', { 
                                timeZone: 'Africa/Cairo',
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
                              })}
                            </p>
                          )}
                          <p className="font-semibold">${reservation.total_price?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div className="flex gap-2">
                          {reservation.status === 'confirmed' && dialogTitle.includes('Arrivals') && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/guest-checkin/${reservation.id}`, '_blank');
                              }}
                              className="gap-1 w-full sm:w-auto min-w-[200px]"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Check In (Complete Guest Form)
                            </Button>
                          )}
                          {reservation.status === 'confirmed' && dialogTitle.includes('Departures') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReservation(reservation);
                                setCheckOutDialogOpen(true);
                              }}
                              disabled={updating === reservation.id}
                              className="gap-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Check Out
                            </Button>
                          )}
                          {reservation.status === 'checked-in' && (
                            <>
                              {reservation.check_in_agreements && reservation.check_in_agreements.length > 0 ? (
                                <Badge 
                                  variant="secondary" 
                                  className="bg-green-100 text-green-800 border-green-300 gap-1 cursor-default"
                                >
                                  <FileSignature className="h-3 w-3" />
                                  Form Done
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(`/guest-checkin/${reservation.id}`, '_blank');
                                  }}
                                  className="gap-1"
                                >
                                  <FileSignature className="h-3 w-3" />
                                  Guest Form
                                </Button>
                              )}
                              {/* Only show Check Out on Departures and In-House, NOT Arrivals */}
                              {!dialogTitle.includes('Arrivals') && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedReservation(reservation);
                                    setCheckOutDialogOpen(true);
                                  }}
                                  disabled={updating === reservation.id}
                                  className="gap-1"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Check Out
                                </Button>
                              )}
                            </>
                          )}
                          {dialogTitle.includes('Departures') && (reservation.status === 'checked-out' || reservation.status === 'completed') && (
                            <>
                              <Badge 
                                variant="secondary" 
                                className="bg-green-100 text-green-800 border-green-300 px-4 py-1"
                              >
                                Checked Out
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUndoClick(reservation.id, 'checkout');
                                }}
                                disabled={updating === reservation.id}
                                className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Undo2 className="h-3 w-3" />
                                Undo
                              </Button>
                            </>
                          )}
                          {dialogTitle.includes('Arrivals') && reservation.status === 'checked-in' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUndoClick(reservation.id, 'checkin');
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
              ))}
              {visibleCount < dialogReservations.length && (
                <div
                  ref={sentinelRef}
                  className="py-4 text-center"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(prev => prev + 10)}
                  >
                    Show more ({dialogReservations.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo Confirmation Dialog */}
      <AlertDialog open={undoConfirmOpen} onOpenChange={setUndoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {undoType === 'checkout' ? 'Undo Check-Out' : 'Undo Check-In'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {undoType === 'checkout' 
                ? "This will restore the guest's status to checked-in. Do you want to send a check-in notification email to admins?"
                : "This will restore the guest's status to confirmed and clear the check-in timestamp. Do you want to send a notification email?"
              }
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

      {/* Check-In Dialog */}
      <CheckInDialog
        open={checkInDialogOpen}
        onOpenChange={setCheckInDialogOpen}
        reservation={selectedReservation}
        onConfirm={(accessCards) => {
          if (selectedReservation) {
            handleCheckInWithCards(selectedReservation.id, accessCards);
          }
        }}
        loading={updating === selectedReservation?.id}
      />

      {/* Check-Out Dialog */}
      <CheckOutDialog
        open={checkOutDialogOpen}
        onOpenChange={setCheckOutDialogOpen}
        reservation={selectedReservation}
        onConfirm={handleCheckOutWithDialog}
        loading={updating === selectedReservation?.id}
      />
    </>
  );
};

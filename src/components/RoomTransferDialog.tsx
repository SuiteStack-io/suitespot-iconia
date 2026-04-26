import { useState, useEffect } from 'react';
import { format, differenceInDays, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarIcon, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';

interface Reservation {
  id: string;
  booking_reference: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  guest_names: string[];
  guest_nationality: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  total_price: number;
  price_per_night: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  net_revenue: number | null;
  currency: string;
  channel: string;
  source: string;
  status: string;
  notes: string | null;
  group_id: string | null;
  adults: number | null;
  children: number | null;
  guest_types: string[] | null;
  guest_genders: string[] | null;
  guest_ages: number[] | null;
  units: { name: string; booking_com_name: string | null; unit_number: string | null } | null;
}

interface Unit {
  id: string;
  name: string;
  booking_com_name: string | null;
  unit_number: string | null;
  status: string;
}

interface RoomTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation;
  onSuccess: () => void;
}

export function RoomTransferDialog({
  open,
  onOpenChange,
  reservation,
  onSuccess,
}: RoomTransferDialogProps) {
  const propertyId = usePropertyId();
  const [transferDate, setTransferDate] = useState<Date | undefined>();
  const [newUnitId, setNewUnitId] = useState<string>('');
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const checkInDate = new Date(reservation.check_in_date);
  const checkOutDate = new Date(reservation.check_out_date);
  const totalNights = reservation.nights || differenceInDays(checkOutDate, checkInDate);
  const pricePerNight = reservation.price_per_night || (reservation.total_price / totalNights);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTransferDate(undefined);
      setNewUnitId('');
      setAvailableUnits([]);
    }
  }, [open]);

  // Fetch available units when transfer date is selected
  useEffect(() => {
    if (transferDate) {
      fetchAvailableUnits();
    }
  }, [transferDate]);

  const fetchAvailableUnits = async () => {
    if (!transferDate) return;

    setLoading(true);
    try {
      // Get all units
      const { data: allUnits, error: unitsError } = await withPropertyFilter(supabase
        .from('units')
        .select('id, name, booking_com_name, unit_number, status')
        .eq('status', 'available'), propertyId)
        .order('name');

      if (unitsError) throw unitsError;

      // Check availability for each unit for the transfer period
      const transferDateStr = format(transferDate, 'yyyy-MM-dd');
      const checkOutDateStr = format(checkOutDate, 'yyyy-MM-dd');

      const availableUnitsList: Unit[] = [];

      for (const unit of allUnits || []) {
        // Skip current unit
        if (unit.id === reservation.unit_id) continue;

        // Check for conflicts
        const { data: conflicts } = await supabase.rpc('check_reservation_overlap', {
          p_unit_id: unit.id,
          p_check_in_date: transferDateStr,
          p_check_out_date: checkOutDateStr,
          p_exclude_id: null
        });

        // Check for blocked dates
        const { data: blockedDates } = await supabase
          .from('blocked_dates')
          .select('id')
          .eq('unit_id', unit.id)
          .gte('blocked_date', transferDateStr)
          .lt('blocked_date', checkOutDateStr);

        const hasConflict = conflicts && conflicts.length > 0;
        const hasBlockedDates = blockedDates && blockedDates.length > 0;

        if (!hasConflict && !hasBlockedDates) {
          availableUnitsList.push(unit);
        }
      }

      setAvailableUnits(availableUnitsList);
    } catch (error) {
      console.error('Error fetching available units:', error);
      toast.error('Failed to check room availability');
    } finally {
      setLoading(false);
    }
  };

  const segment1Nights = transferDate ? differenceInDays(transferDate, checkInDate) : 0;
  const segment2Nights = transferDate ? differenceInDays(checkOutDate, transferDate) : 0;

  const segment1Total = pricePerNight * segment1Nights;
  const segment2Total = pricePerNight * segment2Nights;

  const segment1Commission = segment1Total * ((reservation.commission_rate || 10) / 100);
  const segment2Commission = segment2Total * ((reservation.commission_rate || 10) / 100);

  const segment1NetRevenue = segment1Total - segment1Commission;
  const segment2NetRevenue = segment2Total - segment2Commission;

  const selectedUnit = availableUnits.find(u => u.id === newUnitId);

  const canConfirm = transferDate && newUnitId && segment1Nights > 0 && segment2Nights > 0;

  const handleConfirmTransfer = async () => {
    if (!transferDate || !newUnitId) return;

    setSaving(true);
    try {
      // Generate group_id if not already exists
      const groupId = reservation.group_id || crypto.randomUUID();
      const transferDateStr = format(transferDate, 'yyyy-MM-dd');

      // Get the new unit details
      const { data: newUnit } = await supabase
        .from('units')
        .select('name, booking_com_name, unit_number')
        .eq('id', newUnitId)
        .single();

      // 1. Update original reservation (shorten to segment 1)
      const { error: updateError } = await supabase
        .from('reservations')
        .update({
          check_out_date: transferDateStr,
          nights: segment1Nights,
          total_price: segment1Total,
          price_per_night: pricePerNight,
          commission_amount: segment1Commission,
          net_revenue: segment1NetRevenue,
          group_id: groupId,
          notes: `Room transfer on ${format(transferDate, 'MMM d')} to ${newUnit?.booking_com_name || newUnit?.name || 'new room'}${newUnit?.unit_number ? ` (#${newUnit.unit_number})` : ''}. ${reservation.notes || ''}`.trim(),
        })
        .eq('id', reservation.id);

      if (updateError) throw updateError;

      // 2. Create new reservation for segment 2
      const { data: newSegment, error: insertError } = await supabase
        .from('reservations')
        .insert({
          booking_reference: `${reservation.booking_reference}-B`,
          check_in_date: transferDateStr,
          check_out_date: reservation.check_out_date,
          nights: segment2Nights,
          unit_id: newUnitId,
          number_of_guests: reservation.number_of_guests,
          adults: reservation.adults,
          children: reservation.children,
          guest_names: reservation.guest_names,
          guest_types: reservation.guest_types,
          guest_genders: reservation.guest_genders,
          guest_ages: reservation.guest_ages,
          guest_nationality: reservation.guest_nationality,
          contact_email: reservation.contact_email,
          contact_phone: reservation.contact_phone,
          total_price: segment2Total,
          price_per_night: pricePerNight,
          commission_rate: reservation.commission_rate,
          commission_amount: segment2Commission,
          net_revenue: segment2NetRevenue,
          currency: reservation.currency,
          channel: reservation.channel,
          source: reservation.source,
          status: reservation.status,
          group_id: groupId,
          notes: `Room transfer from ${reservation.units?.name || 'previous room'}${reservation.units?.unit_number ? ` (#${reservation.units.unit_number})` : ''}. Original booking: ${reservation.booking_reference}`,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // 2b. Log manual mid-stay transfer to room_shuffle_log (do not block on failure)
      try {
        const { error: logError } = await supabase.from('room_shuffle_log').insert({
          triggered_by_booking_id: reservation.id,
          triggered_by_reference: reservation.booking_reference ?? reservation.id,
          room_type: (reservation.units?.booking_com_name ?? reservation.units?.name) || 'Unknown',
          moves: [{
            reservation_id: newSegment?.id ?? reservation.id,
            guest_name: reservation.guest_names?.[0] ?? 'Guest',
            from_unit_id: reservation.unit_id,
            from_unit_number: reservation.units?.unit_number ?? '',
            to_unit_id: newUnitId,
            to_unit_number: newUnit?.unit_number ?? '',
            check_in_date: transferDateStr,
            check_out_date: reservation.check_out_date,
          }],
          move_count: 1,
          reason: 'Manual mid-stay transfer',
          change_type: 'manual',
        });
        if (logError) console.error('Failed to log manual room change:', logError);
      } catch (logErr) {
        console.error('Failed to log manual room change:', logErr);
      }

      // 3. Send room change notification
      try {
        await supabase.functions.invoke('send-room-change-notification', {
          body: {
            guestName: reservation.guest_names[0] || 'Guest',
            bookingReference: reservation.booking_reference,
            originalRoom: reservation.units?.booking_com_name || reservation.units?.name || 'N/A',
            originalUnit: reservation.units?.unit_number || 'N/A',
            newRoom: newUnit?.booking_com_name || newUnit?.name || 'N/A',
            newUnit: newUnit?.unit_number || 'N/A',
            transferDate: format(transferDate, 'MMMM d, yyyy'),
            checkIn: format(checkInDate, 'MMMM d, yyyy'),
            checkOut: format(checkOutDate, 'MMMM d, yyyy'),
            source: reservation.source,
          },
        });
      } catch (notifError) {
        console.error('Failed to send notification:', notifError);
        // Don't fail the whole operation for notification error
      }

      toast.success('Room transfer completed successfully');
      onSuccess();
    } catch (error) {
      console.error('Error creating room transfer:', error);
      toast.error('Failed to complete room transfer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Room Transfer</DialogTitle>
          <DialogDescription>
            Split this reservation between two rooms
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Booking Info */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="font-semibold text-sm">Current Booking</p>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Room:</span>{' '}
                {reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}
                {reservation.units?.unit_number && ` (#${reservation.units.unit_number})`}
              </p>
              <p>
                <span className="text-muted-foreground">Dates:</span>{' '}
                {format(checkInDate, 'MMM d')} – {format(checkOutDate, 'MMM d, yyyy')}
              </p>
              <p>
                <span className="text-muted-foreground">Duration:</span>{' '}
                {totalNights} nights
              </p>
              <p>
                <span className="text-muted-foreground">Total:</span>{' '}
                {reservation.currency} {reservation.total_price.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Transfer Date Selection */}
          <div className="space-y-2">
            <Label>Transfer Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !transferDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {transferDate ? format(transferDate, 'MMMM d, yyyy') : 'Select transfer date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={transferDate}
                  onSelect={(date) => {
                    setTransferDate(date);
                    setCalendarOpen(false);
                    setNewUnitId(''); // Reset room selection when date changes
                  }}
                  disabled={(date) =>
                    date <= checkInDate || date >= checkOutDate
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Guest will move to a new room on this date
            </p>
          </div>

          {/* New Room Selection */}
          {transferDate && (
            <div className="space-y-2">
              <Label>New Room (from {format(transferDate, 'MMM d')})</Label>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Checking availability...</span>
                </div>
              ) : availableUnits.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">No rooms available for this period</span>
                </div>
              ) : (
                <>
                  <Select value={newUnitId} onValueChange={setNewUnitId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUnits.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.booking_com_name || unit.name}
                          {unit.unit_number && ` (#${unit.unit_number})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {availableUnits.length} room{availableUnits.length !== 1 ? 's' : ''} available
                  </p>
                </>
              )}
            </div>
          )}

          {/* Split Summary */}
          {transferDate && newUnitId && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-3">
                <p className="font-semibold text-sm">Split Summary</p>

                {/* Segment 1 */}
                <div className="flex items-start gap-2">
                  <div className="w-1 h-full bg-primary rounded-full" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">
                      Segment 1: {reservation.units?.booking_com_name || reservation.units?.name || 'Current Room'}
                      {reservation.units?.unit_number && ` (#${reservation.units.unit_number})`}
                    </p>
                    <p className="text-muted-foreground">
                      {format(checkInDate, 'MMM d')} → {format(transferDate, 'MMM d')} ({segment1Nights} night{segment1Nights !== 1 ? 's' : ''})
                    </p>
                    <p className="text-muted-foreground">
                      {reservation.currency} {segment1Total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Segment 2 */}
                <div className="flex items-start gap-2">
                  <div className="w-1 h-full bg-primary rounded-full" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">
                      Segment 2: {selectedUnit?.booking_com_name || selectedUnit?.name || 'New Room'}
                      {selectedUnit?.unit_number && ` (#${selectedUnit.unit_number})`}
                    </p>
                    <p className="text-muted-foreground">
                      {format(transferDate, 'MMM d')} → {format(checkOutDate, 'MMM d')} ({segment2Nights} night{segment2Nights !== 1 ? 's' : ''})
                    </p>
                    <p className="text-muted-foreground">
                      {reservation.currency} {segment2Total.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Total unchanged:</span>
                    <span>{reservation.currency} {reservation.total_price.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmTransfer}
            disabled={!canConfirm || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm Transfer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

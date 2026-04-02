import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface UseLateCheckoutParams {
  reservationId: string;
  unitId: string | null;
  unitName: string;
  checkoutDate: string;
}

interface FeeOptions {
  feeEnabled?: boolean;
  feeAmount?: number;
  fullReservation?: any;
  currentUserName?: string;
  bookingReference?: string;
}

export const useLateCheckout = ({
  reservationId,
  unitId,
  unitName,
  checkoutDate,
}: UseLateCheckoutParams) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const applyLateCheckout = async (time: string, feeOptions?: FeeOptions): Promise<{ success: boolean; error?: string }> => {
    if (!unitId) return { success: false, error: 'No unit assigned' };
    setLoading(true);
    try {
      // Insert block entry for the checkout date
      const { error: blockError } = await supabase
        .from('blocked_dates')
        .insert({
          unit_id: unitId,
          blocked_date: checkoutDate,
          reason: `Late checkout - ${time}`,
          created_by: user?.id || null,
        });

      if (blockError) throw blockError;

      // Update reservation with late_checkout_time
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ late_checkout_time: time } as any)
        .eq('id', reservationId);

      if (updateError) throw updateError;

      // Create fee reservation if enabled
      if (feeOptions?.feeEnabled && feeOptions.feeAmount && feeOptions.feeAmount > 0 && feeOptions.fullReservation) {
        const fullRes = feeOptions.fullReservation;
        const feeAmt = feeOptions.feeAmount;
        const baseAmount = feeAmt / 1.14;
        const commissionRate = 10;
        const commissionAmount = baseAmount * (commissionRate / 100);
        const netRevenue = feeAmt - commissionAmount;

        const groupId = fullRes.group_id || crypto.randomUUID();
        const bookingRef = feeOptions.bookingReference || fullRes.booking_reference || 'UNKNOWN';

        const lateCheckoutReservation = {
          unit_id: unitId,
          check_in_date: checkoutDate,
          check_out_date: checkoutDate,
          guest_names: fullRes.guest_names || [],
          contact_email: fullRes.contact_email || null,
          contact_phone: fullRes.contact_phone || null,
          booking_reference: `${bookingRef}-LC`,
          source: feeOptions.currentUserName || 'Admin',
          channel: 'Direct',
          status: fullRes.status || 'confirmed',
          number_of_guests: fullRes.number_of_guests || 1,
          adults: fullRes.adults || 1,
          children: fullRes.children || 0,
          guest_nationality: fullRes.guest_nationality || null,
          total_price: feeAmt,
          price_per_night: 0,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          net_revenue: netRevenue,
          group_id: groupId,
          currency: fullRes.currency || 'USD',
          notes: `Late checkout fee for booking ${bookingRef}`,
          property_id: fullRes.property_id || null,
          skip_channex_sync: true,
        };

        const { data: insertResult, error: insertError } = await supabase
          .from('reservations')
          .insert(lateCheckoutReservation)
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Update original reservation's group_id if not already set
        if (!fullRes.group_id) {
          await supabase
            .from('reservations')
            .update({ group_id: groupId })
            .eq('id', reservationId);
        }

        // Send notification (non-blocking)
        try {
          await supabase.functions.invoke('send-late-checkout-notification', {
            body: {
              lateCheckoutReservationId: insertResult.id,
              originalBookingReference: bookingRef,
            },
          });
        } catch (notifError) {
          console.error('Failed to send late checkout notification:', notifError);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to apply late checkout' };
    } finally {
      setLoading(false);
    }
  };

  const removeLateCheckout = async (): Promise<{ success: boolean; error?: string }> => {
    if (!unitId) return { success: false, error: 'No unit assigned' };
    setLoading(true);
    try {
      // Delete ONLY late checkout blocks for this specific unit and date
      const { error: deleteError } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('unit_id', unitId)
        .eq('blocked_date', checkoutDate)
        .ilike('reason', 'Late checkout%');

      if (deleteError) throw deleteError;

      // Clear late_checkout_time from reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ late_checkout_time: null } as any)
        .eq('id', reservationId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to remove late checkout' };
    } finally {
      setLoading(false);
    }
  };

  return { applyLateCheckout, removeLateCheckout, loading };
};

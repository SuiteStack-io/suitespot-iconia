import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface UseLateCheckoutParams {
  reservationId: string;
  unitId: string | null;
  unitName: string;
  checkoutDate: string;
}

export const useLateCheckout = ({
  reservationId,
  unitId,
  unitName,
  checkoutDate,
}: UseLateCheckoutParams) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const applyLateCheckout = async (time: string): Promise<{ success: boolean; error?: string }> => {
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

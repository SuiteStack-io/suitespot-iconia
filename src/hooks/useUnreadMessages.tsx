import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePropertySafe } from '@/lib/propertyContext';

export function useUnreadMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const propertyCtx = usePropertySafe();
  const propertyId = propertyCtx?.activeProperty?.id ?? null;

  const fetchCount = useCallback(async () => {
    let query = supabase
      .from('message_threads')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { count } = await query;
    setUnreadCount(count ?? 0);
  }, [propertyId]);

  useEffect(() => {
    fetchCount();

    const filter = propertyId
      ? `property_id=eq.${propertyId}`
      : undefined;

    const channel = supabase
      .channel('unread-messages-badge')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_threads',
          ...(filter ? { filter } : {}),
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCount, propertyId]);

  return { unreadCount };
}

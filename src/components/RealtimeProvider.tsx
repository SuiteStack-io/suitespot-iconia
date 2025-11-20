import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

interface RealtimeContextType {
  requestPermission: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
};

interface RealtimeProviderProps {
  children: ReactNode;
}

export const RealtimeProvider = ({ children }: RealtimeProviderProps) => {
  const { 
    requestPermission,
    subscribeToNotifications,
    subscribeToTickets,
    subscribeToReservations 
  } = useNotifications();

  useEffect(() => {
    // Subscribe to all real-time channels
    const unsubscribeNotifications = subscribeToNotifications();
    const unsubscribeTickets = subscribeToTickets();
    const unsubscribeReservations = subscribeToReservations();

    console.log('Real-time subscriptions initialized');

    return () => {
      unsubscribeNotifications();
      unsubscribeTickets();
      unsubscribeReservations();
      console.log('Real-time subscriptions cleaned up');
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ requestPermission }}>
      {children}
    </RealtimeContext.Provider>
  );
};

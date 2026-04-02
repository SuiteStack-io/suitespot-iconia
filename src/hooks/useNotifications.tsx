import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: any;
}

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.read).length || 0);
  };

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Browser notifications enabled!");
      }
    }
  };

  const sendBrowserNotification = (title: string, body: string, icon?: string) => {
    if (permission === "granted") {
      new Notification(title, {
        body,
        icon: icon || "/suitespot-logo-3.png",
        badge: "/suitespot-logo-3.png",
      });
    }
  };

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          console.log('New notification received:', newNotification);
          
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast
          toast(newNotification.title, {
            description: newNotification.message,
            action: {
              label: 'View',
              onClick: () => console.log('View notification', newNotification.id),
            },
          });

          // Send browser notification
          sendBrowserNotification(newNotification.title, newNotification.message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToTickets = () => {
    const channel = supabase
      .channel("ticket-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "guest_tickets",
        },
        (payload) => {
          const ticket = payload.new as any;
          sendBrowserNotification(
            "New Ticket Created",
            `${ticket.title} - Priority: ${ticket.priority}`
          );
          toast.info("New ticket created", {
            description: ticket.title,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "guest_tickets",
        },
        (payload) => {
          const ticket = payload.new as any;
          const oldTicket = payload.old as any;
          
          if (ticket.status === "resolved" && oldTicket.status !== "resolved") {
            sendBrowserNotification(
              "Ticket Resolved",
              `${ticket.title} has been resolved`
            );
            toast.success("Ticket resolved", {
              description: ticket.title,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const subscribeToReservations = () => {
    const channel = supabase
      .channel("reservation-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reservations",
        },
        (payload) => {
          const reservation = payload.new as any;
          if (reservation.status === 'confirmed') {
            sendBrowserNotification(
              "New Reservation",
              `${reservation.guest_names[0]} - ${reservation.check_in_date}`
            );
            toast.success("New reservation received", {
              description: `${reservation.guest_names[0]} checking in on ${reservation.check_in_date}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }

    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', unreadIds);

    if (error) {
      console.error('Error marking all as read:', error);
      return;
    }

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return {
    permission,
    notifications,
    unreadCount,
    requestPermission,
    sendBrowserNotification,
    subscribeToNotifications,
    subscribeToTickets,
    subscribeToReservations,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  };
};

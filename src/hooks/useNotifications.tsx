import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notifications enabled!");
      }
    }
  };

  const sendNotification = (title: string, body: string) => {
    if (permission === "granted") {
      new Notification(title, {
        body,
        icon: "/suitespot-logo-3.png",
        badge: "/suitespot-logo-3.png",
      });
    }
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
          sendNotification(
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
          if (ticket.status === "resolved") {
            sendNotification(
              "Ticket Resolved",
              `${ticket.title} has been resolved`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    permission,
    requestPermission,
    sendNotification,
    subscribeToTickets,
  };
};

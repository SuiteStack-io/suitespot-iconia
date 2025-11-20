import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";


interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: any;
}

export const NotificationBell = () => {
  const { 
    notifications, 
    unreadCount, 
    subscribeToNotifications,
    subscribeToTickets,
    subscribeToReservations,
    markAsRead,
    markAllAsRead 
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const unsubscribeNotifications = subscribeToNotifications();
    const unsubscribeTickets = subscribeToTickets();
    const unsubscribeReservations = subscribeToReservations();

    return () => {
      unsubscribeNotifications();
      unsubscribeTickets();
      unsubscribeReservations();
    };
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    setDialogOpen(true);
    setOpen(false);
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const formatMetadata = (metadata: any) => {
    if (!metadata) return null;

    const fields: { label: string; value: string }[] = [];

    if (metadata.check_in) {
      fields.push({
        label: "Check-in Date",
        value: format(new Date(metadata.check_in), "MMMM d, yyyy"),
      });
    }

    if (metadata.check_out) {
      fields.push({
        label: "Check-out Date",
        value: format(new Date(metadata.check_out), "MMMM d, yyyy"),
      });
    }

    if (metadata.old_room) {
      fields.push({
        label: "Previous Room",
        value: `Room ${metadata.old_room}`,
      });
    }

    if (metadata.new_room) {
      fields.push({
        label: "New Room",
        value: `Room ${metadata.new_room}`,
      });
    }

    if (metadata.source || metadata.channel) {
      fields.push({
        label: "Booking Source",
        value: metadata.channel || metadata.source,
      });
    }

    // Handle any other fields that might exist
    Object.keys(metadata).forEach((key) => {
      if (!['check_in', 'check_out', 'old_room', 'new_room', 'source', 'channel', 'reservation_id', 'booking_reference', 'booking_com_room_id', 'units_checked'].includes(key)) {
        fields.push({
          label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: String(metadata[key]),
        });
      }
    });

    return fields;
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-8 text-xs"
              >
                Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="h-96">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-accent transition-colors ${
                      !notification.read ? 'bg-accent/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 ${getNotificationColor(notification.type)}`}>
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={selectedNotification ? getNotificationColor(selectedNotification.type) : ''}>
                <Bell className="h-5 w-5" />
              </div>
              {selectedNotification?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedNotification && formatDistanceToNow(new Date(selectedNotification.created_at), {
                addSuffix: true,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm leading-relaxed">
              {selectedNotification?.message}
            </div>
            {selectedNotification?.metadata && formatMetadata(selectedNotification.metadata) && (
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-semibold mb-3 text-foreground">Additional Information</p>
                <div className="space-y-2">
                  {formatMetadata(selectedNotification.metadata)?.map((field, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        {field.label}
                      </span>
                      <span className="text-sm text-foreground">
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePropertyId } from "@/hooks/usePropertyFilter";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";
import { ArrowLeft, MessageCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationPanel } from "@/components/inbox/ConversationPanel";

interface MessageThread {
  id: string;
  channex_thread_id: string;
  channex_booking_id: string | null;
  title: string | null;
  provider: string;
  is_read: boolean | null;
  is_closed: boolean | null;
  last_message_text: string | null;
  last_message_sender: string | null;
  last_message_at: string | null;
  message_count: number | null;
  reservation_id: string | null;
  property_id: string | null;
  created_at: string | null;
}

const OTA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AirBNB: { label: "Airbnb", color: "text-white", bg: "bg-[#FF5A5F]" },
  BookingCom: { label: "Booking.com", color: "text-white", bg: "bg-[#003580]" },
  Expedia: { label: "Expedia", color: "text-black", bg: "bg-[#FEBA02]" },
};

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function GuestInbox() {
  const navigate = useNavigate();
  const { userRole, hasPermission } = useAuth();
  const isMobile = useIsMobile();
  const propertyId = usePropertyId();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  const fetchThreads = useCallback(async () => {
    let query = supabase
      .from("message_threads")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    const { data, error } = await query;

    if (!error && data) {
      setThreads(data as MessageThread[]);
    }
    setLoading(false);
  }, [propertyId]);

  useEffect(() => {
    fetchThreads();

    const channelConfig: any = { event: "*", schema: "public", table: "message_threads" };
    if (propertyId) {
      channelConfig.filter = `property_id=eq.${propertyId}`;
    }

    const channel = supabase
      .channel(`inbox-threads-${propertyId || "all"}`)
      .on("postgres_changes", channelConfig, () => fetchThreads())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchThreads, propertyId]);

  const unreadCount = threads.filter((t) => !t.is_read).length;

  const filteredThreads = threads.filter((t) => {
    if (activeTab === "unread") return !t.is_read;
    if (activeTab === "airbnb") return t.provider === "AirBNB";
    if (activeTab === "bookingcom") return t.provider === "BookingCom";
    if (activeTab === "expedia") return t.provider === "Expedia";
    return true;
  });

  const otaInfo = (provider: string) =>
    OTA_CONFIG[provider] || { label: provider, color: "text-foreground", bg: "bg-muted" };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <SlideMenu userRole={userRole} />
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Guest Inbox</h1>
          </div>
        </div>
        <div className="mt-2">
          <AdminBreadcrumb
            section="ICONIA"
            currentPage="Guest Inbox"
          />
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="border-b border-border bg-card px-4 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread" className="gap-1.5">
              Unread
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="airbnb">Airbnb</TabsTrigger>
            <TabsTrigger value="bookingcom">Booking.com</TabsTrigger>
            <TabsTrigger value="expedia">Expedia</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex h-[calc(100vh-140px)]">
        {/* Thread List - hidden on mobile when a thread is selected */}
        {(!isMobile || !selectedThreadId) && (
          <div
            className={cn(
              "border-r border-border overflow-y-auto",
              isMobile ? "w-full" : "w-[40%]"
            )}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageCircle className="h-10 w-10 mb-2" />
                <p className="text-sm">No conversations found</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const ota = otaInfo(thread.provider);
                const isUnread = !thread.is_read;
                const isSelected = selectedThreadId === thread.id;

                return (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-accent/50",
                      isSelected && "bg-accent",
                      isUnread && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-1.5">
                        {isUnread ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                        ) : (
                          <div className="h-2.5 w-2.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", ota.bg, ota.color)}>
                            {ota.label}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {getRelativeTime(thread.last_message_at)}
                          </span>
                        </div>
                        <p className={cn("text-sm truncate", isUnread ? "font-semibold text-foreground" : "text-foreground")}>
                          {thread.title || "Unknown Guest"}
                        </p>
                        <p className={cn("text-xs truncate mt-0.5", isUnread ? "font-medium text-foreground/80" : "text-muted-foreground")}>
                          {thread.last_message_sender === "property" && "You: "}
                          {thread.last_message_text
                            ? thread.last_message_text.slice(0, 80) + (thread.last_message_text.length > 80 ? "…" : "")
                            : "No messages yet"}
                        </p>
                        {thread.reservation_id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/reservation/${thread.reservation_id}`);
                            }}
                            className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Reservation
                          </button>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Right Panel - Conversation or placeholder */}
        {(!isMobile || selectedThreadId) && (
          <div className={cn("flex-1", isMobile && "w-full")}>
            {selectedThread ? (
              <ConversationPanel
                thread={selectedThread}
                onBack={() => setSelectedThreadId(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Select a conversation to view messages</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

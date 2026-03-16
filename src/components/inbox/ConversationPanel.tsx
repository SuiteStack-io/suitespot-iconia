import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, Send, RefreshCw, ArrowLeft, ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Json } from "@/integrations/supabase/types";

const OTA_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AirBNB: { label: "Airbnb", color: "text-white", bg: "bg-[#FF5A5F]" },
  BookingCom: { label: "Booking.com", color: "text-white", bg: "bg-[#003580]" },
  Expedia: { label: "Expedia", color: "text-black", bg: "bg-[#FEBA02]" },
};

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

interface Message {
  id: string;
  thread_id: string;
  channex_message_id: string | null;
  message: string | null;
  sender: string;
  attachments: Json | null;
  channex_sent_at: string | null;
  created_at: string | null;
  _status?: "sending" | "sent" | "failed";
  _tempId?: string;
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface Attachment {
  url?: string;
  file_name?: string;
  content_type?: string;
}

function parseAttachments(attachments: Json | null): Attachment[] {
  if (!attachments || !Array.isArray(attachments)) return [];
  return attachments as Attachment[];
}

interface ConversationPanelProps {
  thread: MessageThread;
  onBack?: () => void;
}

export function ConversationPanel({ thread, onBack }: ConversationPanelProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ota = OTA_CONFIG[thread.provider] || { label: thread.provider, color: "text-foreground", bg: "bg-muted" };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Fetch messages & mark read
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setMessages([]);
      setReplyText("");

      // Mark read
      supabase
        .from("message_threads")
        .update({ is_read: true })
        .eq("id", thread.id)
        .then(() => {});

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      if (!cancelled && !error && data) {
        setMessages(data.map((m) => ({ ...m, _status: "sent" as const })));
      }
      if (!cancelled) setLoading(false);
    };

    load();

    // Realtime
    const channel = supabase
      .channel(`conv-${thread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${thread.id}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Skip if already present (optimistic or duplicate)
            if (prev.some((m) => m.id === newMsg.id || (m.channex_message_id && m.channex_message_id === newMsg.channex_message_id))) {
              return prev;
            }
            return [...prev, { ...newMsg, _status: "sent" }];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [thread.id, scrollToBottom]);

  // Scroll to bottom when messages load
  useEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom();
  }, [loading, messages.length, scrollToBottom]);

  const handleSend = async () => {
    const text = replyText.trim();
    if (!text || sending) return;

    if (!thread.channex_booking_id) {
      toast({ title: "Error", description: "No booking linked to this thread", variant: "destructive" });
      return;
    }

    const tempId = crypto.randomUUID();
    const optimistic: Message = {
      id: tempId,
      _tempId: tempId,
      thread_id: thread.id,
      channex_message_id: null,
      message: text,
      sender: "property",
      attachments: null,
      channex_sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      _status: "sending",
    };

    setMessages((prev) => [...prev, optimistic]);
    setReplyText("");
    setSending(true);
    scrollToBottom();

    const { data, error } = await supabase.functions.invoke("channex-send-message", {
      body: { booking_id: thread.channex_booking_id, message: text },
    });

    setSending(false);

    if (error || !data?.success) {
      const errMsg = data?.error || error?.message || "Failed to send message";
      toast({ title: "Send failed", description: errMsg, variant: "destructive" });
      setMessages((prev) =>
        prev.map((m) => (m._tempId === tempId ? { ...m, _status: "failed" as const } : m))
      );
      return;
    }

    // Replace optimistic with confirmed
    setMessages((prev) =>
      prev.map((m) =>
        m._tempId === tempId
          ? { ...m, _status: "sent" as const, id: data.message_id || m.id, channex_message_id: data.message_id }
          : m
      )
    );
  };

  const handleRetry = (tempId: string) => {
    const msg = messages.find((m) => m._tempId === tempId);
    if (!msg?.message) return;
    setMessages((prev) => prev.filter((m) => m._tempId !== tempId));
    setReplyText(msg.message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messagingUnsupported = !thread.channex_booking_id;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3 shrink-0">
        {(isMobile || onBack) && (
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {thread.title || "Unknown Guest"}
            </h2>
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0", ota.bg, ota.color)}>
              {ota.label}
            </span>
            <Badge variant={thread.is_closed ? "secondary" : "default"} className="text-[10px] shrink-0">
              {thread.is_closed ? "Closed" : "Open"}
            </Badge>
          </div>
          {thread.reservation_id && (
            <button
              onClick={() => navigate(`/reservation/${thread.reservation_id}`)}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
            >
              <ExternalLink className="h-3 w-3" />
              View Reservation
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 bg-white">
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No messages yet</p>
          ) : (
            messages.map((msg, idx) => {
              const isProperty = msg.sender === "property";
              const attachments = parseAttachments(msg.attachments);
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isSameSender = prevMsg?.sender === msg.sender;
              const showOtaLabel = !isProperty && (!prevMsg || prevMsg.sender !== msg.sender);

              return (
                <div
                  key={msg._tempId || msg.id}
                  className={cn(
                    "flex flex-col",
                    isProperty ? "items-end" : "items-start",
                    isSameSender ? "mt-1" : idx === 0 ? "" : "mt-3"
                  )}
                >
                  {showOtaLabel && (
                    <p className="text-[11px] text-gray-400 mb-1 px-2">
                      Guest via {ota.label}
                    </p>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] py-[10px] px-[16px] text-[15px] text-white",
                      isProperty
                        ? "bg-[#007AFF] rounded-[18px] rounded-br-[6px]"
                        : "bg-[#2C2C2E] rounded-[18px] rounded-bl-[6px]"
                    )}
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                    {attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {attachments.map((att, i) => {
                          const isImage = att.content_type?.startsWith("image/");
                          return (
                            <a
                              key={i}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-white/80 underline"
                            >
                              {isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                              {att.file_name || "Attachment"}
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className={cn("flex items-center gap-1.5 mt-0.5 px-2", isProperty ? "justify-end" : "justify-start")}>
                    <span className="text-[11px] text-gray-400">
                      {formatTimestamp(msg.channex_sent_at || msg.created_at)}
                    </span>
                    {msg._status === "sending" && (
                      <span className="text-[11px] italic text-gray-400">Sending…</span>
                    )}
                    {msg._status === "failed" && (
                      <button
                        onClick={() => msg._tempId && handleRetry(msg._tempId)}
                        className="flex items-center gap-0.5 text-[11px] text-destructive hover:underline"
                      >
                        <RefreshCw className="h-2.5 w-2.5" /> Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Reply input */}
      <div className="border-t border-border bg-gray-100 px-4 py-3 shrink-0">
        {thread.is_closed ? (
          <p className="text-sm text-muted-foreground text-center py-1">This conversation is closed</p>
        ) : messagingUnsupported ? (
          <p className="text-sm text-muted-foreground text-center py-1">Messaging not supported for this OTA</p>
        ) : (
          <div className="flex items-center gap-2">
            <Textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="min-h-[40px] max-h-[40px] resize-none rounded-full border-gray-300 bg-white px-4 py-2 text-[15px]"
              rows={1}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!replyText.trim() || sending}
              className="shrink-0 h-9 w-9 rounded-full bg-[#007AFF] text-white flex items-center justify-center disabled:opacity-40 hover:bg-[#0066DD] transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

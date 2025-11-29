import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, XCircle, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/lib/auth";
import { SlideMenu } from "@/components/SlideMenu";

interface SelectionSession {
  id: string;
  username: string;
  guest_name: string;
  guest_contact: string | null;
  first_access_at: string | null;
  session_expires_at: string | null;
  is_active: boolean;
  kyc_link_id: string;
}

export default function SelectionSessions() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [sessions, setSessions] = useState<SelectionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("selection_accounts")
        .select(`
          id,
          username,
          first_access_at,
          session_expires_at,
          is_active,
          kyc_link_id,
          kyc_links!inner (
            guest_name,
            guest_contact
          )
        `)
        .order("first_access_at", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const formattedSessions = data.map((session: any) => ({
        id: session.id,
        username: session.username,
        guest_name: session.kyc_links.guest_name,
        guest_contact: session.kyc_links.guest_contact,
        first_access_at: session.first_access_at,
        session_expires_at: session.session_expires_at,
        is_active: session.is_active,
        kyc_link_id: session.kyc_link_id,
      }));

      setSessions(formattedSessions);
    } catch (error: any) {
      console.error("Error fetching sessions:", error);
      toast({
        title: "Error",
        description: "Failed to load KYC results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const getSessionStatus = (session: SelectionSession) => {
    if (!session.is_active) return "revoked";
    if (!session.first_access_at) return "not-accessed";
    if (!session.session_expires_at) return "active";
    
    const now = new Date();
    const expiryDate = new Date(session.session_expires_at);
    return expiryDate > now ? "active" : "expired";
  };

  const extendSession = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      const oldExpiryTime = session?.session_expires_at;
      const newExpiryTime = new Date();
      newExpiryTime.setMinutes(newExpiryTime.getMinutes() + 15);

      const { error } = await supabase
        .from("selection_accounts")
        .update({
          session_expires_at: newExpiryTime.toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        action: "UPDATE",
        table_name: "selection_accounts",
        record_id: sessionId,
        changes: {
          action: "extend_session",
          guest_name: session?.guest_name,
          username: session?.username,
          old_expiry: oldExpiryTime,
          new_expiry: newExpiryTime.toISOString(),
          extended_by_minutes: 15,
        },
      });

      toast({
        title: "Session Extended",
        description: "Session has been extended by 15 minutes",
      });

      fetchSessions();
    } catch (error: any) {
      console.error("Error extending session:", error);
      toast({
        title: "Error",
        description: "Failed to extend session",
        variant: "destructive",
      });
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      const session = sessions.find(s => s.id === sessionId);
      
      const { error } = await supabase
        .from("selection_accounts")
        .update({
          is_active: false,
          session_expires_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (error) throw error;

      // Log the action
      await supabase.from("audit_logs").insert({
        user_id: user?.id,
        action: "UPDATE",
        table_name: "selection_accounts",
        record_id: sessionId,
        changes: {
          action: "revoke_session",
          guest_name: session?.guest_name,
          username: session?.username,
          previous_status: {
            is_active: session?.is_active,
            session_expires_at: session?.session_expires_at,
          },
          revoked_at: new Date().toISOString(),
        },
      });

      toast({
        title: "Session Revoked",
        description: "Guest can no longer access the selection page",
        variant: "destructive",
      });

      fetchSessions();
    } catch (error: any) {
      console.error("Error revoking session:", error);
      toast({
        title: "Error",
        description: "Failed to revoke session",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      case "not-accessed":
        return <Badge variant="outline">Not Accessed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <SlideMenu isAdmin={userRole === 'admin'} />
          <div>
            <h1 className="text-xl font-bold">Almaza Bay KYC Results</h1>
            <p className="text-sm text-muted-foreground hidden md:block">
              Manage active guest selection sessions and access times
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">

      <Card>
        <CardHeader>
          <CardTitle>Active Sessions ({sessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No KYC results found
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => {
                const status = getSessionStatus(session);
                const canExtend = status === "active" || status === "expired";
                const canRevoke = session.is_active;

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{session.guest_name}</h3>
                        {getStatusBadge(status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Username: {session.username}
                      </p>
                      {session.guest_contact && (
                        <p className="text-sm text-muted-foreground">
                          Contact: {session.guest_contact}
                        </p>
                      )}
                      {session.first_access_at && (
                        <p className="text-sm text-muted-foreground">
                          First accessed:{" "}
                          {formatDistanceToNow(new Date(session.first_access_at), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                      {session.session_expires_at && (
                        <p className="text-sm text-muted-foreground">
                          {status === "expired" ? "Expired" : "Expires"}:{" "}
                          {formatDistanceToNow(new Date(session.session_expires_at), {
                            addSuffix: true,
                          })}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {canExtend && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extendSession(session.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Extend 15 min
                        </Button>
                      )}
                      {canRevoke && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => revokeSession(session.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </main>
    </div>
  );
}

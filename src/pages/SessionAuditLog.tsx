import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Clock, UserCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  changes: any;
  created_at: string;
  admin_name?: string | null;
}

export default function SessionAuditLog() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { userRole } = useAuth();
  const navigate = useNavigate();

  const fetchAuditLogs = async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "selection_accounts")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Fetch user profiles for admin names
      const userIds = [...new Set(logsData?.map(log => log.user_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);

      const enrichedLogs = logsData?.map(log => ({
        ...log,
        admin_name: log.user_id ? profilesMap.get(log.user_id) : null,
      })) || [];

      setLogs(enrichedLogs);
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const getActionBadge = (action: string) => {
    if (action === "extend_session") {
      return <Badge className="bg-blue-500">Extended</Badge>;
    }
    if (action === "revoke_session") {
      return <Badge variant="destructive">Revoked</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <SlideMenu isAdmin={userRole === 'admin'} />
          <div>
            <h1 className="text-3xl font-bold mb-2">Session Audit Log</h1>
            <p className="text-muted-foreground">
              Complete history of all selection session management actions
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Trail ({logs.length} entries)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No audit logs found
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const changes = log.changes || {};
                const actionType = changes.action || log.action;

                return (
                  <div
                    key={log.id}
                    className="p-4 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getActionBadge(actionType)}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <UserCircle className="h-4 w-4" />
                          <span>
                            {log.admin_name || "Unknown Admin"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            {format(new Date(log.created_at), "PPp")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      {changes.guest_name && (
                        <p>
                          <span className="font-semibold">Guest:</span>{" "}
                          {changes.guest_name}
                        </p>
                      )}
                      {changes.username && (
                        <p>
                          <span className="font-semibold">Username:</span>{" "}
                          {changes.username}
                        </p>
                      )}
                      {actionType === "extend_session" && (
                        <>
                          {changes.old_expiry && (
                            <p>
                              <span className="font-semibold">
                                Previous Expiry:
                              </span>{" "}
                              {format(new Date(changes.old_expiry), "PPp")}
                            </p>
                          )}
                          {changes.new_expiry && (
                            <p>
                              <span className="font-semibold">
                                New Expiry:
                              </span>{" "}
                              {format(new Date(changes.new_expiry), "PPp")}
                            </p>
                          )}
                          {changes.extended_by_minutes && (
                            <p>
                              <span className="font-semibold">
                                Extended By:
                              </span>{" "}
                              {changes.extended_by_minutes} minutes
                            </p>
                          )}
                        </>
                      )}
                      {actionType === "revoke_session" && (
                        <>
                          {changes.previous_status && (
                            <p>
                              <span className="font-semibold">
                                Previous Status:
                              </span>{" "}
                              Active: {changes.previous_status.is_active ? "Yes" : "No"}
                            </p>
                          )}
                          {changes.revoked_at && (
                            <p>
                              <span className="font-semibold">
                                Revoked At:
                              </span>{" "}
                              {format(new Date(changes.revoked_at), "PPp")}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import SurveyTrigger from "@/components/SurveyTrigger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { SlideMenu } from "@/components/SlideMenu";
import { useAuth } from "@/lib/auth";
import { AdminBreadcrumb } from "@/components/AdminBreadcrumb";

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { userRole } = useAuth();

  useEffect(() => {
    checkAuth();
    fetchSyncLogs();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    setUser(session.user);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    const adminStatus = roleData?.role === 'admin';
    setIsAdmin(adminStatus);

    if (!adminStatus) {
      navigate('/');
    }

    setLoading(false);
  };

  const fetchSyncLogs = async () => {
    const { data } = await supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setSyncLogs(data);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <SlideMenu userRole={userRole} />
          
          {/* Mobile back button - icon only */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="md:hidden"
            size="icon"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Desktop back button with text */}
          <Button 
            variant="ghost" 
            onClick={() => navigate('/admin')}
            className="hidden md:flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your system configuration</p>
          </div>
        </div>

        <div className="space-y-6">
          
          
          <SurveyTrigger />

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>Sync History</CardTitle>
              </div>
              <CardDescription>
                Recent synchronization activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {syncLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sync history yet
                </div>
              ) : (
                <div className="space-y-3">
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              log.status === 'success'
                                ? 'default'
                                : log.status === 'error'
                                ? 'destructive'
                                : 'secondary'
                            }
                          >
                            {log.status}
                          </Badge>
                          <Badge variant="outline">{log.trigger_type}</Badge>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-green-600">
                            {log.bookings_created} created
                          </span>
                          {' • '}
                          <span className="text-muted-foreground">
                            {log.bookings_skipped} skipped
                          </span>
                        </div>
                        {log.error_message && (
                          <div className="mt-1 text-sm text-red-600">
                            {log.error_message}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

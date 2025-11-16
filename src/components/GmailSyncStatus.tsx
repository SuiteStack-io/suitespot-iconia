import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export const GmailSyncStatus = () => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSyncStatus();
    testConnection();
  }, []);

  const fetchSyncStatus = async () => {
    const { data, error } = await supabase
      .from('sync_status')
      .select('*')
      .eq('sync_type', 'booking.com')
      .single();

    if (error) {
      console.error('Error fetching sync status:', error);
      return;
    }

    setSyncStatus(data);
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-gmail-connection');
      
      if (error) throw error;
      
      setConnectionStatus(data);
    } catch (error) {
      console.error('Error testing connection:', error);
      setConnectionStatus({ connected: false, error: 'Failed to test connection' });
    } finally {
      setTesting(false);
    }
  };

  const handleConnectGmail = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth-start');
      
      if (error) throw error;

      // Open OAuth popup
      const popup = window.open(
        data.authUrl,
        'Gmail OAuth',
        'width=600,height=700,left=200,top=100'
      );

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          toast({
            title: "Checking connection...",
            description: "Verifying Gmail authentication",
          });
          
          // Wait a bit for the callback to complete
          setTimeout(() => {
            fetchSyncStatus();
            testConnection();
          }, 2000);
        }
      }, 500);

    } catch (error) {
      console.error('Error starting Gmail auth:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to start Gmail authentication",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('sync_status')
        .update({ 
          refresh_token: null,
          status: 'disconnected',
          error_message: null
        })
        .eq('sync_type', 'booking.com');

      if (error) throw error;

      toast({
        title: "Gmail Disconnected",
        description: "Your Gmail account has been disconnected",
      });

      fetchSyncStatus();
      testConnection();
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect Gmail",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isConnected = connectionStatus?.connected;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gmail Connection</CardTitle>
            <CardDescription>
              Sync reservations from Booking.com emails
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={testConnection}
            disabled={testing}
          >
            <RefreshCw className={`h-4 w-4 ${testing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {testing ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium">
              {testing ? 'Testing...' : isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {syncStatus?.status || 'unknown'}
          </Badge>
        </div>

        {syncStatus?.last_sync_at && (
          <div className="text-sm text-muted-foreground">
            Last sync: {formatDistanceToNow(new Date(syncStatus.last_sync_at), {
              addSuffix: true,
            })}
          </div>
        )}

        {connectionStatus?.error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {connectionStatus.error}
          </div>
        )}

        {syncStatus?.error_message && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {syncStatus.error_message}
          </div>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect Gmail
            </Button>
          ) : (
            <Button
              onClick={handleConnectGmail}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect Gmail
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

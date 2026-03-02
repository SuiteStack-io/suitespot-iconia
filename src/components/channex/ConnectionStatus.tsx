import { useState, useEffect, useMemo } from 'react';
import { Loader2, CheckCircle2, XCircle, Wifi, AlertTriangle, Clock, Copy, Check, FlaskConical, RefreshCw, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface HealthCheck {
  status: string;
  latency_ms?: number;
  count?: number;
  pending?: number;
  failed?: number;
  error?: string;
}

interface HealthData {
  status: 'healthy' | 'degraded' | 'error';
  checks: Record<string, HealthCheck>;
  checked_at: string;
}

interface QueueStats {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
}

const statusColors = {
  healthy: 'bg-green-600 hover:bg-green-700',
  degraded: 'bg-amber-500 hover:bg-amber-600',
  error: 'bg-destructive hover:bg-destructive/90',
};

const checkLabels: Record<string, string> = {
  api_connection: 'API Connection',
  sync_errors: 'Sync Errors',
  unacked_bookings: 'Unacked Bookings',
  recent_failures: 'Recent Failures (24h)',
  unresolved_alerts: 'Unresolved Alerts',
  queue_backlog: 'Queue Backlog',
};

const WEBHOOK_URL = `https://phvduifvymozqiqwvajj.supabase.co/functions/v1/channex-booking-webhook`;

export function ConnectionStatus() {
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncSuccess, setLastSyncSuccess] = useState<boolean | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats>({ pending: 0, processing: 0, failed: 0, completed: 0 });

  useEffect(() => {
    fetchLastSync();
    fetchQueueStats();
  }, []);

  const fetchLastSync = async () => {
    const { data } = await supabase
      .from('channex_sync_logs')
      .select('created_at, success')
      .eq('function_name', 'channex-daily-sync')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setLastSyncAt(data.created_at);
      setLastSyncSuccess(data.success);
    }
  };

  const fetchQueueStats = async () => {
    const { data } = await supabase
      .from('channex_sync_queue')
      .select('status');
    if (data) {
      const stats: QueueStats = { pending: 0, processing: 0, failed: 0, completed: 0 };
      for (const row of data) {
        if (row.status in stats) stats[row.status as keyof QueueStats]++;
      }
      setQueueStats(stats);
    }
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    toast.success('Webhook URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('channex-health-check');
      if (error) throw error;
      setHealth(data);
      if (data.status === 'healthy') toast.success('All systems healthy');
      else if (data.status === 'degraded') toast.warning('Some checks have warnings');
      else toast.error('Health check detected errors');
    } catch {
      toast.error('Failed to run health check');
    } finally {
      setLoading(false);
    }
  };

  const [syncProgress, setSyncProgress] = useState('');
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncCompleted, setSyncCompleted] = useState(0);
  const syncPercent = syncTotal > 0 ? Math.round((syncCompleted / syncTotal) * 100) : 0;

  const runFullSync = async () => {
    setSyncCompleted(0);
    setSyncTotal(0);
    setSyncing(true);
    try {
      // Fetch all channex-synced properties
      const { data: properties, error: propError } = await supabase
        .from('channex_mappings')
        .select('local_id, channex_id, channex_data')
        .eq('entity_type', 'property')
        .eq('sync_status', 'synced');
      
      if (propError) throw propError;
      if (!properties || properties.length === 0) {
        toast.error('No synced properties found');
        setSyncing(false);
        return;
      }

      const results: { name: string; success: boolean; error?: string }[] = [];
      setSyncTotal(properties.length);

      for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];
        const propName = (prop.channex_data as any)?.title || prop.local_id;
        setSyncProgress(`Syncing property ${i + 1} of ${properties.length}: ${propName}...`);
        toast.loading(`Syncing property ${i + 1} of ${properties.length}: ${propName}...`, { id: 'full-sync-progress' });

        try {
          const { data, error } = await supabase.functions.invoke('channex-full-sync', {
            body: { propertyId: prop.local_id },
          });
          if (error) throw error;
          if (data?.success) {
            results.push({ name: propName, success: true });
          } else {
            results.push({ name: propName, success: false, error: data?.error || 'Unknown' });
          }
        } catch (err: any) {
          results.push({ name: propName, success: false, error: err.message });
        }
        setSyncCompleted(i + 1);
      }

      toast.dismiss('full-sync-progress');
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        toast.success(`Full sync complete: ${succeeded}/${results.length} properties synced successfully`);
      } else {
        toast.warning(`Sync done: ${succeeded} succeeded, ${failed.length} failed (${failed.map(f => f.name).join(', ')})`);
      }
      fetchLastSync();
      fetchQueueStats();
    } catch (err: any) {
      toast.dismiss('full-sync-progress');
      toast.error(`Failed to run full sync: ${err.message}`);
    } finally {
      setSyncing(false);
      setSyncProgress('');
      setSyncTotal(0);
      setSyncCompleted(0);
    }
  };

  const testWebhook = async () => {
    setTesting(true);
    const testId = `test-booking-${Date.now()}`;
    const testOtaCode = `TEST-${Date.now()}`;
    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'booking',
          payload: {
            property_id: 'test-property-id',
            booking: {
              id: testId, booking_id: testId, revision_id: `test-rev-${Date.now()}`,
              status: 'new', ota_name: 'Test', ota_reservation_code: testOtaCode,
              arrival_date: new Date().toISOString().split('T')[0],
              departure_date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
              currency: 'USD', amount: '100.00',
              customer: { name: 'Test', surname: 'Webhook', email: 'test@test.com', phone: '+0000000000' },
              rooms: [],
            },
          },
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast.error(`Webhook returned error: ${result.error || 'Unknown'}`);
        setTesting(false);
        return;
      }
      await new Promise(r => setTimeout(r, 2000));
      const { data, error } = await supabase
        .from('channex_bookings')
        .select('id')
        .eq('channex_booking_id', testId)
        .maybeSingle();
      if (data) {
        toast.success('Webhook pipeline works! Test booking saved and cleaned up.');
        await supabase.from('channex_bookings').delete().eq('channex_booking_id', testId);
      } else if (error) {
        toast.error(`DB check failed: ${error.message}`);
      } else {
        toast.warning('Webhook responded OK but booking not found in DB. Check property mapping.');
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Connection & Health Status
          </CardTitle>
          <CardDescription>
            Run a comprehensive health check of the Channex integration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Webhook URL Section */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <h4 className="text-sm font-semibold">Webhook URL</h4>
            <p className="text-xs text-muted-foreground">
              Register this URL in your Channex dashboard under Webhooks/Subscriptions and subscribe to the <code className="bg-muted px-1 rounded">booking</code> event.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md break-all font-mono">
                {WEBHOOK_URL}
              </code>
              <Button variant="outline" size="sm" onClick={copyWebhookUrl} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {health && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={`${statusColors[health.status]} gap-1`}>
                  {health.status === 'healthy' && <CheckCircle2 className="h-3 w-3" />}
                  {health.status === 'degraded' && <AlertTriangle className="h-3 w-3" />}
                  {health.status === 'error' && <XCircle className="h-3 w-3" />}
                  {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(health.checked_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="grid gap-2">
                {Object.entries(health.checks).map(([key, check]) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                    <span className="font-medium">{checkLabels[key] || key}</span>
                    <div className="flex items-center gap-2">
                      {check.latency_ms !== undefined && (
                        <span className="text-xs text-muted-foreground">{check.latency_ms}ms</span>
                      )}
                      {check.count !== undefined && check.count > 0 && (
                        <Badge variant="outline" className="text-xs">{check.count}</Badge>
                      )}
                      {check.pending !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {check.pending} pending / {check.failed} failed
                        </span>
                      )}
                      {check.status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {check.status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      {check.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={runHealthCheck} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Run Health Check
            </Button>
            <Button variant="outline" onClick={testWebhook} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Test Webhook
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full Sync Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Full Sync (500 Days)
          </CardTitle>
          <CardDescription>
            Push all availability, rates, and restrictions for the next 500 days to Channex. Runs automatically daily at 3 AM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastSyncAt && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last sync:</span>
              <span>{new Date(lastSyncAt).toLocaleString()}</span>
              {lastSyncSuccess !== null && (
                lastSyncSuccess
                  ? <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Success</Badge>
                  : <Badge variant="outline" className="text-destructive border-destructive text-xs">Failed</Badge>
              )}
            </div>
          )}

          {syncing && syncProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="animate-pulse">{syncProgress}</span>
                <span className="font-medium">{syncPercent}%</span>
              </div>
              <Progress value={syncPercent} className="h-2" />
            </div>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" disabled={syncing} className="gap-2">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run Full Sync Now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Run Full Sync?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will push 500 days of availability, rates, and restrictions to Channex. This may take several minutes and will make many API calls.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runFullSync}>Run Sync</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Queue Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sync Queue Status
          </CardTitle>
          <CardDescription>
            Real-time status of the automatic sync queue for rate, availability, and restriction changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-2xl font-bold text-amber-500">{queueStats.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-2xl font-bold text-blue-500">{queueStats.processing}</div>
              <div className="text-xs text-muted-foreground">Processing</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-2xl font-bold text-destructive">{queueStats.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchQueueStats} className="mt-3 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

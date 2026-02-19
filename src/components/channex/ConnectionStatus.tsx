import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Wifi, AlertTriangle, Clock, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      if (data.status === 'healthy') {
        toast.success('All systems healthy');
      } else if (data.status === 'degraded') {
        toast.warning('Some checks have warnings');
      } else {
        toast.error('Health check detected errors');
      }
    } catch (err: any) {
      toast.error('Failed to run health check');
    } finally {
      setLoading(false);
    }
  };

  return (
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

        <Button onClick={runHealthCheck} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          Run Health Check
        </Button>
      </CardContent>
    </Card>
  );
}

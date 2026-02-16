import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Zap, KeyRound, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ChannexAlert {
  id: string;
  alert_type: string;
  message: string;
  property_id: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

const alertIcons: Record<string, React.ReactNode> = {
  webhook_error: <AlertTriangle className="h-4 w-4" />,
  sync_error: <ShieldAlert className="h-4 w-4" />,
  rate_limit: <Zap className="h-4 w-4" />,
  auth_error: <KeyRound className="h-4 w-4" />,
};

const alertColors: Record<string, string> = {
  webhook_error: 'bg-destructive/10 border-destructive/30 text-destructive',
  sync_error: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
  rate_limit: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
  auth_error: 'bg-destructive/10 border-destructive/30 text-destructive',
};

export function AlertsPanel({ showResolved = false }: { showResolved?: boolean }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ChannexAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  const fetchAlerts = async () => {
    let query = supabase
      .from('channex_alerts' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (!showResolved) {
      query = query.eq('resolved', false);
    }

    const { data, error } = await query.limit(50);
    if (!error && data) {
      setAlerts(data as unknown as ChannexAlert[]);
      if (!showResolved) {
        setIsOpen((data as any[]).length > 0);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();
  }, [showResolved]);

  const resolveAlert = async (alertId: string) => {
    const { error } = await supabase
      .from('channex_alerts' as any)
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id || null,
      } as any)
      .eq('id', alertId);

    if (error) {
      toast.error('Failed to resolve alert');
    } else {
      toast.success('Alert resolved');
      fetchAlerts();
    }
  };

  const unresolvedCount = alerts.filter(a => !a.resolved).length;

  if (loading) return null;
  if (!showResolved && alerts.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={unresolvedCount > 0 ? 'border-destructive/50' : ''}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Channex Alerts
                {unresolvedCount > 0 && (
                  <Badge variant="destructive">{unresolvedCount} unresolved</Badge>
                )}
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {alerts.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No alerts to display.</p>
            )}
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start justify-between gap-3 p-3 rounded-md border ${
                  alert.resolved ? 'bg-muted/30 border-border opacity-60' : (alertColors[alert.alert_type] || 'bg-muted border-border')
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className="mt-0.5 shrink-0">
                    {alert.resolved ? <CheckCircle className="h-4 w-4 text-muted-foreground" /> : (alertIcons[alert.alert_type] || <AlertTriangle className="h-4 w-4" />)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(alert.created_at), 'MMM d, yyyy HH:mm')}
                      {alert.resolved && alert.resolved_at && (
                        <> · Resolved {format(new Date(alert.resolved_at), 'MMM d, HH:mm')}</>
                      )}
                    </p>
                  </div>
                </div>
                {!alert.resolved && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

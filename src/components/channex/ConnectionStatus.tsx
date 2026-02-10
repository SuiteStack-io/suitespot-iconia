import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Wifi } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function ConnectionStatus() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    connected: boolean;
    base_url: string | null;
    error?: string;
    testedAt?: string;
  } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('channex-test-connection');
      if (error) throw error;
      setResult({ ...data, testedAt: new Date().toLocaleTimeString() });
      if (data.connected) {
        toast.success('Channex connection successful');
      } else {
        toast.error(data.error || 'Connection failed');
      }
    } catch (err: any) {
      toast.error('Failed to test connection');
      setResult({ connected: false, base_url: null, error: err.message, testedAt: new Date().toLocaleTimeString() });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Connection Status
        </CardTitle>
        <CardDescription>
          Verify your Channex API key and connection to the channel manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {result.connected ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Not Connected
                </Badge>
              )}
              {result.testedAt && (
                <span className="text-xs text-muted-foreground">
                  Tested at {result.testedAt}
                </span>
              )}
            </div>

            {result.base_url && (
              <div className="text-sm">
                <span className="text-muted-foreground">Base URL: </span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{result.base_url}</code>
                {result.base_url.includes('staging') && (
                  <Badge variant="outline" className="ml-2 text-xs">Staging</Badge>
                )}
                {result.base_url.includes('app.channex') && (
                  <Badge variant="outline" className="ml-2 text-xs">Production</Badge>
                )}
              </div>
            )}

            {result.error && (
              <p className="text-sm text-destructive">{result.error}</p>
            )}
          </div>
        )}

        <Button onClick={testConnection} disabled={testing} className="gap-2">
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
          Test Connection
        </Button>
      </CardContent>
    </Card>
  );
}

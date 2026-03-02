import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SyncLog {
  id: string;
  created_at: string;
  function_name: string;
  endpoint: string;
  success: boolean;
  error_message: string | null;
  status_code: number | null;
  property_id: string | null;
  request_payload: any;
  response_payload: any;
}

interface Property {
  id: string;
  name: string;
}

export function SyncLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, unitsRes] = await Promise.all([
        supabase.from('channex_sync_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('properties').select('id, name').order('name'),
      ]);
      if (logsRes.error) throw logsRes.error;
      if (unitsRes.error) throw unitsRes.error;
      setLogs(logsRes.data || []);
      setProperties(unitsRes.data || []);
    } catch {
      toast.error('Failed to load sync logs');
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter((log) => {
    if (propertyFilter !== 'all' && log.property_id !== propertyFilter) return false;
    if (statusFilter === 'success' && !log.success) return false;
    if (statusFilter === 'error' && log.success) return false;
    return true;
  });

  const propertyName = (id: string | null) => {
    if (!id) return '—';
    const p = properties.find((p) => p.id === id);
    return p?.name || id.slice(0, 8);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Sync Logs</h3>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No logs found.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Function</TableHead>
                <TableHead className="hidden md:table-cell">Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Property</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const isExpanded = expandedId === log.id;
                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : log.id)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(log.created_at), 'MMM d HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs font-mono">{log.function_name}</TableCell>
                          <TableCell className="text-xs font-mono hidden md:table-cell truncate max-w-[200px]">
                            {log.endpoint}
                          </TableCell>
                          <TableCell>
                            {log.success ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">Success</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Error</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs hidden md:table-cell">{propertyName(log.property_id)}</TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              {log.error_message && (
                                <div>
                                  <p className="text-xs font-semibold text-destructive mb-1">Error</p>
                                  <p className="text-xs">{log.error_message}</p>
                                </div>
                              )}
                              {log.request_payload && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">Request Payload</p>
                                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                                    {JSON.stringify(log.request_payload, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.response_payload && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">Response Payload</p>
                                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                                    {JSON.stringify(log.response_payload, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Mapping {
  id: string;
  local_id: string;
  channex_id: string;
  entity_type: string;
  sync_status: string;
  last_synced_at: string | null;
  error_message: string | null;
}

interface Unit {
  id: string;
  name: string | null;
  booking_com_name: string | null;
  unit_number: string | null;
}

export function PropertySync() {
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unitsRes, mappingsRes] = await Promise.all([
        supabase.from('units').select('id, name, booking_com_name, unit_number').order('unit_number'),
        supabase.from('channex_mappings').select('*'),
      ]);
      if (unitsRes.error) throw unitsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;
      setUnits(unitsRes.data || []);
      setMappings((mappingsRes.data as Mapping[]) || []);
    } catch {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  const syncProperty = async (unitId: string) => {
    setSyncingId(unitId);
    try {
      const { data, error } = await supabase.functions.invoke('channex-sync-property', {
        body: { property_id: unitId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Property synced to Channex');
      } else {
        toast.error(data?.error || 'Sync failed');
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const getMapping = (unitId: string, type: string) =>
    mappings.find((m) => m.local_id === unitId && m.entity_type === type);

  const statusBadge = (mapping: Mapping | undefined) => {
    if (!mapping) return <Badge variant="secondary">Not Synced</Badge>;
    if (mapping.sync_status === 'error')
      return <Badge variant="destructive">Error</Badge>;
    return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Synced</Badge>;
  };

  const childMappings = (unitId: string) =>
    mappings.filter(
      (m) => (m.entity_type === 'room_type' || m.entity_type === 'rate_plan') && m.local_id !== unitId
    );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Properties</h3>
          <p className="text-sm text-muted-foreground">
            Sync your properties to the Channex channel manager.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {units.map((unit) => {
        const mapping = getMapping(unit.id, 'property');
        const isExpanded = expandedId === unit.id;
        const roomTypeMappings = mappings.filter(
          (m) => m.entity_type === 'room_type'
        );
        const ratePlanMappings = mappings.filter(
          (m) => m.entity_type === 'rate_plan'
        );

        return (
          <Card key={unit.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="font-medium">{unit.booking_com_name || unit.name || unit.unit_number || 'Unnamed'}</p>
                  {unit.unit_number && (
                    <p className="text-xs text-muted-foreground">Unit {unit.unit_number}</p>
                  )}
                  {mapping?.channex_id && (
                    <p className="text-xs text-muted-foreground">
                      Channex ID: <code className="bg-muted px-1 rounded">{mapping.channex_id}</code>
                    </p>
                  )}
                  {mapping?.last_synced_at && (
                    <p className="text-xs text-muted-foreground">
                      Last synced: {format(new Date(mapping.last_synced_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  )}
                  {mapping?.error_message && (
                    <p className="text-xs text-destructive">{mapping.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(mapping)}
                  <Button
                    size="sm"
                    onClick={() => syncProperty(unit.id)}
                    disabled={syncingId === unit.id}
                    className="gap-2"
                  >
                    {syncingId === unit.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Sync
                  </Button>
                </div>
              </div>

              {mapping && (
                <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : unit.id)}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-sm text-muted-foreground mt-3 hover:text-foreground transition-colors cursor-pointer">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    View Details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-1">Room Types</p>
                        {roomTypeMappings.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No room types synced</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Local ID</TableHead>
                                <TableHead className="text-xs">Channex ID</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {roomTypeMappings.map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell className="text-xs font-mono">{m.local_id.slice(0, 8)}...</TableCell>
                                  <TableCell className="text-xs font-mono">{m.channex_id.slice(0, 8)}...</TableCell>
                                  <TableCell>{statusBadge(m)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Rate Plans</p>
                        {ratePlanMappings.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No rate plans synced</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Local ID</TableHead>
                                <TableHead className="text-xs">Channex ID</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {ratePlanMappings.map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell className="text-xs font-mono">{m.local_id.slice(0, 8)}...</TableCell>
                                  <TableCell className="text-xs font-mono">{m.channex_id.slice(0, 8)}...</TableCell>
                                  <TableCell>{statusBadge(m)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

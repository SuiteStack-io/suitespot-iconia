import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface PropertyConfig {
  id: string;
  property_name: string;
  channex_property_id: string | null;
}

interface RoomTypeGroup {
  name: string;
  count: number;
}

interface PropertySyncProps {
  onSwitchToSettings?: () => void;
}

export function PropertySync({ onSwitchToSettings }: PropertySyncProps) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [config, setConfig] = useState<PropertyConfig | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeGroup[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);
  const [unitsLookup, setUnitsLookup] = useState<Record<string, string>>({});
  const [ratePlansLookup, setRatePlansLookup] = useState<Record<string, { name: string; room_type: string | null }>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [configRes, mappingsRes, unitsRes, ratePlansRes] = await Promise.all([
        supabase.from('channex_property_config').select('id, property_name, channex_property_id').limit(1).maybeSingle(),
        supabase.from('channex_mappings').select('*'),
        supabase.from('units').select('id, name, booking_com_name').or('is_private.eq.false,is_private.is.null'),
        supabase.from('rate_plans').select('id, name, room_type'),
      ]);

      setConfig(configRes.data as PropertyConfig | null);
      setMappings((mappingsRes.data as Mapping[]) || []);

      if (unitsRes.data) {
        const groups: Record<string, number> = {};
        const lookup: Record<string, string> = {};
        for (const u of unitsRes.data) {
          const name = u.booking_com_name || u.name;
          groups[name] = (groups[name] || 0) + 1;
          lookup[u.id] = name;
        }
        setRoomTypes(Object.entries(groups).map(([name, count]) => ({ name, count })));
        setTotalUnits(unitsRes.data.length);
        setUnitsLookup(lookup);
      }

      if (ratePlansRes.data) {
        const lookup: Record<string, { name: string; room_type: string | null }> = {};
        for (const rp of ratePlansRes.data) {
          lookup[rp.id] = { name: rp.name, room_type: rp.room_type };
        }
        setRatePlansLookup(lookup);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const syncProperty = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('channex-sync-property');
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
      setSyncing(false);
    }
  };

  const propertyMapping = mappings.find(m => m.entity_type === 'property');
  const roomTypeMappings = mappings.filter(m => m.entity_type === 'room_type');
  const ratePlanMappings = mappings.filter(m => m.entity_type === 'rate_plan');
  const derivedRatePlanMappings = mappings.filter(m => m.entity_type === 'derived_rate_plan');

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">Please configure your property details in the Settings tab first.</p>
          {onSwitchToSettings && (
            <Button variant="outline" onClick={onSwitchToSettings} className="gap-2">
              <Settings className="h-4 w-4" />
              Go to Settings
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Property Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>{config.property_name}</CardTitle>
              <CardDescription>{roomTypes.length} room types, {totalUnits} total units</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {config.channex_property_id ? (
                <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>
              ) : (
                <Badge variant="secondary">Not Synced</Badge>
              )}
              <Button onClick={syncProperty} disabled={syncing} className="gap-2">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync to Channex
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {config.channex_property_id && (
            <p className="text-xs text-muted-foreground">
              Channex Property ID: <code className="bg-muted px-1 rounded">{config.channex_property_id}</code>
            </p>
          )}
          {propertyMapping?.last_synced_at && (
            <p className="text-xs text-muted-foreground">
              Last synced: {format(new Date(propertyMapping.last_synced_at), 'MMM d, yyyy HH:mm')}
            </p>
          )}
          {propertyMapping?.error_message && (
            <p className="text-xs text-destructive">{propertyMapping.error_message}</p>
          )}
        </CardContent>
      </Card>

      {/* Synced Room Types */}
      {roomTypeMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Synced Room Types</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Room Name</TableHead>
                  <TableHead className="text-xs">Local ID</TableHead>
                  <TableHead className="text-xs">Channex ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomTypeMappings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-medium">{unitsLookup[m.local_id] || '—'}</TableCell>
                    <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.local_id); toast.success('Copied!'); }}>{m.local_id}</TableCell>
                    <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.channex_id); toast.success('Copied!'); }}>{m.channex_id}</TableCell>
                    <TableCell>
                      {m.sync_status === 'error' ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Synced Rate Plans */}
      {ratePlanMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Synced Rate Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Plan Name</TableHead>
                  <TableHead className="text-xs">Room Type</TableHead>
                  <TableHead className="text-xs">Local ID</TableHead>
                  <TableHead className="text-xs">Channex ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratePlanMappings.map(m => {
                  const rp = ratePlansLookup[m.local_id];
                  return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-medium">{rp?.name || '—'}</TableCell>
                    <TableCell className="text-xs">{rp?.room_type || '—'}</TableCell>
                    <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.local_id); toast.success('Copied!'); }}>{m.local_id}</TableCell>
                    <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.channex_id); toast.success('Copied!'); }}>{m.channex_id}</TableCell>
                    <TableCell>
                      {m.sync_status === 'error' ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Derived Rate Plans */}
      {derivedRatePlanMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Derived Rate Plans (Channel Markup)</CardTitle>
            <CardDescription>{derivedRatePlanMappings.length} derived plans synced</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Base Plan Name</TableHead>
                  <TableHead className="text-xs">Base Plan ID</TableHead>
                  <TableHead className="text-xs">Channex ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {derivedRatePlanMappings.map(m => {
                  const rp = ratePlansLookup[m.local_id];
                  return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-medium">{rp?.name || '—'}</TableCell>
                    <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.local_id); toast.success('Copied!'); }}>{m.local_id}</TableCell>
                    <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.channex_id); toast.success('Copied!'); }}>{m.channex_id}</TableCell>
                    <TableCell>
                      {m.sync_status === 'error' ? (
                        <Badge variant="destructive">Error</Badge>
                      ) : (
                        <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

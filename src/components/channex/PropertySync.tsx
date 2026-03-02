import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Settings, ChevronDown, Upload, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Property {
  id: string;
  name: string;
  channex_property_id: string | null;
  channex_synced: boolean | null;
  channex_last_sync: string | null;
}

interface Mapping {
  id: string;
  local_id: string;
  channex_id: string;
  entity_type: string;
  sync_status: string;
  last_synced_at: string | null;
  error_message: string | null;
}

interface PropertySyncProps {
  onSwitchToSettings?: () => void;
}

interface FullSyncResult {
  room_types_pushed: number;
  rate_plans_pushed: number;
  availability_task_ids: string[];
  rates_task_ids: string[];
  errors: string[];
}

export function PropertySync({ onSwitchToSettings }: PropertySyncProps) {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [unitsPerProperty, setUnitsPerProperty] = useState<Record<string, { name: string; count: number; id: string }[]>>({});
  const [ratePlansPerProperty, setRatePlansPerProperty] = useState<Record<string, { id: string; name: string; room_type: string | null }[]>>({});
  const [syncingPropertyId, setSyncingPropertyId] = useState<string | null>(null);
  const [fullSyncingPropertyId, setFullSyncingPropertyId] = useState<string | null>(null);
  const [fullSyncResult, setFullSyncResult] = useState<FullSyncResult | null>(null);
  const [showFullSyncDialog, setShowFullSyncDialog] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propertiesRes, mappingsRes, unitsRes, ratePlansRes] = await Promise.all([
        supabase.from('properties').select('id, name, channex_property_id, channex_synced, channex_last_sync').order('created_at', { ascending: true }),
        supabase.from('channex_mappings').select('*'),
        supabase.from('units').select('id, name, booking_com_name, property_id').or('is_private.eq.false,is_private.is.null'),
        supabase.from('rate_plans').select('id, name, room_type, property_id'),
      ]);

      setProperties((propertiesRes.data as Property[]) || []);
      setMappings((mappingsRes.data as Mapping[]) || []);

      // Group units by property
      const unitsByProp: Record<string, Record<string, { count: number; id: string }>> = {};
      for (const u of (unitsRes.data || [])) {
        const pid = u.property_id || 'unknown';
        if (!unitsByProp[pid]) unitsByProp[pid] = {};
        const displayName = u.booking_com_name || u.name;
        if (!unitsByProp[pid][displayName]) {
          unitsByProp[pid][displayName] = { count: 0, id: u.id };
        }
        unitsByProp[pid][displayName].count++;
      }
      const grouped: Record<string, { name: string; count: number; id: string }[]> = {};
      for (const [pid, rooms] of Object.entries(unitsByProp)) {
        grouped[pid] = Object.entries(rooms).map(([name, data]) => ({ name, ...data }));
      }
      setUnitsPerProperty(grouped);

      // Group rate plans by property
      const rpByProp: Record<string, { id: string; name: string; room_type: string | null }[]> = {};
      for (const rp of (ratePlansRes.data || [])) {
        const pid = rp.property_id || 'unknown';
        if (!rpByProp[pid]) rpByProp[pid] = [];
        rpByProp[pid].push({ id: rp.id, name: rp.name, room_type: rp.room_type });
      }
      setRatePlansPerProperty(rpByProp);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const syncProperty = async (propertyId: string) => {
    setSyncingPropertyId(propertyId);
    try {
      const { data, error } = await supabase.functions.invoke('channex-sync-property', {
        body: { propertyId },
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
      setSyncingPropertyId(null);
    }
  };

  const fullSyncProperty = async (propertyId: string) => {
    setFullSyncingPropertyId(propertyId);
    try {
      const { data, error } = await supabase.functions.invoke('channex-full-sync', {
        body: { propertyId },
      });
      if (error) throw error;
      if (data?.success) {
        setFullSyncResult({
          room_types_pushed: data.room_types_pushed || 0,
          rate_plans_pushed: data.rate_plans_pushed || 0,
          availability_task_ids: data.availability_task_ids || [],
          rates_task_ids: data.rates_task_ids || [],
          errors: data.errors || [],
        });
        setShowFullSyncDialog(true);
      } else {
        toast.error(data?.error || 'Full sync failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Full sync failed');
    } finally {
      setFullSyncingPropertyId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">No properties found. Please create a property first.</p>
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
      {properties.map(property => {
        const isSyncing = syncingPropertyId === property.id;
        const isFullSyncing = fullSyncingPropertyId === property.id;
        const propertyMapping = mappings.find(m => m.entity_type === 'property' && m.local_id === property.id);
        const unitGroups = unitsPerProperty[property.id] || [];
        const totalUnits = unitGroups.reduce((sum, g) => sum + g.count, 0);
        const unitIds = new Set(unitGroups.map(g => g.id));
        const roomTypeMappings = mappings.filter(m => m.entity_type === 'room_type' && unitIds.has(m.local_id));
        const propertyRatePlans = ratePlansPerProperty[property.id] || [];
        const rpIds = new Set(propertyRatePlans.map(rp => rp.id));
        const ratePlanMappings = mappings.filter(m => m.entity_type === 'rate_plan' && rpIds.has(m.local_id));
        const derivedRatePlanMappings = mappings.filter(m => m.entity_type === 'derived_rate_plan' && rpIds.has(m.local_id));

        return (
          <PropertyCard
            key={property.id}
            property={property}
            propertyMapping={propertyMapping}
            unitGroups={unitGroups}
            totalUnits={totalUnits}
            roomTypeMappings={roomTypeMappings}
            ratePlanMappings={ratePlanMappings}
            derivedRatePlanMappings={derivedRatePlanMappings}
            propertyRatePlans={propertyRatePlans}
            isSyncing={isSyncing}
            isFullSyncing={isFullSyncing}
            onSync={() => syncProperty(property.id)}
            onFullSync={() => fullSyncProperty(property.id)}
            onRefresh={fetchData}
          />
        );
      })}

      <FullSyncResultDialog
        open={showFullSyncDialog}
        onOpenChange={setShowFullSyncDialog}
        result={fullSyncResult}
      />
    </div>
  );
}

interface PropertyCardProps {
  property: Property;
  propertyMapping?: Mapping;
  unitGroups: { name: string; count: number; id: string }[];
  totalUnits: number;
  roomTypeMappings: Mapping[];
  ratePlanMappings: Mapping[];
  derivedRatePlanMappings: Mapping[];
  propertyRatePlans: { id: string; name: string; room_type: string | null }[];
  isSyncing: boolean;
  isFullSyncing: boolean;
  onSync: () => void;
  onFullSync: () => void;
  onRefresh: () => void;
}

function PropertyCard({
  property, propertyMapping, unitGroups, totalUnits,
  roomTypeMappings, ratePlanMappings, derivedRatePlanMappings,
  propertyRatePlans, isSyncing, isFullSyncing, onSync, onFullSync, onRefresh,
}: PropertyCardProps) {
  const [open, setOpen] = useState(false);
  const isSynced = !!property.channex_property_id;

  const rpLookup: Record<string, { name: string; room_type: string | null }> = {};
  for (const rp of propertyRatePlans) rpLookup[rp.id] = { name: rp.name, room_type: rp.room_type };

  const unitLookup: Record<string, string> = {};
  for (const g of unitGroups) unitLookup[g.id] = g.name;

  const hasMappings = roomTypeMappings.length > 0 || ratePlanMappings.length > 0 || derivedRatePlanMappings.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>{property.name}</CardTitle>
            <CardDescription>{unitGroups.length} room types, {totalUnits} total units</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isSynced ? (
              <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>
            ) : (
              <Badge variant="secondary">Not Synced</Badge>
            )}
            <Button onClick={onSync} disabled={isSyncing} size="sm" className="gap-2">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync to Channex
            </Button>
            {isSynced && (
              <Button variant="outline" size="sm" onClick={onFullSync} disabled={isFullSyncing} className="gap-2">
                {isFullSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Full Sync (500 days)
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isSynced && (
          <p className="text-xs text-muted-foreground">
            Channex Property ID: <code className="bg-muted px-1 rounded">{property.channex_property_id}</code>
          </p>
        )}
        {!isSynced && (
          <p className="text-xs text-muted-foreground">Channex Property ID: —</p>
        )}
        {property.channex_last_sync ? (
          <p className="text-xs text-muted-foreground">
            Last synced: {format(new Date(property.channex_last_sync), 'MMM d, yyyy HH:mm')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Last synced: Never</p>
        )}
        {propertyMapping?.error_message && (
          <p className="text-xs text-destructive">{propertyMapping.error_message}</p>
        )}

        {hasMappings && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 mt-2">
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                {open ? 'Hide' : 'Show'} Synced Entities ({roomTypeMappings.length + ratePlanMappings.length + derivedRatePlanMappings.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              {roomTypeMappings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Synced Room Types</h4>
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
                          <TableCell className="text-xs font-medium">{unitLookup[m.local_id] || '—'}</TableCell>
                          <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.local_id); toast.success('Copied!'); }}>{m.local_id}</TableCell>
                          <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.channex_id); toast.success('Copied!'); }}>{m.channex_id}</TableCell>
                          <TableCell>
                            {m.sync_status === 'error' ? <Badge variant="destructive">Error</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {ratePlanMappings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Synced Rate Plans</h4>
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
                        const rp = rpLookup[m.local_id];
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs font-medium">{rp?.name || '—'}</TableCell>
                            <TableCell className="text-xs">{rp?.room_type || '—'}</TableCell>
                            <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.local_id); toast.success('Copied!'); }}>{m.local_id}</TableCell>
                            <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.channex_id); toast.success('Copied!'); }}>{m.channex_id}</TableCell>
                            <TableCell>
                              {m.sync_status === 'error' ? <Badge variant="destructive">Error</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {derivedRatePlanMappings.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Derived Rate Plans (Channel Markup)</h4>
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
                        const rp = rpLookup[m.local_id];
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs font-medium">{rp?.name || '—'}</TableCell>
                            <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.local_id); toast.success('Copied!'); }}>{m.local_id}</TableCell>
                            <TableCell className="text-xs font-mono break-all cursor-pointer select-all" onClick={() => { navigator.clipboard.writeText(m.channex_id); toast.success('Copied!'); }}>{m.channex_id}</TableCell>
                            <TableCell>
                              {m.sync_status === 'error' ? <Badge variant="destructive">Error</Badge> : <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// ── Full Sync Result Dialog ──────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 w-6 p-0">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function FullSyncResultDialog({
  open,
  onOpenChange,
  result,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: FullSyncResult | null;
}) {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {result.errors.length === 0 ? '✅' : '⚠️'} Full Sync Complete
          </DialogTitle>
          <DialogDescription>
            Save these Task IDs for your Channex certification form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">
              Availability pushed: {result.room_types_pushed} room type{result.room_types_pushed !== 1 ? 's' : ''} × 500 days
            </p>
            {result.availability_task_ids.length > 0 ? (
              result.availability_task_ids.map((id, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 break-all">{id}</code>
                  <CopyButton text={id} />
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No task IDs returned</p>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">
              Rates & Restrictions pushed: {result.rate_plans_pushed} rate plan{result.rate_plans_pushed !== 1 ? 's' : ''} × 500 days
            </p>
            {result.rates_task_ids.length > 0 ? (
              result.rates_task_ids.map((id, i) => (
                <div key={i} className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 break-all">{id}</code>
                  <CopyButton text={id} />
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No task IDs returned</p>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 p-3 space-y-1">
              <p className="text-sm font-medium text-destructive">Errors ({result.errors.length})</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-destructive">{err}</p>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

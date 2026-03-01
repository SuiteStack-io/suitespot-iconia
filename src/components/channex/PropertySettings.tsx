import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Trash2, ExternalLink, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const COUNTRIES = [
  { code: 'EG', name: 'Egypt' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'TR', name: 'Turkey' },
];

const TIMEZONES = [
  'Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Istanbul',
];

const CURRENCIES = ['USD', 'EGP', 'EUR', 'GBP', 'AED', 'SAR'];

interface PropertyConfig {
  id?: string;
  property_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  zip_code: string;
  timezone: string;
  currency: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  channex_property_id: string | null;
}

interface RoomTypeGroup {
  name: string;
  units: string[];
  count: number;
  maxAdults: number;
  maxChildren: number;
  maxInfants: number;
}

interface MappingRecord {
  id: string;
  entity_type: string;
  local_id: string;
  channex_id: string;
  sync_status: string;
  last_synced_at: string | null;
}

export function PropertySettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PropertyConfig>({
    property_name: '', email: '', phone: '', address: '', city: '',
    country: 'EG', zip_code: '', timezone: 'Africa/Cairo', currency: 'USD',
    latitude: null, longitude: null, description: '', channex_property_id: null,
  });
  const [roomTypes, setRoomTypes] = useState<RoomTypeGroup[]>([]);
  const [mappingCounts, setMappingCounts] = useState({ properties: 0, room_types: 0, rate_plans: 0 });
  const [mappings, setMappings] = useState<MappingRecord[]>([]);
  const [logsCount, setLogsCount] = useState(0);
  const [bookingsCount, setBookingsCount] = useState(0);

  // Reset state
  const [resettingFull, setResettingFull] = useState(false);
  const [resettingMappings, setResettingMappings] = useState(false);
  const [resettingLogs, setResettingLogs] = useState(false);
  const [deletingSingle, setDeletingSingle] = useState<string | null>(null);
  const [includeLogs, setIncludeLogs] = useState(true);
  const [includeBookings, setIncludeBookings] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [configRes, unitsRes, mappingsRes, logsRes, bookingsRes] = await Promise.all([
        supabase.from('channex_property_config').select('*').limit(1).maybeSingle(),
        supabase.from('units').select('id, name, booking_com_name, unit_number, max_guests, max_children, max_infants').or('is_private.eq.false,is_private.is.null').order('unit_number'),
        supabase.from('channex_mappings').select('*').order('entity_type'),
        supabase.from('channex_sync_logs').select('id', { count: 'exact', head: true }),
        supabase.from('channex_bookings').select('id', { count: 'exact', head: true }),
      ]);

      if (configRes.data) setConfig(configRes.data as any);

      if (unitsRes.data) {
        const groups: Record<string, RoomTypeGroup> = {};
        for (const unit of unitsRes.data) {
          const name = unit.booking_com_name || unit.name;
          if (!groups[name]) {
            groups[name] = { name, units: [], count: 0, maxAdults: unit.max_guests || 2, maxChildren: unit.max_children || 0, maxInfants: unit.max_infants || 0 };
          }
          groups[name].units.push(unit.unit_number || unit.id);
          groups[name].count++;
        }
        setRoomTypes(Object.values(groups));
      }

      if (mappingsRes.data) {
        setMappings(mappingsRes.data as MappingRecord[]);
        const counts = { properties: 0, room_types: 0, rate_plans: 0 };
        for (const m of mappingsRes.data) {
          if (m.entity_type === 'property') counts.properties++;
          else if (m.entity_type === 'room_type') counts.room_types++;
          else if (m.entity_type === 'rate_plan') counts.rate_plans++;
        }
        setMappingCounts(counts);
      }

      setLogsCount(logsRes.count || 0);
      setBookingsCount(bookingsRes.count || 0);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.property_name) { toast.error('Property name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        property_name: config.property_name, email: config.email, phone: config.phone,
        address: config.address, city: config.city, country: config.country,
        zip_code: config.zip_code, timezone: config.timezone, currency: config.currency,
        latitude: config.latitude, longitude: config.longitude, description: config.description,
      };
      if (config.id) {
        const { error } = await supabase.from('channex_property_config').update(payload).eq('id', config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('channex_property_config').insert(payload).select().single();
        if (error) throw error;
        setConfig(prev => ({ ...prev, id: data.id }));
      }
      toast.success('Property configuration saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleResetFull = async () => {
    setResettingFull(true);
    try {
      const { data, error } = await supabase.functions.invoke('channex-reset-sync', {
        body: { mode: 'full', include_logs: includeLogs, include_bookings: includeBookings },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Full reset complete. Deleted ${data.deleted_count || 0} Channex entities.`);
        setConfig(prev => ({ ...prev, channex_property_id: null }));
        await fetchAll();
      } else {
        toast.error(data?.error || 'Reset failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setResettingFull(false);
    }
  };

  const handleResetMappings = async () => {
    setResettingMappings(true);
    try {
      const { data, error } = await supabase.functions.invoke('channex-reset-sync', {
        body: { mode: 'mappings_only' },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('All mappings cleared successfully.');
        setConfig(prev => ({ ...prev, channex_property_id: null }));
        await fetchAll();
      } else {
        toast.error(data?.error || 'Reset failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear mappings');
    } finally {
      setResettingMappings(false);
    }
  };

  const handleResetLogs = async () => {
    setResettingLogs(true);
    try {
      const { error } = await supabase.from('channex_sync_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('Sync logs cleared.');
      setLogsCount(0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear logs');
    } finally {
      setResettingLogs(false);
    }
  };

  const handleDeleteSingle = async (mapping: MappingRecord) => {
    setDeletingSingle(mapping.id);
    try {
      const { data, error } = await supabase.functions.invoke('channex-reset-sync', {
        body: { mode: 'single', mapping_id: mapping.id },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Deleted ${mapping.entity_type} mapping.`);
        await fetchAll();
      } else {
        toast.error(data?.error || 'Delete failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeletingSingle(null);
    }
  };

  const copyId = (id: string) => { navigator.clipboard.writeText(id); toast.success('Copied!'); };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const totalMappings = mappingCounts.properties + mappingCounts.room_types + mappingCounts.rate_plans;

  return (
    <div className="space-y-6">
      {/* Property Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Property Configuration</CardTitle>
              <CardDescription>Configure your Channex property details</CardDescription>
            </div>
            {config.channex_property_id && (
              <Badge className="bg-green-600 hover:bg-green-700">Synced</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.channex_property_id && (
            <div className="text-sm text-muted-foreground">
              Channex Property ID: <code className="bg-muted px-1 rounded">{config.channex_property_id}</code>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Property Name *</Label>
              <Input value={config.property_name} onChange={e => setConfig(p => ({ ...p, property_name: e.target.value }))} placeholder="ICONIA Zamalek - Boutique Stay & Wellness Residences" />
            </div>
            <div><Label>Email</Label><Input type="email" value={config.email} onChange={e => setConfig(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Phone</Label><Input value={config.phone} onChange={e => setConfig(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={config.address} onChange={e => setConfig(p => ({ ...p, address: e.target.value }))} /></div>
            <div><Label>City</Label><Input value={config.city} onChange={e => setConfig(p => ({ ...p, city: e.target.value }))} /></div>
            <div><Label>Zip Code</Label><Input value={config.zip_code} onChange={e => setConfig(p => ({ ...p, zip_code: e.target.value }))} /></div>
            <div>
              <Label>Country</Label>
              <Select value={config.country} onValueChange={v => setConfig(p => ({ ...p, country: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={config.timezone} onValueChange={v => setConfig(p => ({ ...p, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={config.currency} onValueChange={v => setConfig(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Latitude</Label><Input type="number" step="any" value={config.latitude ?? ''} onChange={e => setConfig(p => ({ ...p, latitude: e.target.value ? parseFloat(e.target.value) : null }))} /></div>
            <div><Label>Longitude</Label><Input type="number" step="any" value={config.longitude ?? ''} onChange={e => setConfig(p => ({ ...p, longitude: e.target.value ? parseFloat(e.target.value) : null }))} /></div>
            <div className="md:col-span-2"><Label>Description</Label><Textarea value={config.description || ''} onChange={e => setConfig(p => ({ ...p, description: e.target.value }))} rows={3} /></div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Room Type Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Room Type Summary</CardTitle>
              <CardDescription>Room types derived from your units — edit on the Room Types page</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/room-types')}>
              <ExternalLink className="h-4 w-4" />Edit Room Types
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {roomTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No room types found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead className="text-center">Count</TableHead>
                  <TableHead className="text-center">Max Adults</TableHead>
                  <TableHead className="text-center">Max Children</TableHead>
                  <TableHead className="text-center">Max Infants</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomTypes.map(rt => (
                  <TableRow key={rt.name}>
                    <TableCell className="font-medium">{rt.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rt.units.join(', ')}</TableCell>
                    <TableCell className="text-center">{rt.count}</TableCell>
                    <TableCell className="text-center">{rt.maxAdults}</TableCell>
                    <TableCell className="text-center">{rt.maxChildren}</TableCell>
                    <TableCell className="text-center">{rt.maxInfants}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ RESET CHANNEX SYNC ═══════════ */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Reset Channex Sync
          </CardTitle>
          <CardDescription>Clear sync data and start fresh</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Warning Banner */}
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ Warning:</strong> This will delete all Channex sync data from your PMS. You will need to re-sync your property, room types, and rate plans to Channex. This does NOT delete anything from Channex itself — you must delete incorrect properties directly in Channex.
            </AlertDescription>
          </Alert>

          {/* Current Sync Status */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Current Sync Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{mappingCounts.properties}</div>
                <div className="text-xs text-muted-foreground">Properties</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{mappingCounts.room_types}</div>
                <div className="text-xs text-muted-foreground">Room Types</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{mappingCounts.rate_plans}</div>
                <div className="text-xs text-muted-foreground">Rate Plans</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{logsCount}</div>
                <div className="text-xs text-muted-foreground">Sync Logs</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="text-2xl font-bold">{bookingsCount}</div>
                <div className="text-xs text-muted-foreground">Bookings</div>
              </div>
            </div>
          </div>

          {/* Mappings Table */}
          {mappings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Current Mappings ({totalMappings} total)</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Local ID</TableHead>
                      <TableHead>Channex ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Synced</TableHead>
                      <TableHead className="w-[60px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map(m => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{m.entity_type.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs break-all cursor-pointer select-all" onClick={() => copyId(m.local_id)}>{m.local_id}</TableCell>
                        <TableCell className="font-mono text-xs break-all cursor-pointer select-all" onClick={() => copyId(m.channex_id)}>{m.channex_id}</TableCell>
                        <TableCell>
                          <Badge variant={m.sync_status === 'synced' ? 'default' : 'secondary'} className={m.sync_status === 'synced' ? 'bg-green-600 hover:bg-green-700' : ''}>
                            {m.sync_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.last_synced_at ? new Date(m.last_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={deletingSingle === m.id}>
                                {deletingSingle === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this mapping?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the {m.entity_type.replace('_', ' ')} mapping and attempt to remove it from Channex. The item will show as "Not Synced" in your PMS.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSingle(m)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Reset Buttons */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Reset Actions</h4>
            <div className="flex flex-wrap gap-3">
              {/* Clear All */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2" disabled={totalMappings === 0 && logsCount === 0 && bookingsCount === 0}>
                    <Trash2 className="h-4 w-4" />Clear All Sync Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to reset all Channex sync data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all records from channex_mappings and attempt to remove properties from Channex. Your property, room types, and rate plans will show as "Not Synced" and you'll need to sync again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="include-logs" checked={includeLogs} onCheckedChange={(c) => setIncludeLogs(!!c)} />
                      <label htmlFor="include-logs" className="text-sm">Also clear sync logs ({logsCount} records)</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="include-bookings" checked={includeBookings} onCheckedChange={(c) => setIncludeBookings(!!c)} />
                      <label htmlFor="include-bookings" className="text-sm">Also clear Channex bookings ({bookingsCount} records)</label>
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetFull} disabled={resettingFull} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {resettingFull && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Yes, Reset Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Clear Mappings Only */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30" disabled={totalMappings === 0}>
                    <Trash2 className="h-4 w-4" />Clear Property Mappings Only
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear property mappings?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all mapping records without calling the Channex API. Your bookings and sync logs will be preserved. You'll need to re-sync your property.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetMappings} disabled={resettingMappings} className="bg-amber-600 text-white hover:bg-amber-700">
                      {resettingMappings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Clear Mappings
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Clear Logs Only */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="secondary" className="gap-2" disabled={logsCount === 0}>
                    <Trash2 className="h-4 w-4" />Clear Sync Logs
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear sync logs?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all {logsCount} sync log records. Mappings and bookings will not be affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetLogs} disabled={resettingLogs}>
                      {resettingLogs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Clear Logs
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Channex Cleanup Reminder */}
          <Alert className="border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 [&>svg]:text-blue-600">
            <Info className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-medium text-blue-900 dark:text-blue-200">📝 Remember: After clearing sync data here, you should also delete any incorrectly created properties in Channex directly:</p>
              <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>Go to staging.channex.io</li>
                <li>Click Properties</li>
                <li>Delete any properties that were created incorrectly</li>
                <li>Then come back here and sync fresh</li>
              </ol>
              <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => window.open('https://staging.channex.io', '_blank')}>
                <ExternalLink className="h-4 w-4" />Open Channex Dashboard
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

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
import { Loader2, Save, Trash2, ExternalLink } from 'lucide-react';
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

export function PropertySettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [config, setConfig] = useState<PropertyConfig>({
    property_name: '', email: '', phone: '', address: '', city: '',
    country: 'EG', zip_code: '', timezone: 'Africa/Cairo', currency: 'USD',
    latitude: null, longitude: null, description: '', channex_property_id: null,
  });
  const [roomTypes, setRoomTypes] = useState<RoomTypeGroup[]>([]);
  const [mappingCounts, setMappingCounts] = useState({ properties: 0, room_types: 0, rate_plans: 0 });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [configRes, unitsRes, mappingsRes] = await Promise.all([
        supabase.from('channex_property_config').select('*').limit(1).maybeSingle(),
        supabase.from('units').select('id, name, booking_com_name, unit_number, max_guests, max_children, max_infants').eq('location', 'ICONIA').or('is_private.eq.false,is_private.is.null').order('unit_number'),
        supabase.from('channex_mappings').select('entity_type'),
      ]);

      if (configRes.data) {
        setConfig(configRes.data as any);
      }

      // Group units by room type name
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
        const counts = { properties: 0, room_types: 0, rate_plans: 0 };
        for (const m of mappingsRes.data) {
          if (m.entity_type === 'property') counts.properties++;
          else if (m.entity_type === 'room_type') counts.room_types++;
          else if (m.entity_type === 'rate_plan') counts.rate_plans++;
        }
        setMappingCounts(counts);
      }
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.property_name) {
      toast.error('Property name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        property_name: config.property_name,
        email: config.email,
        phone: config.phone,
        address: config.address,
        city: config.city,
        country: config.country,
        zip_code: config.zip_code,
        timezone: config.timezone,
        currency: config.currency,
        latitude: config.latitude,
        longitude: config.longitude,
        description: config.description,
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

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('channex-reset-sync');
      if (error) throw error;
      if (data?.success) {
        toast.success(`Reset complete. Deleted ${data.deleted_count || 0} Channex entities.`);
        setConfig(prev => ({ ...prev, channex_property_id: null }));
        await fetchAll();
      } else {
        toast.error(data?.error || 'Reset failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const totalMappings = mappingCounts.properties + mappingCounts.room_types + mappingCounts.rate_plans;

  return (
    <div className="space-y-6">
      {/* Section A: Property Configuration */}
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
            <div>
              <Label>Email</Label>
              <Input type="email" value={config.email} onChange={e => setConfig(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={config.phone} onChange={e => setConfig(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Input value={config.address} onChange={e => setConfig(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={config.city} onChange={e => setConfig(p => ({ ...p, city: e.target.value }))} />
            </div>
            <div>
              <Label>Zip Code</Label>
              <Input value={config.zip_code} onChange={e => setConfig(p => ({ ...p, zip_code: e.target.value }))} />
            </div>
            <div>
              <Label>Country</Label>
              <Select value={config.country} onValueChange={v => setConfig(p => ({ ...p, country: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={config.timezone} onValueChange={v => setConfig(p => ({ ...p, timezone: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={config.currency} onValueChange={v => setConfig(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Latitude</Label>
              <Input type="number" step="any" value={config.latitude ?? ''} onChange={e => setConfig(p => ({ ...p, latitude: e.target.value ? parseFloat(e.target.value) : null }))} />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input type="number" step="any" value={config.longitude ?? ''} onChange={e => setConfig(p => ({ ...p, longitude: e.target.value ? parseFloat(e.target.value) : null }))} />
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea value={config.description || ''} onChange={e => setConfig(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Section B: Room Type Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Room Type Summary</CardTitle>
              <CardDescription>Room types derived from your units — edit on the Room Types page</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/room-types')}>
              <ExternalLink className="h-4 w-4" />
              Edit Room Types
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

      {/* Section C: Reset Sync */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Reset Channex Sync</CardTitle>
          <CardDescription>Delete all synced entities from Channex and clear local mappings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Current mappings: {mappingCounts.properties} properties, {mappingCounts.room_types} room types, {mappingCounts.rate_plans} rate plans</p>
          </div>
          {totalMappings > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete All from Channex and Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Channex Sync?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {totalMappings} synced entities from Channex (properties, room types, rate plans) and clear all local mappings. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} disabled={resetting}>
                    {resetting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Yes, Reset Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <p className="text-sm text-muted-foreground">No mappings to reset.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

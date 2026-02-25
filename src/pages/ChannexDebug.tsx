import { useState, useEffect, useCallback } from 'react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import {
  Zap, RefreshCw, Upload, DollarSign, BookOpen, Eye,
  ChevronDown, Copy, Check, Loader2, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';

// ============================================================================
// Shared Components
// ============================================================================

function JsonPanel({ label, data, duration }: { label: string; data: any; duration?: number }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);
  const text = JSON.stringify(data, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full">
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        {label}
        {duration != null && (
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            <Clock className="h-3 w-3 mr-1" />{duration}ms
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="relative">
          <Button size="icon" variant="ghost" className="absolute right-2 top-2 h-7 w-7" onClick={copy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
          <pre className="bg-[hsl(var(--muted))] text-foreground text-xs p-4 rounded-lg overflow-auto max-h-96 font-mono whitespace-pre-wrap break-all">
            {text}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function StatusBadge({ success }: { success: boolean | null }) {
  if (success === null) return null;
  return success
    ? <Badge className="bg-green-600 text-white">Success</Badge>
    : <Badge variant="destructive">Error</Badge>;
}

// ============================================================================
// Main Page
// ============================================================================

const ChannexDebug = () => {
  const { userRole } = useAuth();
  const propertyId = usePropertyId();

  // Shared data
  const [units, setUnits] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [ratePlans, setRatePlans] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [u, m, r] = await Promise.all([
        withPropertyFilter(supabase.from('units').select('id, name, unit_number, booking_com_name'), propertyId).order('name'),
        supabase.from('channex_mappings').select('*').eq('sync_status', 'synced'),
        withPropertyFilter(supabase.from('rate_plans').select('id, name').eq('is_active', true), propertyId),
      ]);
      setUnits(u.data || []);
      setMappings(m.data || []);
      setRatePlans(r.data || []);
    };
    load();
  }, []);

  const propertyMappings = mappings.filter(m => m.entity_type === 'property');
  const roomTypeMappings = mappings.filter(m => m.entity_type === 'room_type');
  const ratePlanMappings = mappings.filter(m => m.entity_type === 'rate_plan');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Channex Debug</h1>
          </div>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="PMS" currentPage="Channex Debug" />
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <Test1ApiConnection />
        <Test2PropertySync />
        <Test3AvailabilityPush units={units} roomTypeMappings={roomTypeMappings} />
        <Test4RatePush units={units} ratePlanMappings={ratePlanMappings} ratePlans={ratePlans} />
        <Test5SimulateBooking propertyMappings={propertyMappings} />
        <Test6ViewState units={units} propertyMappings={propertyMappings} />
      </div>
    </div>
  );
};

// ============================================================================
// Test 1: API Connection
// ============================================================================

function Test1ApiConnection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | undefined>();

  const run = async () => {
    setLoading(true); setResult(null); setSuccess(null);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('channex-health-check');
      setDuration(Date.now() - start);
      if (error) throw error;
      setResult(data);
      setSuccess(data?.status !== 'error');
    } catch (err: any) {
      setDuration(Date.now() - start);
      setResult({ error: err.message });
      setSuccess(false);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Test 1: API Connection</CardTitle>
          <StatusBadge success={success} />
        </div>
        <CardDescription>Test Channex API connectivity and check overall health</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Test Connection
        </Button>
        {result && <JsonPanel label="Response" data={result} duration={duration} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Test 2: Property Sync
// ============================================================================

function Test2PropertySync() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | undefined>();

  const run = async () => {
    setLoading(true); setResult(null); setSuccess(null);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('channex-sync-property');
      setDuration(Date.now() - start);
      if (error) throw error;
      setResult(data);
      setSuccess(true);
    } catch (err: any) {
      setDuration(Date.now() - start);
      setResult({ error: err.message });
      setSuccess(false);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Test 2: Manual Property Sync</CardTitle>
          <StatusBadge success={success} />
        </div>
        <CardDescription>Sync the property (from channex_property_config) to Channex with all room types and rate plans</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync Property
        </Button>
        {result && <JsonPanel label="Response" data={result} duration={duration} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Test 3: Availability Push
// ============================================================================

function Test3AvailabilityPush({ units, roomTypeMappings }: { units: any[]; roomTypeMappings: any[] }) {
  const [unitId, setUnitId] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [availability, setAvailability] = useState('1');
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | undefined>();

  const run = async () => {
    if (!unitId || !roomTypeId) return;
    setLoading(true); setResult(null); setSuccess(null);
    const body = {
      property_id: unitId,
      room_type_id: roomTypeId,
      date_from: dateFrom,
      date_to: dateTo,
      availability: parseInt(availability),
    };
    setRequest(body);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('channex-push-availability', { body });
      setDuration(Date.now() - start);
      if (error) throw error;
      setResult(data);
      setSuccess(true);
    } catch (err: any) {
      setDuration(Date.now() - start);
      setResult({ error: err.message });
      setSuccess(false);
    }
    setLoading(false);
  };

  const mappedUnits = units.filter(u => roomTypeMappings.some(m => m.local_id === u.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Test 3: Manual Availability Push</CardTitle>
          <StatusBadge success={success} />
        </div>
        <CardDescription>Push availability to Channex for a room type</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Property</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>
                {mappedUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Room Type (Mapping)</Label>
            <Select value={roomTypeId} onValueChange={setRoomTypeId}>
              <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
              <SelectContent>
                {roomTypeMappings.map(m => {
                  const unit = units.find(u => u.id === m.local_id);
                  return (
                    <SelectItem key={m.id} value={m.local_id}>
                      {unit?.booking_com_name || unit?.name || m.local_id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Availability</Label>
            <Input type="number" min="0" value={availability} onChange={e => setAvailability(e.target.value)} />
          </div>
          <div>
            <Label>Date From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Date To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <Button onClick={run} disabled={loading || !unitId || !roomTypeId}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Push Availability
        </Button>
        {request && <JsonPanel label="Request" data={request} />}
        {result && <JsonPanel label="Response" data={result} duration={duration} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Test 4: Rate Push
// ============================================================================

function Test4RatePush({ units, ratePlanMappings, ratePlans }: { units: any[]; ratePlanMappings: any[]; ratePlans: any[] }) {
  const [unitId, setUnitId] = useState('');
  const [ratePlanId, setRatePlanId] = useState('');
  const [dateFrom, setDateFrom] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [rateAmount, setRateAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | undefined>();

  const run = async () => {
    if (!unitId || !ratePlanId) return;
    setLoading(true); setResult(null); setSuccess(null);
    const body = {
      property_id: unitId,
      rate_plan_id: ratePlanId,
      date_from: dateFrom,
      date_to: dateTo,
      rate: parseFloat(rateAmount),
    };
    setRequest(body);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('channex-push-rates', { body });
      setDuration(Date.now() - start);
      if (error) throw error;
      setResult(data);
      setSuccess(true);
    } catch (err: any) {
      setDuration(Date.now() - start);
      setResult({ error: err.message });
      setSuccess(false);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Test 4: Manual Rate Push</CardTitle>
          <StatusBadge success={success} />
        </div>
        <CardDescription>Push rate to Channex for a rate plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label>Property</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rate Plan</Label>
            <Select value={ratePlanId} onValueChange={setRatePlanId}>
              <SelectTrigger><SelectValue placeholder="Select rate plan" /></SelectTrigger>
              <SelectContent>
                {ratePlanMappings.map(m => {
                  const plan = ratePlans.find(r => r.id === m.local_id);
                  return (
                    <SelectItem key={m.id} value={m.local_id}>
                      {plan?.name || m.local_id}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rate Amount ($)</Label>
            <Input type="number" min="0" step="0.01" value={rateAmount} onChange={e => setRateAmount(e.target.value)} />
          </div>
          <div>
            <Label>Date From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label>Date To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <Button onClick={run} disabled={loading || !unitId || !ratePlanId}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DollarSign className="h-4 w-4 mr-2" />}
          Push Rate
        </Button>
        {request && <JsonPanel label="Request" data={request} />}
        {result && <JsonPanel label="Response" data={result} duration={duration} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Test 5: Simulate Booking
// ============================================================================

function Test5SimulateBooking({ propertyMappings }: { propertyMappings: any[] }) {
  const [loading, setLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [success, setSuccess] = useState<boolean | null>(null);

  const run = async () => {
    if (propertyMappings.length === 0) {
      toast({ title: 'No property mappings', description: 'Sync a property first.', variant: 'destructive' });
      return;
    }
    setLoading(true); setResult(null); setSuccess(null);
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const departure = format(addDays(new Date(), 4), 'yyyy-MM-dd');
    const testId = `test-${crypto.randomUUID()}`;
    const record = {
      channex_booking_id: testId,
      ota_name: 'Test/Debug',
      guest_name: 'Test Guest',
      guest_email: 'test@debug.local',
      status: 'new',
      arrival_date: tomorrow,
      departure_date: departure,
      total_amount: 100,
      currency: 'USD',
      acknowledged: false,
      property_id: propertyMappings[0].local_id,
    };
    try {
      const { data, error } = await supabase.from('channex_bookings').insert(record).select().single();
      if (error) throw error;
      setResult(data);
      setSuccess(true);
      toast({ title: 'Test booking created' });
    } catch (err: any) {
      setResult({ error: err.message });
      setSuccess(false);
    }
    setLoading(false);
  };

  const cleanup = async () => {
    setCleanLoading(true);
    try {
      const { error, count } = await supabase
        .from('channex_bookings')
        .delete({ count: 'exact' })
        .eq('ota_name', 'Test/Debug');
      if (error) throw error;
      toast({ title: `Cleaned up ${count || 0} test booking(s)` });
      setResult(null);
      setSuccess(null);
    } catch (err: any) {
      toast({ title: 'Cleanup failed', description: err.message, variant: 'destructive' });
    }
    setCleanLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Test 5: Simulate Incoming Booking</CardTitle>
          <StatusBadge success={success} />
        </div>
        <CardDescription>Insert a test booking record into channex_bookings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BookOpen className="h-4 w-4 mr-2" />}
            Create Test Booking
          </Button>
          <Button variant="outline" onClick={cleanup} disabled={cleanLoading}>
            {cleanLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Delete Test Bookings
          </Button>
        </div>
        {result && <JsonPanel label="Result" data={result} />}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Test 6: View Channex State
// ============================================================================

function Test6ViewState({ units, propertyMappings }: { units: any[]; propertyMappings: any[] }) {
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [duration, setDuration] = useState<number | undefined>();

  const mappedUnits = units.filter(u => propertyMappings.some(m => m.local_id === u.id));

  const run = async () => {
    if (!unitId) return;
    setLoading(true); setResult(null); setSuccess(null);
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('channex-fetch-state', {
        body: { property_id: unitId },
      });
      setDuration(Date.now() - start);
      if (error) throw error;
      setResult(data);
      setSuccess(true);
    } catch (err: any) {
      setDuration(Date.now() - start);
      setResult({ error: err.message });
      setSuccess(false);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Test 6: View Channex State</CardTitle>
          <StatusBadge success={success} />
        </div>
        <CardDescription>Fetch live data from Channex for a property</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label>Property (mapped only)</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>
                {mappedUnits.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.unit_number})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={run} disabled={loading || !unitId}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Fetch State
          </Button>
        </div>
        {result && !result.error && (
          <div className="space-y-3">
            <JsonPanel label="Property" data={result.property} duration={duration} />
            <JsonPanel label="Room Types" data={result.room_types} />
            <JsonPanel label="Rate Plans" data={result.rate_plans} />
            <JsonPanel label="Availability" data={result.availability} />
          </div>
        )}
        {result?.error && <JsonPanel label="Error" data={result} duration={duration} />}
      </CardContent>
    </Card>
  );
}

export default ChannexDebug;

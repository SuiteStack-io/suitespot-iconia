import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RatePlanOption {
  id: string;
  name: string;
  room_type: string | null;
}

interface BulkRestrictionEditorProps {
  ratePlans: RatePlanOption[];
  onSaved?: () => void;
}

export function BulkRestrictionEditor({ ratePlans, onSaved }: BulkRestrictionEditorProps) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Restriction toggles
  const [enableMinStay, setEnableMinStay] = useState(false);
  const [enableMaxStay, setEnableMaxStay] = useState(false);
  const [enableStopSell, setEnableStopSell] = useState(false);
  const [enableCTA, setEnableCTA] = useState(false);
  const [enableCTD, setEnableCTD] = useState(false);

  // Values
  const [minStay, setMinStay] = useState(1);
  const [maxStay, setMaxStay] = useState(30);
  const [stopSell, setStopSell] = useState(false);
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validate = (): string | null => {
    if (!dateFrom) return 'Please select a start date';
    if (!dateTo) return 'Please select an end date';
    if (dateFrom < today) return 'Start date must be today or future';
    if (dateTo < dateFrom) return 'End date must be after start date';
    if (!enableMinStay && !enableMaxStay && !enableStopSell && !enableCTA && !enableCTD)
      return 'Please enable at least one restriction';
    if (enableMinStay && minStay < 1) return 'Min stay must be at least 1';
    if (enableMaxStay && enableMinStay && maxStay <= minStay) return 'Max stay must be greater than min stay';
    return null;
  };

  const getTargetPlanIds = () => {
    if (selectedPlanId === 'all') return ratePlans.map((p) => p.id);
    return [selectedPlanId];
  };

  const handleApply = async () => {
    const err = validate();
    if (err) {
      toast({ title: 'Validation Error', description: err, variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const planIds = getTargetPlanIds();
      const rows = planIds.map((rpId) => ({
        rate_plan_id: rpId,
        date_from: format(dateFrom!, 'yyyy-MM-dd'),
        date_to: format(addDays(dateTo!, 1), 'yyyy-MM-dd'),
        min_stay: enableMinStay ? minStay : 1,
        max_stay: enableMaxStay ? maxStay : null,
        stop_sell: enableStopSell ? stopSell : false,
        closed_to_arrival: enableCTA ? closedToArrival : false,
        closed_to_departure: enableCTD ? closedToDeparture : false,
        synced_to_channex: false,
      }));

      const { error } = await supabase.from('rate_plan_restrictions').insert(rows);
      if (error) throw error;

      // Trigger Channex push
      try {
        await supabase.functions.invoke('channex-push-restrictions', {
          body: { rate_plan_ids: planIds },
        });
      } catch {
        // Non-fatal - restrictions are saved locally
      }

      toast({ title: 'Success', description: `Restrictions applied to ${planIds.length} rate plan(s) and syncing to Channex` });
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!dateFrom || !dateTo) {
      toast({ title: 'Error', description: 'Select a date range to clear', variant: 'destructive' });
      return;
    }
    setClearing(true);
    try {
      const planIds = getTargetPlanIds();
      // Delete restrictions overlapping the date range for selected plans
      for (const rpId of planIds) {
        await supabase
          .from('rate_plan_restrictions')
          .delete()
          .eq('rate_plan_id', rpId)
          .lte('date_from', format(dateTo!, 'yyyy-MM-dd'))
          .gte('date_to', format(dateFrom!, 'yyyy-MM-dd'));
      }
      toast({ title: 'Cleared', description: 'Restrictions removed for the selected date range' });
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk Restriction Editor</CardTitle>
        <p className="text-xs text-muted-foreground">
          Apply or clear date-specific restrictions for one or all rate plans.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rate Plan Selector */}
        <div className="space-y-1.5">
          <Label className="text-sm">Rate Plan</Label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rate Plans</SelectItem>
              {ratePlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} {p.room_type && `(${p.room_type})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Date From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} disabled={(d) => d < today} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Date To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} disabled={(d) => d < (dateFrom || today)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Restriction Options */}
        <div className="space-y-3 border rounded-md p-4">
          <p className="text-sm font-medium">Restrictions</p>

          <div className="flex items-center gap-3">
            <Checkbox checked={enableMinStay} onCheckedChange={(v) => setEnableMinStay(!!v)} />
            <Label className="text-sm flex-1">Min Stay</Label>
            {enableMinStay && (
              <Input type="number" min={1} max={30} value={minStay} onChange={(e) => setMinStay(parseInt(e.target.value) || 1)} className="w-20" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={enableMaxStay} onCheckedChange={(v) => setEnableMaxStay(!!v)} />
            <Label className="text-sm flex-1">Max Stay</Label>
            {enableMaxStay && (
              <Input type="number" min={1} max={365} value={maxStay} onChange={(e) => setMaxStay(parseInt(e.target.value) || 30)} className="w-20" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={enableStopSell} onCheckedChange={(v) => { setEnableStopSell(!!v); setStopSell(!!v); }} />
            <Label className="text-sm flex-1">Stop Sell</Label>
            {enableStopSell && <Switch checked={stopSell} onCheckedChange={setStopSell} />}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={enableCTA} onCheckedChange={(v) => { setEnableCTA(!!v); setClosedToArrival(!!v); }} />
            <Label className="text-sm flex-1">Closed to Arrival</Label>
            {enableCTA && <Switch checked={closedToArrival} onCheckedChange={setClosedToArrival} />}
          </div>

          <div className="flex items-center gap-3">
            <Checkbox checked={enableCTD} onCheckedChange={(v) => { setEnableCTD(!!v); setClosedToDeparture(!!v); }} />
            <Label className="text-sm flex-1">Closed to Departure</Label>
            {enableCTD && <Switch checked={closedToDeparture} onCheckedChange={setClosedToDeparture} />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleApply} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply Restrictions
          </Button>
          <Button variant="outline" onClick={handleClear} disabled={clearing}>
            {clearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Clear Restrictions for Range
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

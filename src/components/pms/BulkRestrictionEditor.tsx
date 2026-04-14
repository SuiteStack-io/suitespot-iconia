import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, Loader2, RefreshCw, CheckCircle2, AlertCircle, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RatePlanOption {
  id: string;
  name: string;
  room_type: string | null;
}

export interface PendingRestriction {
  id: string;
  ratePlanId: string;
  ratePlanName: string;
  roomTypeName: string;
  dateFrom: string;
  dateTo: string;
  restrictions: {
    rate?: number;
    minStayArrival?: number;
    minStayThrough?: number;
    maxStay?: number;
    stopSell?: boolean;
    closedToArrival?: boolean;
    closedToDeparture?: boolean;
  };
  addedAt: Date;
}

interface BulkRestrictionEditorProps {
  ratePlans: RatePlanOption[];
  onSaved?: () => void;
  onRatePlanFocused?: (id: string) => void;
  pendingRestrictions: PendingRestriction[];
  setPendingRestrictions: React.Dispatch<React.SetStateAction<PendingRestriction[]>>;
}

interface CurrentRates {
  weekday_rate: number;
  weekend_rate: number;
  off_peak_rate: number | null;
}

interface DerivedMarkup {
  channel_name: string;
  markup_percentage: number;
}

export function BulkRestrictionEditor({ ratePlans, onSaved, onRatePlanFocused, pendingRestrictions, setPendingRestrictions }: BulkRestrictionEditorProps) {
  const { toast } = useToast();
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [clearing, setClearing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Current rates display state
  const [currentRates, setCurrentRates] = useState<CurrentRates | null>(null);
  const [derivedMarkups, setDerivedMarkups] = useState<DerivedMarkup[]>([]);
  const [hasDateOverrides, setHasDateOverrides] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Derived room types
  const roomTypes = useMemo(
    () => [...new Set(ratePlans.map((p) => p.room_type).filter(Boolean))] as string[],
    [ratePlans]
  );

  // Filtered rate plans based on selected room type
  const filteredRatePlans = useMemo(() => {
    if (selectedRoomType === 'all') return ratePlans;
    return ratePlans.filter((p) => p.room_type === selectedRoomType);
  }, [ratePlans, selectedRoomType]);

  // Reset rate plan when room type changes
  useEffect(() => {
    setSelectedPlanId('all');
  }, [selectedRoomType]);

  // Fetch current rates when room type changes
  useEffect(() => {
    if (selectedRoomType === 'all') {
      setCurrentRates(null);
      setDerivedMarkups([]);
      setHasDateOverrides(false);
      return;
    }

    const fetchRates = async () => {
      setRatesLoading(true);
      try {
        // Find rate plans for this room type
        const matchingPlans = ratePlans.filter((p) => p.room_type === selectedRoomType);
        if (matchingPlans.length === 0) {
          setCurrentRates(null);
          setDerivedMarkups([]);
          setHasDateOverrides(false);
          return;
        }

        const planIds = matchingPlans.map((p) => p.id);

        // Fetch base rates, derived markups, and date overrides in parallel
        const [pricesRes, markupsRes, overridesRes] = await Promise.all([
          supabase
            .from('rate_plan_prices')
            .select('weekday_rate, weekend_rate, off_peak_rate')
            .in('rate_plan_id', planIds)
            .is('unit_id', null)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('derived_rate_plan_mappings')
            .select('channel_name, markup_percentage')
            .in('base_rate_plan_id', planIds),
          supabase
            .from('rate_plan_date_overrides')
            .select('id', { count: 'exact', head: true })
            .in('rate_plan_id', planIds),
        ]);

        if (pricesRes.data) {
          setCurrentRates({
            weekday_rate: Number(pricesRes.data.weekday_rate),
            weekend_rate: Number(pricesRes.data.weekend_rate),
            off_peak_rate: pricesRes.data.off_peak_rate != null ? Number(pricesRes.data.off_peak_rate) : null,
          });
        } else {
          setCurrentRates(null);
        }

        setDerivedMarkups(markupsRes.data || []);
        setHasDateOverrides((overridesRes.count ?? 0) > 0);
      } catch (err) {
        console.error('Error fetching current rates:', err);
        setCurrentRates(null);
        setDerivedMarkups([]);
        setHasDateOverrides(false);
      } finally {
        setRatesLoading(false);
      }
    };

    fetchRates();
  }, [selectedRoomType, ratePlans]);

  // Restriction toggles
  const [enableRate, setEnableRate] = useState(false);
  const [enableMinStayArrival, setEnableMinStayArrival] = useState(false);
  const [enableMinStayThrough, setEnableMinStayThrough] = useState(false);
  const [enableMaxStay, setEnableMaxStay] = useState(false);
  const [enableStopSell, setEnableStopSell] = useState(false);
  const [enableCTA, setEnableCTA] = useState(false);
  const [enableCTD, setEnableCTD] = useState(false);

  // Values
  const [rate, setRate] = useState(100);
  const [minStayArrival, setMinStayArrival] = useState(2);
  const [minStayThrough, setMinStayThrough] = useState(2);
  const [maxStay, setMaxStay] = useState(30);
  const [stopSell, setStopSell] = useState(false);
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);

  // Sync status
  const [pendingDbCount, setPendingDbCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingRestrictions.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved restriction changes that will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingRestrictions.length]);

  const fetchSyncStatus = useCallback(async () => {
    const [{ count }, { data: lastLog }] = await Promise.all([
      supabase
        .from('rate_plan_restrictions')
        .select('*', { count: 'exact', head: true })
        .eq('synced_to_channex', false),
      supabase
        .from('channex_sync_logs')
        .select('created_at')
        .eq('function_name', 'channex-push-restrictions')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setPendingDbCount(count ?? 0);
    setLastSyncTime(lastLog?.created_at ?? null);
  }, []);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  const validate = (): string | null => {
    if (!dateFrom) return 'Please select a start date';
    if (!dateTo) return 'Please select an end date';
    if (dateFrom < today) return 'Start date must be today or future';
    if (dateTo < dateFrom) return 'End date must be after start date';
    if (!enableRate && !enableMinStayArrival && !enableMinStayThrough && !enableMaxStay && !enableStopSell && !enableCTA && !enableCTD)
      return 'Please enable at least one restriction or rate';
    if (enableRate && rate <= 0) return 'Rate must be greater than 0';
    if (enableMinStayArrival && minStayArrival < 1) return 'Min Stay Arrival must be at least 1';
    if (enableMinStayThrough && minStayThrough < 1) return 'Min Stay Through must be at least 1';
    if (enableMaxStay && enableMinStayArrival && maxStay < minStayArrival) return 'Max stay must be >= Min Stay Arrival';
    if (enableMaxStay && enableMinStayThrough && maxStay < minStayThrough) return 'Max stay must be >= Min Stay Through';
    return null;
  };

  const getTargetPlans = () => {
    if (selectedPlanId === 'all') return filteredRatePlans;
    const plan = ratePlans.find((p) => p.id === selectedPlanId);
    return plan ? [plan] : [];
  };

  const resetForm = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setEnableRate(false);
    setEnableMinStayArrival(false);
    setEnableMinStayThrough(false);
    setEnableMaxStay(false);
    setEnableStopSell(false);
    setEnableCTA(false);
    setEnableCTD(false);
    setRate(100);
    setMinStayArrival(2);
    setMinStayThrough(2);
    setMaxStay(30);
    setStopSell(false);
    setClosedToArrival(false);
    setClosedToDeparture(false);
  };

  const handleApply = () => {
    const err = validate();
    if (err) {
      toast({ title: 'Validation Error', description: err, variant: 'destructive' });
      return;
    }

    if (enableStopSell && stopSell && enableCTA && closedToArrival) {
      toast({ title: 'Warning', description: 'Stop Sell already blocks all arrivals — Closed to Arrival is redundant' });
    }

    const targetPlans = getTargetPlans();
    const restrictions: PendingRestriction['restrictions'] = {};
    if (enableRate) restrictions.rate = rate;
    if (enableMinStayArrival) restrictions.minStayArrival = minStayArrival;
    if (enableMinStayThrough) restrictions.minStayThrough = minStayThrough;
    if (enableMaxStay) restrictions.maxStay = maxStay;
    if (enableStopSell) restrictions.stopSell = stopSell;
    if (enableCTA) restrictions.closedToArrival = closedToArrival;
    if (enableCTD) restrictions.closedToDeparture = closedToDeparture;

    const newPending: PendingRestriction[] = targetPlans.map((plan) => ({
      id: crypto.randomUUID(),
      ratePlanId: plan.id,
      ratePlanName: plan.name,
      roomTypeName: plan.room_type || 'All',
      dateFrom: format(dateFrom!, 'yyyy-MM-dd'),
      dateTo: format(dateTo!, 'yyyy-MM-dd'),
      restrictions,
      addedAt: new Date(),
    }));

    setPendingRestrictions((prev) => [...prev, ...newPending]);
    resetForm();
    toast({ title: 'Added', description: `${newPending.length} restriction(s) added to pending changes` });
  };

  const handleRemovePending = (id: string) => {
    setPendingRestrictions((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveAllChanges = async () => {
    if (pendingRestrictions.length === 0) return;
    setIsSaving(true);
    try {
      const rows = pendingRestrictions.map((p) => {
        const row: any = {
          rate_plan_id: p.ratePlanId,
          date_from: p.dateFrom,
          date_to: format(addDays(new Date(p.dateTo), 1), 'yyyy-MM-dd'),
          synced_to_channex: false,
        };
        if (p.restrictions.rate !== undefined) row.rate = p.restrictions.rate;
        if (p.restrictions.minStayArrival !== undefined) row.min_stay_arrival = p.restrictions.minStayArrival;
        if (p.restrictions.minStayThrough !== undefined) row.min_stay_through = p.restrictions.minStayThrough;
        if (p.restrictions.maxStay !== undefined) row.max_stay = p.restrictions.maxStay;
        if (p.restrictions.stopSell !== undefined) row.stop_sell = p.restrictions.stopSell;
        if (p.restrictions.closedToArrival !== undefined) row.closed_to_arrival = p.restrictions.closedToArrival;
        if (p.restrictions.closedToDeparture !== undefined) row.closed_to_departure = p.restrictions.closedToDeparture;
        return row;
      });

      const { error } = await supabase.from('rate_plan_restrictions').insert(rows);
      if (error) throw error;

      const uniquePlanIds = [...new Set(pendingRestrictions.map((p) => p.ratePlanId))];

      // Single Channex sync call
      try {
        await supabase.functions.invoke('channex-push-restrictions', {
          body: { rate_plan_ids: uniquePlanIds },
        });
      } catch { /* non-fatal */ }

      toast({ title: 'Saved', description: `${rows.length} restriction(s) saved and synced` });
      setPendingRestrictions([]);
      fetchSyncStatus();
      onSaved?.();

      if (uniquePlanIds.length === 1 && onRatePlanFocused) {
        onRatePlanFocused(uniquePlanIds[0]);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!dateFrom || !dateTo) {
      toast({ title: 'Error', description: 'Select a date range to clear', variant: 'destructive' });
      return;
    }
    setClearing(true);
    try {
      const targetPlans = getTargetPlans();
      for (const plan of targetPlans) {
        await supabase
          .from('rate_plan_restrictions')
          .delete()
          .eq('rate_plan_id', plan.id)
          .lte('date_from', format(dateTo!, 'yyyy-MM-dd'))
          .gte('date_to', format(dateFrom!, 'yyyy-MM-dd'));
      }
      toast({ title: 'Cleared', description: 'Restrictions removed for the selected date range' });
      fetchSyncStatus();
      onSaved?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke('channex-push-restrictions');
      toast({ title: 'Synced', description: 'Restrictions pushed to Channex' });
      fetchSyncStatus();
    } catch (err: any) {
      toast({ title: 'Sync Error', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const allRatePlansLabel = useMemo(() => {
    if (selectedRoomType === 'all') return 'All Rate Plans';
    return `All ${selectedRoomType} Rate Plans`;
  }, [selectedRoomType]);

  return (
    <div className="space-y-4">
      {/* Editor Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk Restriction Editor</CardTitle>
          <p className="text-xs text-muted-foreground">
            Apply or clear date-specific restrictions for one or multiple rate plans.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Room Type + Rate Plan Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Room Type</Label>
              <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Room Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  {roomTypes.map((rt) => (
                    <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Rate Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder={allRatePlansLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{allRatePlansLabel}</SelectItem>
                  {filteredRatePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {selectedRoomType === 'all'
                        ? `${p.name}${p.room_type ? ` (${p.room_type})` : ''}`
                        : p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current Rates Display */}
          {selectedRoomType !== 'all' && (
            <div className="bg-muted/50 border rounded-md p-3 space-y-1">
              <p className="text-sm font-medium">Current Rates — {selectedRoomType}</p>
              {ratesLoading ? (
                <p className="text-xs text-muted-foreground">Loading rates…</p>
              ) : currentRates ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Standard: Weekday ${currentRates.weekday_rate} · Weekend ${currentRates.weekend_rate}
                    {currentRates.off_peak_rate != null && ` · Off-Peak $${currentRates.off_peak_rate}`}
                  </p>
                  {derivedMarkups.map((dm) => (
                    <p key={dm.channel_name} className="text-sm text-muted-foreground">
                      {dm.channel_name} (+{dm.markup_percentage}%): Weekday $
                      {Math.round(currentRates.weekday_rate * (1 + dm.markup_percentage / 100))} · Weekend $
                      {Math.round(currentRates.weekend_rate * (1 + dm.markup_percentage / 100))}
                      {currentRates.off_peak_rate != null &&
                        ` · Off-Peak $${Math.round(currentRates.off_peak_rate * (1 + dm.markup_percentage / 100))}`}
                    </p>
                  ))}
                  {hasDateOverrides && (
                    <p className="text-xs text-muted-foreground italic mt-1">
                      Note: Date-specific overrides may apply for some dates in this range
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No rates configured for this room type</p>
              )}
            </div>
          )}

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
                  <Calendar mode="single" selected={dateFrom} onSelect={(date) => { setDateFrom(date); if (date && (!dateTo || dateTo < date)) setDateTo(date); }} disabled={(d) => d < today} className="p-3 pointer-events-auto" />
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
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} defaultMonth={dateTo || dateFrom || today} disabled={(d) => d < (dateFrom || today)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Restriction Options */}
          <div className="space-y-3 border rounded-md p-4">
            <p className="text-sm font-medium">Rate & Restrictions</p>

            <div className="flex items-center gap-3">
              <Checkbox checked={enableRate} onCheckedChange={(v) => setEnableRate(!!v)} />
              <Label className="text-sm flex-1">
                Rate
                <span className="block text-[10px] text-muted-foreground font-normal">Set the nightly rate for this date range</span>
              </Label>
              {enableRate && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} step={1} value={rate} onChange={(e) => setRate(parseFloat(e.target.value) || 0)} className="w-24 h-9 text-right" />
                  <span className="text-sm text-muted-foreground w-12">USD</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Checkbox checked={enableMinStayArrival} onCheckedChange={(v) => setEnableMinStayArrival(!!v)} />
              <Label className="text-sm flex-1">
                Min Stay Arrival
                <span className="block text-[10px] text-muted-foreground font-normal">Guest arriving on this date must stay at least X nights</span>
              </Label>
              {enableMinStayArrival && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={30} value={minStayArrival} onChange={(e) => setMinStayArrival(parseInt(e.target.value) || 1)} className="w-24 h-9 text-right" />
                  <span className="text-sm text-muted-foreground w-12">nights</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Checkbox checked={enableMinStayThrough} onCheckedChange={(v) => setEnableMinStayThrough(!!v)} />
              <Label className="text-sm flex-1">
                Min Stay Through
                <span className="block text-[10px] text-muted-foreground font-normal">Any booking including this date must be at least X nights</span>
              </Label>
              {enableMinStayThrough && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={30} value={minStayThrough} onChange={(e) => setMinStayThrough(parseInt(e.target.value) || 1)} className="w-24 h-9 text-right" />
                  <span className="text-sm text-muted-foreground w-12">nights</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Checkbox checked={enableMaxStay} onCheckedChange={(v) => setEnableMaxStay(!!v)} />
              <Label className="text-sm flex-1">Max Stay</Label>
              {enableMaxStay && (
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={365} value={maxStay} onChange={(e) => setMaxStay(parseInt(e.target.value) || 30)} className="w-24 h-9 text-right" />
                  <span className="text-sm text-muted-foreground w-12">nights</span>
                </div>
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
            <Button onClick={handleApply}>
              Apply Restrictions
            </Button>
            <Button variant="outline" onClick={handleClear} disabled={clearing}>
              {clearing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Clear Restrictions for Range
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pending Changes Panel */}
      {pendingRestrictions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Pending Changes</CardTitle>
                <CardDescription>
                  {pendingRestrictions.length} restriction change(s) ready to sync
                </CardDescription>
              </div>
              <Button onClick={handleSaveAllChanges} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes ({pendingRestrictions.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRestrictions.map((pending) => (
                <div
                  key={pending.id}
                  className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {pending.ratePlanName}
                      <span className="text-muted-foreground font-normal ml-2">
                        ({pending.roomTypeName})
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(pending.dateFrom + 'T00:00:00'), 'MMM d, yyyy')}
                      {pending.dateFrom !== pending.dateTo && (
                        <> → {format(new Date(pending.dateTo + 'T00:00:00'), 'MMM d, yyyy')}</>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {pending.restrictions.rate && (
                        <Badge variant="secondary" className="text-[10px]">
                          Rate: ${pending.restrictions.rate}
                        </Badge>
                      )}
                      {pending.restrictions.minStayArrival && (
                        <Badge variant="secondary" className="text-[10px]">
                          Min Stay Arrival: {pending.restrictions.minStayArrival}
                        </Badge>
                      )}
                      {pending.restrictions.minStayThrough && (
                        <Badge variant="secondary" className="text-[10px]">
                          Min Stay Through: {pending.restrictions.minStayThrough}
                        </Badge>
                      )}
                      {pending.restrictions.maxStay && (
                        <Badge variant="secondary" className="text-[10px]">
                          Max Stay: {pending.restrictions.maxStay}
                        </Badge>
                      )}
                      {pending.restrictions.stopSell && (
                        <Badge variant="destructive" className="text-[10px]">Stop Sell</Badge>
                      )}
                      {pending.restrictions.closedToArrival && (
                        <Badge variant="outline" className="text-[10px]">Closed to Arrival</Badge>
                      )}
                      {pending.restrictions.closedToDeparture && (
                        <Badge variant="outline" className="text-[10px]">Closed to Departure</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => handleRemovePending(pending.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                {pendingDbCount > 0 ? (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span>
                  {pendingDbCount > 0 ? `${pendingDbCount} pending` : 'All synced'}
                </span>
              </div>
              {lastSyncTime && (
                <span className="text-xs text-muted-foreground">
                  Last sync: {format(new Date(lastSyncTime), 'MMM d, HH:mm')}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing || pendingDbCount === 0}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

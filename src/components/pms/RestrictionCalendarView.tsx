import { useState, useEffect, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { RestrictionBadge } from './RestrictionBadge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface RatePlanOption {
  id: string;
  name: string;
  room_type: string | null;
  default_min_stay_through?: number[] | null;
  default_min_stay_arrival?: number[] | null;
  default_max_stay?: number | null;
  default_stop_sell?: boolean;
  default_closed_to_arrival?: boolean;
  default_closed_to_departure?: boolean;
}

interface Restriction {
  id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  min_stay_through: number;
  min_stay_arrival: number;
  max_stay: number | null;
  stop_sell: boolean;
  closed_to_arrival: boolean;
  closed_to_departure: boolean;
  synced_to_channex: boolean;
}

interface RestrictionCalendarViewProps {
  ratePlans: RatePlanOption[];
}

export function RestrictionCalendarView({ ratePlans }: RestrictionCalendarViewProps) {
  const { toast } = useToast();
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [startOffset, setStartOffset] = useState(0);
  const VISIBLE_DAYS = 30;

  // Cell edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editPlanId, setEditPlanId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMinStayArrival, setEditMinStayArrival] = useState(1);
  const [editMinStayThrough, setEditMinStayThrough] = useState(1);
  const [editMaxStay, setEditMaxStay] = useState<number | null>(null);
  const [editStopSell, setEditStopSell] = useState(false);
  const [editCTA, setEditCTA] = useState(false);
  const [editCTD, setEditCTD] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  // Sync status
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(today, startOffset + i));

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
    setPendingCount(count ?? 0);
    setLastSyncTime(lastLog?.created_at ?? null);
  }, []);

  const fetchRestrictions = useCallback(async () => {
    setLoading(true);
    const windowStart = format(dates[0], 'yyyy-MM-dd');
    const windowEnd = format(addDays(dates[dates.length - 1], 1), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('rate_plan_restrictions')
      .select('*')
      .lt('date_from', windowEnd)
      .gt('date_to', windowStart);

    if (error) {
      console.error('Error fetching restrictions:', error);
    } else {
      setRestrictions((data as Restriction[]) || []);
    }
    setLoading(false);
    fetchSyncStatus();
  }, [startOffset]);

  useEffect(() => {
    fetchRestrictions();
  }, [fetchRestrictions]);

  const getRestrictionForCell = (planId: string, dateStr: string): Restriction | undefined => {
    return restrictions.find(
      (r) => r.rate_plan_id === planId && r.date_from <= dateStr && r.date_to > dateStr
    );
  };

  const openCellEdit = (planId: string, dateStr: string) => {
    const existing = getRestrictionForCell(planId, dateStr);
    const plan = ratePlans.find((p) => p.id === planId);
    setEditPlanId(planId);
    setEditDate(dateStr);
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    setEditMinStayArrival(existing?.min_stay_arrival ?? plan?.default_min_stay_arrival?.[dow] ?? 1);
    setEditMinStayThrough(existing?.min_stay_through ?? plan?.default_min_stay_through?.[dow] ?? 1);
    setEditMaxStay(existing?.max_stay ?? plan?.default_max_stay ?? null);
    setEditStopSell(existing?.stop_sell ?? plan?.default_stop_sell ?? false);
    setEditCTA(existing?.closed_to_arrival ?? plan?.default_closed_to_arrival ?? false);
    setEditCTD(existing?.closed_to_departure ?? plan?.default_closed_to_departure ?? false);
    setEditOpen(true);
  };

  const handleCellSave = async () => {
    // Validation
    if (editMinStayArrival < 1 || editMinStayThrough < 1) {
      toast({ title: 'Validation Error', description: 'Min stay values must be at least 1', variant: 'destructive' });
      return;
    }
    if (editMaxStay !== null && editMaxStay > 0 && (editMaxStay < editMinStayArrival || editMaxStay < editMinStayThrough)) {
      toast({ title: 'Validation Error', description: 'Max stay must be >= both min stay values', variant: 'destructive' });
      return;
    }
    if (editStopSell && editCTA) {
      toast({ title: 'Warning', description: 'Stop Sell already blocks all arrivals — Closed to Arrival is redundant' });
    }

    setEditSaving(true);
    try {
      await supabase
        .from('rate_plan_restrictions')
        .delete()
        .eq('rate_plan_id', editPlanId)
        .lte('date_from', editDate)
        .gt('date_to', editDate);

      const nextDay = format(addDays(new Date(editDate), 1), 'yyyy-MM-dd');
      const { error } = await supabase.from('rate_plan_restrictions').insert({
        rate_plan_id: editPlanId,
        date_from: editDate,
        date_to: nextDay,
        min_stay_arrival: editMinStayArrival,
        min_stay_through: editMinStayThrough,
        max_stay: editMaxStay,
        stop_sell: editStopSell,
        closed_to_arrival: editCTA,
        closed_to_departure: editCTD,
        synced_to_channex: false,
      });

      if (error) throw error;

      // Auto-sync after 5 seconds
      setTimeout(async () => {
        try {
          await supabase.functions.invoke('channex-push-restrictions', {
            body: { rate_plan_ids: [editPlanId] },
          });
          fetchSyncStatus();
        } catch { /* non-fatal */ }
      }, 5000);

      toast({ title: 'Saved', description: 'Restriction updated — will sync in 5s' });
      setEditOpen(false);
      fetchRestrictions();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke('channex-push-restrictions');
      toast({ title: 'Synced', description: 'Restrictions pushed to Channex' });
      fetchRestrictions();
    } catch (err: any) {
      toast({ title: 'Sync Error', description: err.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Restrictions Calendar</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setStartOffset((o) => Math.max(0, o - VISIBLE_DAYS))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {format(dates[0], 'MMM d')} – {format(dates[dates.length - 1], 'MMM d, yyyy')}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setStartOffset((o) => o + VISIBLE_DAYS)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-max">
                {/* Header row */}
                <div className="flex border-b sticky top-0 bg-card z-10">
                  <div className="w-48 shrink-0 p-2 text-xs font-medium text-muted-foreground border-r">
                    Rate Plan
                  </div>
                  {dates.map((d) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={d.toISOString()}
                        className={`w-16 shrink-0 p-1 text-center text-[10px] border-r ${isWeekend ? 'bg-muted/50' : ''}`}
                      >
                        <div className="font-medium">{format(d, 'EEE')}</div>
                        <div>{format(d, 'M/d')}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Plan rows */}
                {ratePlans.map((plan) => (
                  <div key={plan.id} className="flex border-b hover:bg-muted/30">
                    <div className="w-48 shrink-0 p-2 border-r">
                      <div className="text-xs font-medium truncate">{plan.name}</div>
                      {plan.room_type && (
                        <div className="text-[10px] text-muted-foreground truncate">{plan.room_type}</div>
                      )}
                    </div>
                    {dates.map((d) => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      const restriction = getRestrictionForCell(plan.id, dateStr);
                      const hasOverride = !!restriction;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      const dow = d.getDay();
                      const effectiveMinStayArrival = restriction?.min_stay_arrival ?? plan.default_min_stay_arrival?.[dow] ?? 1;
                      const effectiveMinStayThrough = restriction?.min_stay_through ?? plan.default_min_stay_through?.[dow] ?? 1;
                      const effectiveStopSell = restriction?.stop_sell ?? plan.default_stop_sell ?? false;
                      const effectiveCTA = restriction?.closed_to_arrival ?? plan.default_closed_to_arrival ?? false;
                      const effectiveCTD = restriction?.closed_to_departure ?? plan.default_closed_to_departure ?? false;
                      const effectiveMaxStay = restriction?.max_stay ?? plan.default_max_stay ?? null;

                      let bgClass = isWeekend ? 'bg-muted/30' : '';
                      if (effectiveStopSell) bgClass = 'bg-red-50';
                      else if (effectiveCTA || effectiveCTD) bgClass = 'bg-amber-50';

                      return (
                        <div
                          key={dateStr}
                          className={`w-16 shrink-0 p-0.5 border-r cursor-pointer hover:bg-accent/10 transition-colors ${bgClass}`}
                          onClick={() => openCellEdit(plan.id, dateStr)}
                        >
                          <div className="flex flex-wrap gap-0.5 min-h-[28px] items-start">
                            {effectiveStopSell && (
                              <RestrictionBadge type="stop_sell" synced={hasOverride ? restriction?.synced_to_channex : undefined} />
                            )}
                            {!effectiveStopSell && effectiveMinStayArrival > 1 && (
                              <RestrictionBadge type="min_stay_arrival" value={effectiveMinStayArrival} synced={hasOverride ? restriction?.synced_to_channex : undefined} />
                            )}
                            {!effectiveStopSell && effectiveMinStayThrough > 1 && (
                              <RestrictionBadge type="min_stay_through" value={effectiveMinStayThrough} synced={hasOverride ? restriction?.synced_to_channex : undefined} />
                            )}
                            {!effectiveStopSell && effectiveMaxStay && (
                              <RestrictionBadge type="max_stay" value={effectiveMaxStay} synced={hasOverride ? restriction?.synced_to_channex : undefined} />
                            )}
                            {effectiveCTA && !effectiveStopSell && (
                              <RestrictionBadge type="cta" synced={hasOverride ? restriction?.synced_to_channex : undefined} />
                            )}
                            {effectiveCTD && !effectiveStopSell && (
                              <RestrictionBadge type="ctd" synced={hasOverride ? restriction?.synced_to_channex : undefined} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card className="mt-4">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                {pendingCount > 0 ? (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span>
                  {pendingCount > 0 ? `${pendingCount} pending` : 'All synced'}
                </span>
              </div>
              {lastSyncTime && (
                <span className="text-xs text-muted-foreground">
                  Last sync: {format(new Date(lastSyncTime), 'MMM d, HH:mm')}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing || pendingCount === 0}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cell Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Edit Restriction — {editDate && format(new Date(editDate + 'T00:00:00'), 'MMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Min Stay Arrival</Label>
                <Input type="number" min={1} max={30} value={editMinStayArrival} onChange={(e) => setEditMinStayArrival(parseInt(e.target.value) || 1)} />
                <p className="text-[10px] text-muted-foreground">Guests arriving on this date</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Min Stay Through</Label>
                <Input type="number" min={1} max={30} value={editMinStayThrough} onChange={(e) => setEditMinStayThrough(parseInt(e.target.value) || 1)} />
                <p className="text-[10px] text-muted-foreground">Any booking including this date</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Max Stay</Label>
              <Input
                type="number"
                min={1}
                max={365}
                placeholder="No limit"
                value={editMaxStay ?? ''}
                onChange={(e) => setEditMaxStay(e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Stop Sell</Label>
                <Switch checked={editStopSell} onCheckedChange={setEditStopSell} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Closed to Arrival</Label>
                <Switch checked={editCTA} onCheckedChange={setEditCTA} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Closed to Departure</Label>
                <Switch checked={editCTD} onCheckedChange={setEditCTD} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleCellSave} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

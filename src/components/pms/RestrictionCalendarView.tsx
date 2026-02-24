import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface RatePlanOption {
  id: string;
  name: string;
  room_type: string | null;
  default_min_stay?: number;
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
  min_stay: number;
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
  const [editMinStay, setEditMinStay] = useState(1);
  const [editMaxStay, setEditMaxStay] = useState<number | null>(null);
  const [editStopSell, setEditStopSell] = useState(false);
  const [editCTA, setEditCTA] = useState(false);
  const [editCTD, setEditCTD] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(today, startOffset + i));

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
    setEditMinStay(existing?.min_stay ?? plan?.default_min_stay ?? 1);
    setEditMaxStay(existing?.max_stay ?? plan?.default_max_stay ?? null);
    setEditStopSell(existing?.stop_sell ?? plan?.default_stop_sell ?? false);
    setEditCTA(existing?.closed_to_arrival ?? plan?.default_closed_to_arrival ?? false);
    setEditCTD(existing?.closed_to_departure ?? plan?.default_closed_to_departure ?? false);
    setEditOpen(true);
  };

  const handleCellSave = async () => {
    setEditSaving(true);
    try {
      // Delete any existing restriction for this plan+date
      await supabase
        .from('rate_plan_restrictions')
        .delete()
        .eq('rate_plan_id', editPlanId)
        .lte('date_from', editDate)
        .gt('date_to', editDate);

      // Insert single-day restriction
      const nextDay = format(addDays(new Date(editDate), 1), 'yyyy-MM-dd');
      const { error } = await supabase.from('rate_plan_restrictions').insert({
        rate_plan_id: editPlanId,
        date_from: editDate,
        date_to: nextDay,
        min_stay: editMinStay,
        max_stay: editMaxStay,
        stop_sell: editStopSell,
        closed_to_arrival: editCTA,
        closed_to_departure: editCTD,
        synced_to_channex: false,
      });

      if (error) throw error;

      // Trigger sync
      try {
        await supabase.functions.invoke('channex-push-restrictions', {
          body: { rate_plan_ids: [editPlanId] },
        });
      } catch { /* non-fatal */ }

      toast({ title: 'Saved', description: 'Restriction updated and syncing' });
      setEditOpen(false);
      fetchRestrictions();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
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
                {/* Header row - dates */}
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

                      // Determine effective values
                      const effectiveMinStay = restriction?.min_stay ?? plan.default_min_stay ?? 1;
                      const effectiveStopSell = restriction?.stop_sell ?? plan.default_stop_sell ?? false;
                      const effectiveCTA = restriction?.closed_to_arrival ?? plan.default_closed_to_arrival ?? false;
                      const effectiveCTD = restriction?.closed_to_departure ?? plan.default_closed_to_departure ?? false;

                      const hasBadges = effectiveMinStay > 1 || effectiveStopSell || effectiveCTA || effectiveCTD;

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
                            {effectiveMinStay > 1 && !effectiveStopSell && (
                              <RestrictionBadge type="min_stay" value={effectiveMinStay} synced={hasOverride ? restriction?.synced_to_channex : undefined} />
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
                <Label className="text-sm">Min Stay</Label>
                <Input type="number" min={1} max={30} value={editMinStay} onChange={(e) => setEditMinStay(parseInt(e.target.value) || 1)} />
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

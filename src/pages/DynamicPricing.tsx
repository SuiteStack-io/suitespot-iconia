import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { usePropertyId } from '@/hooks/usePropertyFilter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronDown, RefreshCw, Info, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/NotificationBell';
import type { Json } from '@/integrations/supabase/types';

// ---------- types ----------
interface PricingRules {
  id: string;
  property_id: string;
  is_enabled: boolean;
  day_of_week_multipliers: Record<string, number>;
  occupancy_thresholds: number[];
  occupancy_adjustments: number[];
  revenue_thresholds: number[];
  revenue_adjustments_phase_a: number[];
  revenue_adjustments_phase_b: number[];
  pace_index_bump_threshold: number;
  monthly_revenue_target: number | null;
  monthly_revenue_stretch: number | null;
  last_minute_strategy: string;
  channex_min_price_synced: boolean;
  channex_max_price_synced: boolean;
  revenue_occupancy_conflict_cap: number;
  revenue_occupancy_conflict_revenue_min: number;
  revenue_occupancy_conflict_occupancy_max: number;
}

interface RoomRateBound {
  id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_rate: number | null;
  max_rate: number | null;
}

const DEFAULT_DOW: Record<string, number> = {
  '0': 0.95, '1': 0.95, '2': 0.93, '3': 0.95, '4': 1.0, '5': 1.1, '6': 1.15,
};
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---------- component ----------
export default function DynamicPricing() {
  const { userRole } = useAuth();
  const propertyId = usePropertyId();

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<PricingRules | null>(null);
  const [rateBounds, setRateBounds] = useState<RoomRateBound[]>([]);
  const [boundsErrors, setBoundsErrors] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- load pricing_rules ----
  const loadRules = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('property_id', propertyId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load pricing rules', error);
      toast.error('Failed to load pricing settings');
      setLoading(false);
      return;
    }

    if (data) {
      setRules(mapRulesRow(data));
    } else {
      // create default row
      const { data: created, error: createErr } = await supabase
        .from('pricing_rules')
        .insert({ property_id: propertyId })
        .select('*')
        .single();
      if (createErr) {
        console.error('Failed to create pricing rules', createErr);
        toast.error('Failed to initialise pricing settings');
      } else if (created) {
        setRules(mapRulesRow(created));
      }
    }
    setLoading(false);
  }, [propertyId]);

  // ---- load rate bounds ----
  const loadBounds = useCallback(async () => {
    if (!propertyId) return;
    const { data, error } = await supabase
      .from('rate_plan_prices')
      .select('id, room_type, weekday_rate, weekend_rate, min_rate, max_rate, rate_plan_id, rate_plans!inner(property_id)')
      .eq('rate_plans.property_id', propertyId);

    if (error) {
      console.error('Failed to load rate bounds', error);
      return;
    }

    // group by room_type — pick first row per type (they share bounds)
    const byType: Record<string, RoomRateBound> = {};
    for (const row of (data ?? []) as any[]) {
      if (!byType[row.room_type]) {
        byType[row.room_type] = {
          id: row.id,
          room_type: row.room_type,
          weekday_rate: row.weekday_rate,
          weekend_rate: row.weekend_rate,
          min_rate: row.min_rate,
          max_rate: row.max_rate,
        };
      }
    }
    setRateBounds(Object.values(byType).sort((a, b) => a.room_type.localeCompare(b.room_type)));
  }, [propertyId]);

  useEffect(() => {
    loadRules();
    loadBounds();
  }, [loadRules, loadBounds]);

  // ---- auto-save helpers ----
  function debouncedSaveRules(patch: Partial<PricingRules>) {
    if (!rules) return;
    const updated = { ...rules, ...patch };
    setRules(updated);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('pricing_rules')
        .update(toDbRow(patch))
        .eq('id', rules.id);
      if (error) {
        console.error('Save failed', error);
        toast.error('Failed to save pricing settings');
      } else {
        toast.success('Pricing settings updated');
      }
    }, 500);
  }

  async function saveBound(bound: RoomRateBound) {
    // validate
    if (bound.min_rate !== null && bound.max_rate !== null && bound.min_rate >= bound.max_rate) {
      setBoundsErrors((prev) => ({ ...prev, [bound.room_type]: 'Min must be less than Max' }));
      return;
    }
    setBoundsErrors((prev) => {
      const copy = { ...prev };
      delete copy[bound.room_type];
      return copy;
    });

    // update all rate_plan_prices rows with this room_type for this property
    const { error } = await supabase
      .from('rate_plan_prices')
      .update({ min_rate: bound.min_rate, max_rate: bound.max_rate } as any)
      .eq('id', bound.id);

    if (error) {
      console.error('Save bound failed', error);
      toast.error('Failed to save rate bound');
    } else {
      toast.success('Rate bound updated');
    }
  }

  // ---- channex sync ----
  async function syncToChannex() {
    if (!propertyId) return;
    setSyncing(true);
    try {
      const allMinRates = rateBounds.filter((b) => b.min_rate !== null).map((b) => b.min_rate!);
      const allMaxRates = rateBounds.filter((b) => b.max_rate !== null).map((b) => b.max_rate!);
      const floorValue = allMinRates.length > 0 ? Math.min(...allMinRates) : null;
      const ceilingValue = allMaxRates.length > 0 ? Math.max(...allMaxRates) : null;

      if (floorValue === null && ceilingValue === null) {
        toast.error('No min/max rates set. Configure rate guardrails first.');
        setSyncing(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('channex-update-property-settings', {
        body: { property_id: propertyId, min_price: floorValue, max_price: ceilingValue },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await supabase
        .from('pricing_rules')
        .update({ channex_min_price_synced: floorValue !== null, channex_max_price_synced: ceilingValue !== null })
        .eq('property_id', propertyId);

      setRules((prev) =>
        prev ? { ...prev, channex_min_price_synced: floorValue !== null, channex_max_price_synced: ceilingValue !== null } : prev
      );
      toast.success('Rate bounds synced to Channex');
    } catch (err: any) {
      console.error('Channex sync failed', err);
      toast.error(err.message || 'Failed to sync to Channex');
    } finally {
      setSyncing(false);
    }
  }

  // ---- render ----
  if (!propertyId) {
    return (
      <div className="flex min-h-screen">
        <SlideMenu userRole={userRole} />
        <div className="flex-1 p-6">
          <p className="text-muted-foreground">Select a property to configure dynamic pricing.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <SlideMenu userRole={userRole} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!rules) return null;

  const dow = rules.day_of_week_multipliers;

  return (
    <div className="flex min-h-screen bg-background">
      <SlideMenu userRole={userRole} />
      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <AdminBreadcrumb section="Operations" currentPage="Dynamic Pricing" />
          <NotificationBell />
        </div>

        <h1 className="text-2xl font-bold mb-6">Dynamic Pricing</h1>

        <div className="space-y-6 max-w-4xl">
          {/* Section A: Master Toggle */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Enable Dynamic Pricing</CardTitle>
                  <CardDescription>When enabled, rates are automatically adjusted based on occupancy, pace, and revenue targets.</CardDescription>
                </div>
                <Switch
                  checked={rules.is_enabled}
                  onCheckedChange={(checked) => {
                    debouncedSaveRules({ is_enabled: checked });
                    if (checked && rateBounds.some((b) => b.min_rate !== null || b.max_rate !== null)) {
                      syncToChannex();
                    }
                  }}
                />
              </div>
            </CardHeader>
            {!rules.is_enabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">Dynamic pricing is disabled. Rates from Rate Plans will be used as-is.</p>
              </CardContent>
            )}
          </Card>

          {rules.is_enabled && (
            <>
              {/* Section B: Rate Guardrails */}
              <Card>
                <CardHeader>
                  <CardTitle>Rate Guardrails</CardTitle>
                  <CardDescription>Set minimum and maximum rates per room type. These protect against the algorithm pricing too low or too high.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Room Type</TableHead>
                          <TableHead className="text-right">Weekday Rate</TableHead>
                          <TableHead className="text-right">Weekend Rate</TableHead>
                          <TableHead className="text-right">Min Rate</TableHead>
                          <TableHead className="text-right">Max Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rateBounds.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No room types found. Create rate plans first.</TableCell>
                          </TableRow>
                        )}
                        {rateBounds.map((bound) => (
                          <TableRow key={bound.room_type}>
                            <TableCell className="font-medium">{bound.room_type}</TableCell>
                            <TableCell className="text-right">{bound.weekday_rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{bound.weekend_rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="No minimum"
                                className="w-28 ml-auto text-right"
                                value={bound.min_rate ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  setRateBounds((prev) => prev.map((b) => (b.room_type === bound.room_type ? { ...b, min_rate: val } : b)));
                                }}
                                onBlur={() => {
                                  const current = rateBounds.find((b) => b.room_type === bound.room_type);
                                  if (current) saveBound(current);
                                }}
                              />
                              {boundsErrors[bound.room_type] && (
                                <p className="text-xs text-destructive mt-1">{boundsErrors[bound.room_type]}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="No maximum"
                                className="w-28 ml-auto text-right"
                                value={bound.max_rate ?? ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                  setRateBounds((prev) => prev.map((b) => (b.room_type === bound.room_type ? { ...b, max_rate: val } : b)));
                                }}
                                onBlur={() => {
                                  const current = rateBounds.find((b) => b.room_type === bound.room_type);
                                  if (current) saveBound(current);
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">These bounds are also synced to your channel manager as a safety net. Channex will reject any rate outside these bounds even if the PMS has a bug.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Section C: Channex Sync */}
              <Card>
                <CardHeader>
                  <CardTitle>Channex Rate Bounds Sync</CardTitle>
                  <CardDescription>Push your property-level min/max rate bounds to Channex for safety enforcement.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4">
                  <Button onClick={syncToChannex} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Sync Rate Bounds to Channex
                  </Button>
                  <div className="text-xs text-muted-foreground space-x-3">
                    <span>Min synced: {rules.channex_min_price_synced ? '✓' : '—'}</span>
                    <span>Max synced: {rules.channex_max_price_synced ? '✓' : '—'}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Section D: Day-of-Week Multipliers */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Day-of-Week Multipliers</CardTitle>
                      <CardDescription>Adjust rates by day of week. 1.00 = no change, 1.10 = +10%, 0.90 = −10%.</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => debouncedSaveRules({ day_of_week_multipliers: DEFAULT_DOW })}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Reset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {DAY_LABELS.map((label, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <Label className="text-xs font-medium">{label}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-full text-center text-sm"
                          value={dow[String(i)] ?? 1}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            debouncedSaveRules({ day_of_week_multipliers: { ...dow, [String(i)]: val } });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Section E: Revenue Targets */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue Targets</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monthly Revenue Target</Label>
                    <Input
                      type="number"
                      step="100"
                      placeholder="e.g. 50000"
                      value={rules.monthly_revenue_target ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        debouncedSaveRules({ monthly_revenue_target: val });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Target revenue to cover costs and margin</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Stretch Target</Label>
                    <Input
                      type="number"
                      step="100"
                      placeholder="e.g. 65000"
                      value={rules.monthly_revenue_stretch ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        debouncedSaveRules({ monthly_revenue_stretch: val });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">Aspirational target (typically 120-130% of base)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Section F: Last-Minute Strategy */}
              <Card>
                <CardHeader>
                  <CardTitle>Last-Minute Strategy</CardTitle>
                  <CardDescription>How to price bookings made within 0–2 days of check-in.</CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={rules.last_minute_strategy}
                    onValueChange={(val) => debouncedSaveRules({ last_minute_strategy: val })}
                  >
                    <div className="flex items-start space-x-2 mb-3">
                      <RadioGroupItem value="discount" id="lm-discount" />
                      <div>
                        <Label htmlFor="lm-discount" className="font-medium">Discount</Label>
                        <p className="text-xs text-muted-foreground">Apply −5% for bookings within 0–2 days of check-in (vacation/leisure markets)</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <RadioGroupItem value="premium" id="lm-premium" />
                      <div>
                        <Label htmlFor="lm-premium" className="font-medium">Premium</Label>
                        <p className="text-xs text-muted-foreground">Apply +15% for bookings within 0–2 days of check-in (urban/business markets)</p>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Section G: Advanced */}
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Advanced — Occupancy & Revenue Tiers</CardTitle>
                          <CardDescription>Fine-tune tier thresholds. Most operators should leave these at defaults.</CardDescription>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-6">
                      {/* Occupancy tiers */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Occupancy Tiers</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>From %</TableHead>
                              <TableHead>To %</TableHead>
                              <TableHead>Rate Adjustment %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rules.occupancy_adjustments.map((adj, idx) => {
                              const from = idx === 0 ? 0 : rules.occupancy_thresholds[idx - 1] + 1;
                              const to = idx < rules.occupancy_thresholds.length ? rules.occupancy_thresholds[idx] : 100;
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{from}%</TableCell>
                                  <TableCell>{to}%</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      className="w-20"
                                      value={adj}
                                      onChange={(e) => {
                                        const newAdj = [...rules.occupancy_adjustments];
                                        newAdj[idx] = parseFloat(e.target.value) || 0;
                                        debouncedSaveRules({ occupancy_adjustments: newAdj });
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pace Index */}
                      <div className="space-y-2">
                        <Label>Pace Index Bump Threshold</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-32"
                          value={rules.pace_index_bump_threshold}
                          onChange={(e) => debouncedSaveRules({ pace_index_bump_threshold: parseFloat(e.target.value) || 1.3 })}
                        />
                        <p className="text-xs text-muted-foreground">Bump occupancy tier by +1 when pace index exceeds this value (default 1.30)</p>
                      </div>

                      {/* Revenue tiers */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Revenue Adjustment Tiers</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Threshold %</TableHead>
                              <TableHead>Phase A Adj %</TableHead>
                              <TableHead>Phase B Adj %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rules.revenue_thresholds.map((thresh, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{thresh}%</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    className="w-20"
                                    value={rules.revenue_adjustments_phase_a[idx] ?? 0}
                                    onChange={(e) => {
                                      const newA = [...rules.revenue_adjustments_phase_a];
                                      newA[idx] = parseFloat(e.target.value) || 0;
                                      debouncedSaveRules({ revenue_adjustments_phase_a: newA });
                                    }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    className="w-20"
                                    value={rules.revenue_adjustments_phase_b[idx] ?? 0}
                                    onChange={(e) => {
                                      const newB = [...rules.revenue_adjustments_phase_b];
                                      newB[idx] = parseFloat(e.target.value) || 0;
                                      debouncedSaveRules({ revenue_adjustments_phase_b: newB });
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- helpers ----------
function mapRulesRow(row: any): PricingRules {
  return {
    id: row.id,
    property_id: row.property_id,
    is_enabled: row.is_enabled,
    day_of_week_multipliers: (typeof row.day_of_week_multipliers === 'object' ? row.day_of_week_multipliers : DEFAULT_DOW) as Record<string, number>,
    occupancy_thresholds: (Array.isArray(row.occupancy_thresholds) ? row.occupancy_thresholds : [30, 50, 65, 75, 85, 92]) as number[],
    occupancy_adjustments: (Array.isArray(row.occupancy_adjustments) ? row.occupancy_adjustments : [0, 5, 10, 18, 28, 40, 55]) as number[],
    revenue_thresholds: (Array.isArray(row.revenue_thresholds) ? row.revenue_thresholds : [40, 60, 80, 95, 100, 120]) as number[],
    revenue_adjustments_phase_a: (Array.isArray(row.revenue_adjustments_phase_a) ? row.revenue_adjustments_phase_a : [0, 0, 5, 5, 10, 10, 10]) as number[],
    revenue_adjustments_phase_b: (Array.isArray(row.revenue_adjustments_phase_b) ? row.revenue_adjustments_phase_b : [0, 0, 5, 10, 15, 20, 25]) as number[],
    pace_index_bump_threshold: row.pace_index_bump_threshold,
    monthly_revenue_target: row.monthly_revenue_target,
    monthly_revenue_stretch: row.monthly_revenue_stretch,
    last_minute_strategy: row.last_minute_strategy,
    channex_min_price_synced: row.channex_min_price_synced,
    channex_max_price_synced: row.channex_max_price_synced,
    revenue_occupancy_conflict_cap: row.revenue_occupancy_conflict_cap,
    revenue_occupancy_conflict_revenue_min: row.revenue_occupancy_conflict_revenue_min,
    revenue_occupancy_conflict_occupancy_max: row.revenue_occupancy_conflict_occupancy_max,
  };
}

function toDbRow(patch: Partial<PricingRules>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.is_enabled !== undefined) out.is_enabled = patch.is_enabled;
  if (patch.day_of_week_multipliers !== undefined) out.day_of_week_multipliers = patch.day_of_week_multipliers;
  if (patch.occupancy_thresholds !== undefined) out.occupancy_thresholds = patch.occupancy_thresholds;
  if (patch.occupancy_adjustments !== undefined) out.occupancy_adjustments = patch.occupancy_adjustments;
  if (patch.revenue_thresholds !== undefined) out.revenue_thresholds = patch.revenue_thresholds;
  if (patch.revenue_adjustments_phase_a !== undefined) out.revenue_adjustments_phase_a = patch.revenue_adjustments_phase_a;
  if (patch.revenue_adjustments_phase_b !== undefined) out.revenue_adjustments_phase_b = patch.revenue_adjustments_phase_b;
  if (patch.pace_index_bump_threshold !== undefined) out.pace_index_bump_threshold = patch.pace_index_bump_threshold;
  if (patch.monthly_revenue_target !== undefined) out.monthly_revenue_target = patch.monthly_revenue_target;
  if (patch.monthly_revenue_stretch !== undefined) out.monthly_revenue_stretch = patch.monthly_revenue_stretch;
  if (patch.last_minute_strategy !== undefined) out.last_minute_strategy = patch.last_minute_strategy;
  if (patch.channex_min_price_synced !== undefined) out.channex_min_price_synced = patch.channex_min_price_synced;
  if (patch.channex_max_price_synced !== undefined) out.channex_max_price_synced = patch.channex_max_price_synced;
  return out;
}

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useProperty } from '@/lib/propertyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  room_type: string | null;
  currency: string;
  sell_mode: string;
  extra_adult_rate: number;
  extra_child_rate: number;
}

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  base_occupancy: number;
  max_occupancy: number | null;
  unit_id: string | null;
}

interface EditedPrice {
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  base_occupancy: number;
  max_occupancy: number | null;
}

interface EditedPlan {
  name: string;
  sell_mode: string;
}

const RoomRates = () => {
  const { userRole } = useAuth();
  const propertyId = usePropertyId();
  const { activeProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [prices, setPrices] = useState<Record<string, RatePlanPrice>>({});
  const [editedPrices, setEditedPrices] = useState<Record<string, EditedPrice>>({});
  const [editedPlans, setEditedPlans] = useState<Record<string, EditedPlan>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const fetchData = async () => {
    try {
      const { data: plans, error: plansError } = await withPropertyFilter(
        supabase
          .from('rate_plans')
          .select('id, name, is_default, is_active, room_type, currency, sell_mode, extra_adult_rate, extra_child_rate')
          .eq('is_active', true)
          .order('room_type')
          .order('name'),
        propertyId
      );

      if (plansError) throw plansError;

      // Fetch type-level prices for all plans
      const planIds = (plans || []).map(p => p.id);
      const { data: allPrices, error: pricesError } = await supabase
        .from('rate_plan_prices')
        .select('*')
        .in('rate_plan_id', planIds)
        .is('unit_id', null);

      if (pricesError) throw pricesError;

      setRatePlans(plans || []);

      // Map prices by plan ID
      const priceMap: Record<string, RatePlanPrice> = {};
      const editMap: Record<string, EditedPrice> = {};
      const planEditMap: Record<string, EditedPlan> = {};
      
      (allPrices || []).forEach(p => {
        priceMap[p.rate_plan_id] = p;
        editMap[p.rate_plan_id] = {
          weekday_rate: p.weekday_rate,
          weekend_rate: p.weekend_rate,
          min_stay: p.min_stay,
          base_occupancy: p.base_occupancy ?? 2,
          max_occupancy: p.max_occupancy,
        };
      });

      (plans || []).forEach(p => {
        planEditMap[p.id] = { name: p.name, sell_mode: p.sell_mode };
      });

      setPrices(priceMap);
      setEditedPrices(editMap);
      setEditedPlans(planEditMap);
      setHasChanges(false);

      // Expand all by default
      const roomTypes = new Set((plans || []).map(p => p.room_type).filter(Boolean) as string[]);
      setExpandedRoomTypes(roomTypes);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load rate plans');
    } finally {
      setLoading(false);
    }
  };

  // Group plans by room type
  const roomTypeGroups = useMemo(() => {
    const groups: Record<string, RatePlan[]> = {};
    ratePlans.forEach(plan => {
      const rt = plan.room_type || 'Unassigned';
      if (!groups[rt]) groups[rt] = [];
      groups[rt].push(plan);
    });
    return groups;
  }, [ratePlans]);

  const handlePriceChange = (planId: string, field: keyof EditedPrice, value: number | null) => {
    setEditedPrices(prev => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
    setHasChanges(true);
  };

  const handlePlanChange = (planId: string, field: keyof EditedPlan, value: string) => {
    setEditedPlans(prev => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [planId, edited] of Object.entries(editedPlans)) {
        await supabase.from('rate_plans').update({ name: edited.name, sell_mode: edited.sell_mode }).eq('id', planId);
      }

      for (const [planId, edited] of Object.entries(editedPrices)) {
        const price = prices[planId];
        if (!price) continue;
        await supabase.from('rate_plan_prices').update({
          weekday_rate: edited.weekday_rate,
          weekend_rate: edited.weekend_rate,
          min_stay: edited.min_stay,
          base_occupancy: edited.base_occupancy,
          max_occupancy: edited.max_occupancy,
        }).eq('id', price.id);
      }

      toast.success('All changes saved');
      setHasChanges(false);
      await fetchData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleRoomType = (rt: string) => {
    setExpandedRoomTypes(prev => {
      const next = new Set(prev);
      if (next.has(rt)) next.delete(rt); else next.add(rt);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-xl font-semibold text-foreground">Room Rates</h1>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section={activeProperty?.name || 'Property'} currentPage="Room Rates" />
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        {ratePlans.length === 0 ? (
          <div className="bg-card rounded-lg border shadow-sm p-8 text-center">
            <p className="text-muted-foreground">No rate plans found. Create one in PMS → Prices.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(roomTypeGroups).sort(([a], [b]) => a.localeCompare(b)).map(([roomType, plans]) => (
              <Card key={roomType}>
                <Collapsible open={expandedRoomTypes.has(roomType)} onOpenChange={() => toggleRoomType(roomType)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                      <div className="flex items-center gap-3">
                        {expandedRoomTypes.has(roomType) ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                        <h3 className="font-semibold text-lg">{roomType}</h3>
                        <Badge variant="secondary">{plans.length} plan{plans.length !== 1 ? 's' : ''}</Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {plans.map(plan => {
                        const edited = editedPrices[plan.id];
                        const editedPlan = editedPlans[plan.id];
                        if (!edited || !editedPlan) return null;

                        return (
                          <div key={plan.id} className="border rounded-lg p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Plan Name</Label>
                                <Input value={editedPlan.name} onChange={(e) => handlePlanChange(plan.id, 'name', e.target.value)} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Sell Mode</Label>
                                <Select value={editedPlan.sell_mode} onValueChange={(v) => handlePlanChange(plan.id, 'sell_mode', v)}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="per_room">Per Room</SelectItem>
                                    <SelectItem value="per_person">Per Person</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Currency</Label>
                                <Input value="USD" disabled className="bg-muted" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Weekday Rate</Label>
                                <Input type="number" value={edited.weekday_rate} onChange={(e) => handlePriceChange(plan.id, 'weekday_rate', parseFloat(e.target.value) || 0)} min={0} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Weekend Rate</Label>
                                <Input type="number" value={edited.weekend_rate} onChange={(e) => handlePriceChange(plan.id, 'weekend_rate', parseFloat(e.target.value) || 0)} min={0} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Min Stay</Label>
                                <Input type="number" value={edited.min_stay} onChange={(e) => handlePriceChange(plan.id, 'min_stay', parseInt(e.target.value) || 1)} min={1} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Base Occ</Label>
                                <Input type="number" value={edited.base_occupancy} onChange={(e) => handlePriceChange(plan.id, 'base_occupancy', parseInt(e.target.value) || 1)} min={1} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Max Occ</Label>
                                <Input type="number" value={edited.max_occupancy ?? ''} onChange={(e) => handlePriceChange(plan.id, 'max_occupancy', e.target.value ? parseInt(e.target.value) : null)} min={1} placeholder="—" />
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Extra Adult: ${plan.extra_adult_rate}</span>
                              <span>Extra Child: ${plan.extra_child_rate}</span>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default RoomRates;

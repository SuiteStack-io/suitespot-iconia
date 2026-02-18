import { useState, useEffect, useMemo } from 'react';
import { Plus, DollarSign, Loader2, ChevronDown, ChevronRight, Pencil, Trash2, Layers } from 'lucide-react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RatePlanDialog } from '@/components/pms/RatePlanDialog';
import { BulkRatePlanDialog } from '@/components/pms/BulkRatePlanDialog';
import { getCancellationPolicyLabel } from '@/components/pms/CancellationPolicyDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  cancellation_policy?: string | null;
  booking_com_id?: string | null;
  room_type?: string | null;
  currency?: string;
  sell_mode?: string;
  extra_adult_rate?: number;
  extra_child_rate?: number;
}

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  unit_id?: string | null;
}

interface Unit {
  id: string;
  unit_number: string | null;
  booking_com_name: string | null;
}

const PMSPrices = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [ratePlanPrices, setRatePlanPrices] = useState<Record<string, RatePlanPrice[]>>({});
  const [units, setUnits] = useState<Unit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [editingRatePlan, setEditingRatePlan] = useState<RatePlan | null>(null);
  const [addingForRoomType, setAddingForRoomType] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, pricesRes, unitsRes] = await Promise.all([
        supabase.from('rate_plans').select('*').eq('is_active', true).order('room_type').order('priority', { ascending: false }),
        supabase.from('rate_plan_prices').select('*'),
        supabase.from('units').select('id, unit_number, booking_com_name').eq('location', 'ICONIA').not('booking_com_name', 'is', null),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (unitsRes.error) throw unitsRes.error;

      setUnits(unitsRes.data || []);
      setRatePlans(plansRes.data || []);

      const pricesByPlan: Record<string, RatePlanPrice[]> = {};
      (pricesRes.data || []).forEach(price => {
        if (!pricesByPlan[price.rate_plan_id]) pricesByPlan[price.rate_plan_id] = [];
        pricesByPlan[price.rate_plan_id].push(price);
      });
      setRatePlanPrices(pricesByPlan);

      // Expand all room types by default
      const roomTypes = new Set((plansRes.data || []).map(p => p.room_type).filter(Boolean) as string[]);
      setExpandedRoomTypes(roomTypes);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load rate plans');
    } finally {
      setLoading(false);
    }
  };

  // Group rate plans by room type
  const roomTypeGroups = useMemo(() => {
    const groups: Record<string, { plans: RatePlan[]; unitCount: number }> = {};
    
    // Get unique room types from units
    const roomTypeCounts: Record<string, number> = {};
    units.forEach(u => {
      if (u.booking_com_name) {
        roomTypeCounts[u.booking_com_name] = (roomTypeCounts[u.booking_com_name] || 0) + 1;
      }
    });

    // Initialize groups for all room types
    Object.keys(roomTypeCounts).sort().forEach(rt => {
      groups[rt] = { plans: [], unitCount: roomTypeCounts[rt] };
    });

    // Assign plans to groups
    ratePlans.forEach(plan => {
      if (plan.room_type && groups[plan.room_type]) {
        groups[plan.room_type].plans.push(plan);
      }
    });

    return groups;
  }, [ratePlans, units]);

  const roomTypes = useMemo(() => {
    const unique = [...new Set(units.map(u => u.booking_com_name).filter(Boolean))] as string[];
    return unique.map(name => ({ name }));
  }, [units]);

  const handleAddForRoomType = (roomType: string) => {
    setAddingForRoomType(roomType);
    setEditingRatePlan(null);
    setDialogOpen(true);
  };

  const handleEdit = (ratePlan: RatePlan) => {
    setAddingForRoomType(ratePlan.room_type || null);
    setEditingRatePlan(ratePlan);
    setDialogOpen(true);
  };

  const handleDeleteClick = (planId: string) => {
    setDeletingPlanId(planId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingPlanId) return;
    try {
      const { error } = await supabase.from('rate_plans').delete().eq('id', deletingPlanId);
      if (error) throw error;
      toast.success('Rate plan deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting rate plan:', error);
      toast.error('Failed to delete rate plan');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingPlanId(null);
    }
  };

  const handleSave = async (
    ratePlanData: any,
    prices: Array<{ room_type: string; weekday_rate: number; weekend_rate: number; min_stay: number; unit_id?: string | null }>
  ) => {
    try {
      if (editingRatePlan) {
        const { error: updateError } = await supabase
          .from('rate_plans')
          .update({
            name: ratePlanData.name,
            valid_from: ratePlanData.valid_from,
            valid_to: ratePlanData.valid_to,
            is_active: ratePlanData.is_active,
            booking_com_id: ratePlanData.booking_com_id,
            room_type: ratePlanData.room_type,
          })
          .eq('id', editingRatePlan.id);
        if (updateError) throw updateError;

        await supabase.from('rate_plan_prices').delete().eq('rate_plan_id', editingRatePlan.id);

        if (prices.length > 0) {
          const { error: insertError } = await supabase.from('rate_plan_prices').insert(
            prices.map(p => ({ rate_plan_id: editingRatePlan.id, ...p, unit_id: p.unit_id || null }))
          );
          if (insertError) throw insertError;
        }

        toast.success('Rate plan updated');
      } else {
        const { data: newPlan, error: createError } = await supabase
          .from('rate_plans')
          .insert([{ ...ratePlanData, room_type: addingForRoomType || ratePlanData.room_type }])
          .select()
          .single();
        if (createError) throw createError;

        if (prices.length > 0 && newPlan) {
          const { error: insertError } = await supabase.from('rate_plan_prices').insert(
            prices.map(p => ({ rate_plan_id: newPlan.id, ...p, unit_id: p.unit_id || null }))
          );
          if (insertError) throw insertError;
        }

        toast.success('Rate plan created');
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving rate plan:', error);
      toast.error('Failed to save rate plan');
    }
  };

  const toggleRoomType = (roomType: string) => {
    setExpandedRoomTypes(prev => {
      const next = new Set(prev);
      if (next.has(roomType)) next.delete(roomType);
      else next.add(roomType);
      return next;
    });
  };

  const formatCurrency = (amount: number): string => `$${amount.toLocaleString()}`;

  const getPlanPrice = (planId: string): RatePlanPrice | null => {
    const prices = ratePlanPrices[planId] || [];
    return prices.find(p => !p.unit_id) || null;
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
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Prices</h1>
          </div>
          <Button onClick={() => setBulkDialogOpen(true)} variant="outline" className="gap-2">
            <Layers className="h-4 w-4" />
            Bulk Create
          </Button>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="PMS" currentPage="Prices" />
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {Object.keys(roomTypeGroups).length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="rounded-full bg-muted p-6 mb-4">
              <DollarSign className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Room Types</h2>
            <p className="text-muted-foreground max-w-md">
              No room types found. Make sure units have a room type name assigned.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">Rate Plans by Room Type</h2>
              <p className="text-sm text-muted-foreground">
                Each rate plan applies to one room type. Add multiple rate plans per room type for seasonal pricing.
              </p>
            </div>

            {Object.entries(roomTypeGroups).map(([roomType, { plans, unitCount }]) => (
              <Card key={roomType}>
                <Collapsible open={expandedRoomTypes.has(roomType)} onOpenChange={() => toggleRoomType(roomType)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedRoomTypes.has(roomType) ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <h3 className="font-semibold text-lg">{roomType}</h3>
                            <p className="text-sm text-muted-foreground">
                              {unitCount} room{unitCount !== 1 ? 's' : ''} · {plans.length} rate plan{plans.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-3">
                      {plans.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No rate plans configured for this room type.
                        </p>
                      ) : (
                        plans.map(plan => {
                          const price = getPlanPrice(plan.id);
                          return (
                            <div
                              key={plan.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{plan.name}</span>
                                  {plan.is_default && (
                                    <Badge variant="secondary" className="text-xs">Default</Badge>
                                  )}
                                  <Badge
                                    variant={plan.cancellation_policy === 'non_refundable' ? 'destructive' : 'outline'}
                                    className="text-xs"
                                  >
                                    {getCancellationPolicyLabel(plan.cancellation_policy || 'flexible_1_day')}
                                  </Badge>
                                </div>
                                {price && (
                                  <p className="text-sm text-muted-foreground">
                                    {formatCurrency(price.weekday_rate)} weekday / {formatCurrency(price.weekend_rate)} weekend · {price.min_stay} night min
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(plan.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => handleAddForRoomType(roomType)}
                      >
                        <Plus className="h-4 w-4" />
                        Add Rate Plan
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RatePlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ratePlan={editingRatePlan}
        existingPrices={editingRatePlan ? ratePlanPrices[editingRatePlan.id] || [] : []}
        roomType={addingForRoomType || ''}
        units={units.filter(u => u.booking_com_name === (addingForRoomType || editingRatePlan?.room_type))}
        onSave={handleSave}
        isEditing={!!editingRatePlan}
      />

      <BulkRatePlanDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        roomTypes={roomTypes}
        onSave={fetchData}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rate plan? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PMSPrices;

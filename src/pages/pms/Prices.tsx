import { useState, useEffect } from 'react';
import { Plus, DollarSign, Loader2 } from 'lucide-react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RatePlanCard } from '@/components/pms/RatePlanCard';
import { RatePlanDialog } from '@/components/pms/RatePlanDialog';

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

interface RoomType {
  name: string;
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
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRatePlan, setEditingRatePlan] = useState<RatePlan | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch rate plans
      const { data: plans, error: plansError } = await supabase
        .from('rate_plans')
        .select('*')
        .order('priority', { ascending: false });

      if (plansError) throw plansError;

      // Fetch all rate plan prices
      const { data: prices, error: pricesError } = await supabase
        .from('rate_plan_prices')
        .select('*');

      if (pricesError) throw pricesError;

      // Fetch units with id, unit_number, and booking_com_name
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, unit_number, booking_com_name')
        .eq('location', 'ICONIA')
        .not('booking_com_name', 'is', null);

      if (unitsError) throw unitsError;

      // Get unique room types
      const uniqueRoomTypes = [...new Set(unitsData?.map(u => u.booking_com_name).filter(Boolean))] as string[];
      
      setUnits(unitsData || []);

      setRatePlans(plans || []);

      // Group prices by rate plan ID
      const pricesByPlan: Record<string, RatePlanPrice[]> = {};
      (prices || []).forEach(price => {
        if (!pricesByPlan[price.rate_plan_id]) {
          pricesByPlan[price.rate_plan_id] = [];
        }
        pricesByPlan[price.rate_plan_id].push(price);
      });
      setRatePlanPrices(pricesByPlan);

      setRoomTypes(uniqueRoomTypes.map(name => ({ name })));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load rate plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingRatePlan(null);
    setDialogOpen(true);
  };

  const handleEdit = (ratePlan: RatePlan) => {
    setEditingRatePlan(ratePlan);
    setDialogOpen(true);
  };

  const handleDelete = async (ratePlanId: string) => {
    try {
      const { error } = await supabase
        .from('rate_plans')
        .delete()
        .eq('id', ratePlanId);

      if (error) throw error;

      toast.success('Rate plan deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting rate plan:', error);
      toast.error('Failed to delete rate plan');
    }
  };

  const handleToggleActive = async (ratePlanId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('rate_plans')
        .update({ is_active: isActive })
        .eq('id', ratePlanId);

      if (error) throw error;

      toast.success(isActive ? 'Rate plan activated' : 'Rate plan deactivated');
      fetchData();
    } catch (error) {
      console.error('Error toggling rate plan:', error);
      toast.error('Failed to update rate plan');
    }
  };

  const handleSetDefault = async (ratePlanId: string) => {
    try {
      const { error } = await supabase
        .from('rate_plans')
        .update({ is_default: true })
        .eq('id', ratePlanId);

      if (error) throw error;

      toast.success('Default rate plan updated');
      fetchData();
    } catch (error) {
      console.error('Error setting default rate plan:', error);
      toast.error('Failed to set default rate plan');
    }
  };

  const handleSave = async (
    ratePlanData: Omit<RatePlan, 'id' | 'created_at' | 'updated_at'>,
    prices: Array<{ room_type: string; weekday_rate: number; weekend_rate: number; min_stay: number; unit_id?: string | null }>
  ) => {
    try {
      if (editingRatePlan) {
        // Update existing rate plan
        const { error: updateError } = await supabase
          .from('rate_plans')
          .update({
            name: ratePlanData.name,
            valid_from: ratePlanData.valid_from,
            valid_to: ratePlanData.valid_to,
            is_active: ratePlanData.is_active,
          })
          .eq('id', editingRatePlan.id);

        if (updateError) throw updateError;

        // Delete existing prices
        const { error: deleteError } = await supabase
          .from('rate_plan_prices')
          .delete()
          .eq('rate_plan_id', editingRatePlan.id);

        if (deleteError) throw deleteError;

        // Insert new prices (including room-level overrides)
        if (prices.length > 0) {
          const pricesToInsert = prices.map(p => ({
            rate_plan_id: editingRatePlan.id,
            room_type: p.room_type,
            weekday_rate: p.weekday_rate,
            weekend_rate: p.weekend_rate,
            min_stay: p.min_stay,
            unit_id: p.unit_id || null,
          }));

          const { error: insertError } = await supabase
            .from('rate_plan_prices')
            .insert(pricesToInsert);

          if (insertError) throw insertError;
        }

        toast.success('Rate plan updated');
      } else {
        // Create new rate plan
        const { data: newPlan, error: createError } = await supabase
          .from('rate_plans')
          .insert([ratePlanData])
          .select()
          .single();

        if (createError) throw createError;

        // Insert prices (including room-level overrides)
        if (prices.length > 0 && newPlan) {
          const pricesToInsert = prices.map(p => ({
            rate_plan_id: newPlan.id,
            room_type: p.room_type,
            weekday_rate: p.weekday_rate,
            weekend_rate: p.weekend_rate,
            min_stay: p.min_stay,
            unit_id: p.unit_id || null,
          }));

          const { error: insertError } = await supabase
            .from('rate_plan_prices')
            .insert(pricesToInsert);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Prices</h1>
          </div>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Rate Plan
          </Button>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="PMS" currentPage="Prices" />
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {ratePlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <div className="rounded-full bg-muted p-6 mb-4">
              <DollarSign className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Rate Plans</h2>
            <p className="text-muted-foreground max-w-md mb-6">
              Create your first rate plan to set pricing for room types. Rate plans are the single source of truth for all pricing.
            </p>
            <Button onClick={handleCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Rate Plan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold">Rate Plans</h2>
                <p className="text-sm text-muted-foreground">
                  Manage pricing for all room types. Higher priority plans override lower ones for overlapping dates.
                </p>
              </div>
            </div>

            {ratePlans.map((plan) => (
              <RatePlanCard
                key={plan.id}
                ratePlan={plan}
                prices={ratePlanPrices[plan.id] || []}
                units={units}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rate Plan Dialog */}
      <RatePlanDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        ratePlan={editingRatePlan}
        existingPrices={editingRatePlan ? ratePlanPrices[editingRatePlan.id] || [] : []}
        roomTypes={roomTypes}
        units={units}
        onSave={handleSave}
        isEditing={!!editingRatePlan}
      />
    </div>
  );
};

export default PMSPrices;

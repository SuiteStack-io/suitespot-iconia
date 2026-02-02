import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RestrictionRow } from '@/components/pms/RestrictionRow';
import { RatePlanNameDialog } from '@/components/pms/RatePlanNameDialog';
import {
  CancellationPolicyDialog,
  getCancellationPolicyLabel,
} from '@/components/pms/CancellationPolicyDialog';
import {
  MealPlanDialog,
  getMealPlanLabel,
} from '@/components/pms/MealPlanDialog';
import {
  ValueAddsDialog,
  ValueAdd,
  getValueAddsLabel,
} from '@/components/pms/ValueAddsDialog';
import {
  BookingRulesDialog,
  getBookingRulesLabel,
} from '@/components/pms/BookingRulesDialog';
import {
  RoomApplicabilityDialog,
  getRoomApplicabilityLabel,
} from '@/components/pms/RoomApplicabilityDialog';
import { Loader2 } from 'lucide-react';

interface RatePlan {
  id: string;
  name: string;
  cancellation_policy: string;
  meal_plan: string;
  meal_plan_price: number | null;
  advance_booking_days: number;
  applicable_room_types: string[] | null;
}

const PMSRestrictions = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);
  const [valueAdds, setValueAdds] = useState<ValueAdd[]>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Dialog states
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [valueAddsDialogOpen, setValueAddsDialogOpen] = useState(false);
  const [bookingRulesDialogOpen, setBookingRulesDialogOpen] = useState(false);
  const [roomsDialogOpen, setRoomsDialogOpen] = useState(false);

  // Fetch rate plans
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch rate plans
        const { data: plans, error: plansError } = await supabase
          .from('rate_plans')
          .select('id, name, cancellation_policy, meal_plan, meal_plan_price, advance_booking_days, applicable_room_types')
          .order('name');

        if (plansError) throw plansError;

        // Fetch unique room types from units
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('booking_com_name')
          .not('booking_com_name', 'is', null);

        if (unitsError) throw unitsError;

        const uniqueRoomTypes = Array.from(
          new Set(units?.map((u) => u.booking_com_name).filter(Boolean) as string[])
        );

        setRatePlans(plans || []);
        setRoomTypes(uniqueRoomTypes);

        if (plans && plans.length > 0) {
          setSelectedPlanId(plans[0].id);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load rate plans',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  // Fetch selected plan details and value adds
  useEffect(() => {
    if (!selectedPlanId) {
      setSelectedPlan(null);
      setValueAdds([]);
      return;
    }

    const plan = ratePlans.find((p) => p.id === selectedPlanId);
    setSelectedPlan(plan || null);

    const fetchValueAdds = async () => {
      const { data, error } = await supabase
        .from('rate_plan_value_adds')
        .select('*')
        .eq('rate_plan_id', selectedPlanId)
        .order('created_at');

      if (error) {
        console.error('Error fetching value adds:', error);
      } else {
        setValueAdds(data || []);
      }
    };

    fetchValueAdds();
    setHasChanges(false);
  }, [selectedPlanId, ratePlans]);

  const handleSaveChanges = async () => {
    if (!selectedPlan) return;

    setSaving(true);
    try {
      // Update rate plan
      const { error: planError } = await supabase
        .from('rate_plans')
        .update({
          name: selectedPlan.name,
          cancellation_policy: selectedPlan.cancellation_policy,
          meal_plan: selectedPlan.meal_plan,
          meal_plan_price: selectedPlan.meal_plan_price,
          advance_booking_days: selectedPlan.advance_booking_days,
          applicable_room_types: selectedPlan.applicable_room_types,
        })
        .eq('id', selectedPlan.id);

      if (planError) throw planError;

      // Delete existing value adds
      await supabase
        .from('rate_plan_value_adds')
        .delete()
        .eq('rate_plan_id', selectedPlan.id);

      // Insert new value adds
      if (valueAdds.length > 0) {
        const { error: valueAddsError } = await supabase
          .from('rate_plan_value_adds')
          .insert(
            valueAdds.map((va) => ({
              rate_plan_id: selectedPlan.id,
              name: va.name,
              description: va.description || null,
              price: va.price,
              is_per_night: va.is_per_night,
            }))
          );

        if (valueAddsError) throw valueAddsError;
      }

      // Refresh rate plans
      const { data: updatedPlans } = await supabase
        .from('rate_plans')
        .select('id, name, cancellation_policy, meal_plan, meal_plan_price, advance_booking_days, applicable_room_types')
        .order('name');

      setRatePlans(updatedPlans || []);
      setHasChanges(false);

      toast({
        title: 'Success',
        description: 'Rate plan restrictions saved successfully',
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedPlan = (updates: Partial<RatePlan>) => {
    if (selectedPlan) {
      setSelectedPlan({ ...selectedPlan, ...updates });
      setHasChanges(true);
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
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Restrictions</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <AdminBreadcrumb section="PMS" currentPage="Restrictions" />

        {/* Rate Plan Selector */}
        <div className="mt-6 mb-6">
          <label className="block text-sm font-medium mb-2">Select Rate Plan</label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Select a rate plan" />
            </SelectTrigger>
            <SelectContent>
              {ratePlans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Configuration Card */}
        {selectedPlan && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rate Plan Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <RestrictionRow
                label="Rate plan name"
                value={selectedPlan.name}
                onEdit={() => setNameDialogOpen(true)}
              />
              <RestrictionRow
                label="Policy"
                value={getCancellationPolicyLabel(selectedPlan.cancellation_policy || 'flexible_1_day')}
                onEdit={() => setPolicyDialogOpen(true)}
              />
              <RestrictionRow
                label="Meals"
                value={getMealPlanLabel(
                  selectedPlan.meal_plan || 'no_meals',
                  selectedPlan.meal_plan_price
                )}
                onEdit={() => setMealDialogOpen(true)}
              />
              <RestrictionRow
                label="Value adds"
                value={getValueAddsLabel(valueAdds)}
                onEdit={() => setValueAddsDialogOpen(true)}
              />
              <RestrictionRow
                label="Bookable"
                value={getBookingRulesLabel(selectedPlan.advance_booking_days || 0)}
                onEdit={() => setBookingRulesDialogOpen(true)}
              />
              <RestrictionRow
                label="Price"
                value="Managed by PMS > Prices"
                editLabel="View"
                onEdit={() => navigate('/pms/prices')}
              />
              <RestrictionRow
                label="Rooms"
                value={getRoomApplicabilityLabel(
                  selectedPlan.applicable_room_types,
                  roomTypes.length
                )}
                onEdit={() => setRoomsDialogOpen(true)}
              />
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        {selectedPlan && (
          <div className="flex justify-center gap-4 mt-6">
            <Button variant="outline" onClick={() => navigate('/pms/prices')}>
              Go back
            </Button>
            <Button onClick={handleSaveChanges} disabled={!hasChanges || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply changes
            </Button>
          </div>
        )}

        {!selectedPlan && ratePlans.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No rate plans found. Create a rate plan first in PMS &gt; Prices.
            </p>
            <Button onClick={() => navigate('/pms/prices')}>Go to Prices</Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {selectedPlan && (
        <>
          <RatePlanNameDialog
            open={nameDialogOpen}
            onOpenChange={setNameDialogOpen}
            name={selectedPlan.name}
            onChange={(name) => updateSelectedPlan({ name })}
          />
          <CancellationPolicyDialog
            open={policyDialogOpen}
            onOpenChange={setPolicyDialogOpen}
            value={selectedPlan.cancellation_policy || 'flexible_1_day'}
            onChange={(cancellation_policy) => updateSelectedPlan({ cancellation_policy })}
          />
          <MealPlanDialog
            open={mealDialogOpen}
            onOpenChange={setMealDialogOpen}
            mealPlan={selectedPlan.meal_plan || 'no_meals'}
            mealPlanPrice={selectedPlan.meal_plan_price}
            onChange={(meal_plan, meal_plan_price) =>
              updateSelectedPlan({ meal_plan, meal_plan_price })
            }
          />
          <ValueAddsDialog
            open={valueAddsDialogOpen}
            onOpenChange={setValueAddsDialogOpen}
            valueAdds={valueAdds}
            onChange={(newValueAdds) => {
              setValueAdds(newValueAdds);
              setHasChanges(true);
            }}
          />
          <BookingRulesDialog
            open={bookingRulesDialogOpen}
            onOpenChange={setBookingRulesDialogOpen}
            advanceBookingDays={selectedPlan.advance_booking_days || 0}
            onChange={(advance_booking_days) =>
              updateSelectedPlan({ advance_booking_days })
            }
          />
          <RoomApplicabilityDialog
            open={roomsDialogOpen}
            onOpenChange={setRoomsDialogOpen}
            selectedRoomTypes={selectedPlan.applicable_room_types}
            availableRoomTypes={roomTypes}
            onChange={(applicable_room_types) =>
              updateSelectedPlan({ applicable_room_types })
            }
          />
        </>
      )}
    </div>
  );
};

export default PMSRestrictions;

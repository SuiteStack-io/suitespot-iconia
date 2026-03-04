import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { DefaultRestrictionsCard } from '@/components/pms/DefaultRestrictionsCard';
import { RestrictionCalendarView } from '@/components/pms/RestrictionCalendarView';
import { BulkRestrictionEditor } from '@/components/pms/BulkRestrictionEditor';
import { Loader2 } from 'lucide-react';

interface RatePlan {
  id: string;
  name: string;
  cancellation_policy: string;
  meal_plan: string;
  meal_plan_price: number | null;
  advance_booking_days: number;
  room_type: string | null;
  default_min_stay_through?: number[] | null;
  default_min_stay_arrival?: number[] | null;
  default_max_stay?: number | null;
  default_stop_sell?: boolean;
  default_closed_to_arrival?: boolean;
  default_closed_to_departure?: boolean;
}

const PMSRestrictions = () => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const propertyId = usePropertyId();

  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);
  const [valueAdds, setValueAdds] = useState<ValueAdd[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [calendarKey, setCalendarKey] = useState(0);

  // Dialog states
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [valueAddsDialogOpen, setValueAddsDialogOpen] = useState(false);
  const [bookingRulesDialogOpen, setBookingRulesDialogOpen] = useState(false);

  const fetchPlans = async () => {
    if (!propertyId) { setLoading(false); return; }
    try {
      const { data: plans, error: plansError } = await supabase
        .from('rate_plans')
        .select('id, name, cancellation_policy, meal_plan, meal_plan_price, advance_booking_days, room_type, default_min_stay_through, default_min_stay_arrival, default_max_stay, default_stop_sell, default_closed_to_arrival, default_closed_to_departure')
        .eq('is_active', true)
        .eq('property_id', propertyId)
        .order('room_type')
        .order('name');

      if (plansError) throw plansError;

      setRatePlans(plans || []);

      if (plans && plans.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plans[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load rate plans', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedPlanId('');
    fetchPlans();
  }, [propertyId, toast]);

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

      if (error) console.error('Error fetching value adds:', error);
      else setValueAdds(data || []);
    };

    fetchValueAdds();
    setHasChanges(false);
  }, [selectedPlanId, ratePlans]);

  const handleSaveChanges = async () => {
    if (!selectedPlan) return;

    setSaving(true);
    try {
      const { error: planError } = await supabase
        .from('rate_plans')
        .update({
          name: selectedPlan.name,
          cancellation_policy: selectedPlan.cancellation_policy,
          meal_plan: selectedPlan.meal_plan,
          meal_plan_price: selectedPlan.meal_plan_price,
          advance_booking_days: selectedPlan.advance_booking_days,
        })
        .eq('id', selectedPlan.id);

      if (planError) throw planError;

      await supabase.from('rate_plan_value_adds').delete().eq('rate_plan_id', selectedPlan.id);

      if (valueAdds.length > 0) {
        const { error: valueAddsError } = await supabase
          .from('rate_plan_value_adds')
          .insert(valueAdds.map((va) => ({
            rate_plan_id: selectedPlan.id,
            name: va.name,
            description: va.description || null,
            price: va.price,
            is_per_night: va.is_per_night,
          })));
        if (valueAddsError) throw valueAddsError;
      }

      await fetchPlans();
      setHasChanges(false);

      toast({ title: 'Success', description: 'Rate plan restrictions saved successfully' });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({ title: 'Error', description: 'Failed to save changes', variant: 'destructive' });
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
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="PMS" currentPage="Restrictions" />
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Restrictions</h1>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="settings">Rate Plan Settings</TabsTrigger>
            <TabsTrigger value="calendar">Restrictions Calendar</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Editor</TabsTrigger>
          </TabsList>

          {/* Tab 1: Rate Plan Settings (existing + defaults) */}
          <TabsContent value="settings">
            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium">Select Rate Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Select a rate plan" />
                </SelectTrigger>
                <SelectContent>
                  {ratePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.room_type && <span className="text-muted-foreground ml-1">({plan.room_type})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlan && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Rate Plan Configuration</CardTitle>
                      {selectedPlan.room_type && (
                        <Badge variant="secondary">{selectedPlan.room_type}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <RestrictionRow
                      label="Rate plan name"
                      value={selectedPlan.name}
                      onEdit={() => setNameDialogOpen(true)}
                    />
                    <RestrictionRow
                      label="Room type"
                      value={selectedPlan.room_type || 'Not assigned'}
                    />
                    <RestrictionRow
                      label="Policy"
                      value={getCancellationPolicyLabel(selectedPlan.cancellation_policy || 'flexible_1_day')}
                      onEdit={() => setPolicyDialogOpen(true)}
                    />
                    <RestrictionRow
                      label="Meals"
                      value={getMealPlanLabel(selectedPlan.meal_plan || 'no_meals', selectedPlan.meal_plan_price)}
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
                  </CardContent>
                </Card>

                <DefaultRestrictionsCard
                  ratePlanId={selectedPlan.id}
                  ratePlanName={selectedPlan.name}
                />

                <div className="flex justify-center gap-4 mt-6">
                  <Button variant="outline" onClick={() => navigate('/pms/prices')}>Go back</Button>
                  <Button onClick={handleSaveChanges} disabled={!hasChanges || saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply changes
                  </Button>
                </div>
              </>
            )}

            {!selectedPlan && ratePlans.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No rate plans found. Create a rate plan first in PMS &gt; Prices.</p>
                <Button onClick={() => navigate('/pms/prices')}>Go to Prices</Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Restrictions Calendar */}
          <TabsContent value="calendar">
            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium">Select Rate Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="w-full md:w-96">
                  <SelectValue placeholder="Select a rate plan" />
                </SelectTrigger>
                <SelectContent>
                  {ratePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.room_type && <span className="text-muted-foreground ml-1">({plan.room_type})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <RestrictionCalendarView key={calendarKey} ratePlans={ratePlans} />
          </TabsContent>

          {/* Tab 3: Bulk Editor */}
          <TabsContent value="bulk">
            <BulkRestrictionEditor
              ratePlans={ratePlans}
              onSaved={() => setCalendarKey((k) => k + 1)}
              onRatePlanFocused={(id) => {
                setSelectedPlanId(id);
                setActiveTab('calendar');
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

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
            onChange={(meal_plan, meal_plan_price) => updateSelectedPlan({ meal_plan, meal_plan_price })}
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
            onChange={(advance_booking_days) => updateSelectedPlan({ advance_booking_days })}
          />
        </>
      )}
    </div>
  );
};

export default PMSRestrictions;

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
  property_id: string | null;
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

interface ChannexMapping {
  channex_id: string;
}

const RoomRates = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);
  const [prices, setPrices] = useState<RatePlanPrice[]>([]);
  const [propertyChannexId, setPropertyChannexId] = useState<string | null>(null);
  
  // Editable state
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSellMode, setEditedSellMode] = useState<'per_room' | 'per_person'>('per_room');
  const [editedPrices, setEditedPrices] = useState<Record<string, EditedPrice>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchRatePlans();
    fetchPropertyChannexId();
  }, []);

  useEffect(() => {
    if (selectedPlanId) {
      const plan = ratePlans.find(p => p.id === selectedPlanId);
      setSelectedPlan(plan || null);
      if (plan) {
        setEditedTitle(plan.name);
        setEditedSellMode(plan.sell_mode as 'per_room' | 'per_person');
        fetchPrices(plan.id);
      }
    }
  }, [selectedPlanId, ratePlans]);

  const fetchRatePlans = async () => {
    try {
      const { data, error } = await supabase
        .from('rate_plans')
        .select('id, name, is_default, is_active, property_id, currency, sell_mode, extra_adult_rate, extra_child_rate')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (error) throw error;

      setRatePlans(data || []);
      
      // Select default plan or first plan
      if (data && data.length > 0) {
        const defaultPlan = data.find(p => p.is_default) || data[0];
        setSelectedPlanId(defaultPlan.id);
      }
    } catch (error) {
      console.error('Error fetching rate plans:', error);
      toast.error('Failed to load rate plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyChannexId = async () => {
    try {
      const { data, error } = await supabase
        .from('channex_mappings')
        .select('channex_id')
        .eq('entity_type', 'property')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPropertyChannexId(data?.channex_id || null);
    } catch (error) {
      console.error('Error fetching property Channex ID:', error);
    }
  };

  const fetchPrices = async (ratePlanId: string) => {
    try {
      const { data, error } = await supabase
        .from('rate_plan_prices')
        .select('*')
        .eq('rate_plan_id', ratePlanId)
        .is('unit_id', null) // Only get room-type level prices, not unit overrides
        .order('room_type');

      if (error) throw error;
      
      setPrices(data || []);
      
      // Initialize edited prices
      const editedMap: Record<string, EditedPrice> = {};
      (data || []).forEach(price => {
        editedMap[price.id] = {
          weekday_rate: price.weekday_rate,
          weekend_rate: price.weekend_rate,
          min_stay: price.min_stay,
          base_occupancy: price.base_occupancy ?? 2,
          max_occupancy: price.max_occupancy,
        };
      });
      setEditedPrices(editedMap);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error('Failed to load prices');
    }
  };

  const handlePriceChange = (priceId: string, field: keyof EditedPrice, value: number | null) => {
    setEditedPrices(prev => ({
      ...prev,
      [priceId]: {
        ...prev[priceId],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleTitleChange = (value: string) => {
    setEditedTitle(value);
    setHasChanges(true);
  };

  const handleSellModeChange = (value: 'per_room' | 'per_person') => {
    setEditedSellMode(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedPlan) return;

    setSaving(true);
    try {
      // Update rate plan
      const { error: planError } = await supabase
        .from('rate_plans')
        .update({
          name: editedTitle,
          sell_mode: editedSellMode,
        })
        .eq('id', selectedPlan.id);

      if (planError) throw planError;

      // Update prices
      for (const [priceId, editedPrice] of Object.entries(editedPrices)) {
        const { error: priceError } = await supabase
          .from('rate_plan_prices')
          .update({
            weekday_rate: editedPrice.weekday_rate,
            weekend_rate: editedPrice.weekend_rate,
            min_stay: editedPrice.min_stay,
            base_occupancy: editedPrice.base_occupancy,
            max_occupancy: editedPrice.max_occupancy,
          })
          .eq('id', priceId);

        if (priceError) throw priceError;
      }

      toast.success('Rate plan saved successfully');
      setHasChanges(false);
      
      // Refresh data
      await fetchRatePlans();
    } catch (error) {
      console.error('Error saving rate plan:', error);
      toast.error('Failed to save rate plan');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return '—';
    return `$${amount.toLocaleString()}`;
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
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-xl font-semibold text-foreground">Room Rates</h1>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="ICONIA" currentPage="Room Rates" />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-6 max-w-6xl mx-auto">
        {ratePlans.length === 0 ? (
          <div className="bg-card rounded-lg border shadow-sm p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No rate plans found. Create one in PMS → Prices.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Rate Plan Selector */}
            <div className="bg-card rounded-lg border shadow-sm p-4">
              <Label className="text-sm font-medium mb-2 block">Rate Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Select a rate plan" />
                </SelectTrigger>
                <SelectContent>
                  {ratePlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} {plan.is_default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlan && (
              <>
                {/* Rate Plan Settings */}
                <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <h2 className="font-semibold">Rate Plan Settings</h2>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Title */}
                    <div className="space-y-2">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={editedTitle}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="Rate plan name"
                      />
                    </div>

                    {/* Property ID */}
                    <div className="space-y-2">
                      <Label>Property ID</Label>
                      <Input
                        value={propertyChannexId || 'Not configured'}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground">From Channex mapping</p>
                    </div>

                    {/* Currency */}
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Input
                        value="USD"
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                      <p className="text-xs text-muted-foreground">Fixed</p>
                    </div>

                    {/* Sell Mode */}
                    <div className="space-y-2">
                      <Label>Sell Mode</Label>
                      <Select value={editedSellMode} onValueChange={handleSellModeChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_room">Per Room</SelectItem>
                          <SelectItem value="per_person">Per Person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Rates Table */}
                <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-muted/30">
                    <h2 className="font-semibold">Room Type Rates</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Room Type</TableHead>
                          <TableHead className="font-semibold text-right">Weekday Rate</TableHead>
                          <TableHead className="font-semibold text-right">Weekend Rate</TableHead>
                          <TableHead className="font-semibold text-right">Min Stay</TableHead>
                          <TableHead className="font-semibold text-right">Base Occ</TableHead>
                          <TableHead className="font-semibold text-right">Max Occ</TableHead>
                          <TableHead className="font-semibold text-right">Extra Adult</TableHead>
                          <TableHead className="font-semibold text-right">Extra Child</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prices.map((price) => {
                          const edited = editedPrices[price.id];
                          if (!edited) return null;

                          return (
                            <TableRow key={price.id} className="hover:bg-muted/20">
                              <TableCell className="font-medium">{price.room_type}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={edited.weekday_rate}
                                  onChange={(e) => handlePriceChange(price.id, 'weekday_rate', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right ml-auto"
                                  min={0}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={edited.weekend_rate}
                                  onChange={(e) => handlePriceChange(price.id, 'weekend_rate', parseFloat(e.target.value) || 0)}
                                  className="w-24 text-right ml-auto"
                                  min={0}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={edited.min_stay}
                                  onChange={(e) => handlePriceChange(price.id, 'min_stay', parseInt(e.target.value) || 1)}
                                  className="w-20 text-right ml-auto"
                                  min={1}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={edited.base_occupancy}
                                  onChange={(e) => handlePriceChange(price.id, 'base_occupancy', parseInt(e.target.value) || 1)}
                                  className="w-20 text-right ml-auto"
                                  min={1}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  value={edited.max_occupancy ?? ''}
                                  onChange={(e) => handlePriceChange(price.id, 'max_occupancy', e.target.value ? parseInt(e.target.value) : null)}
                                  className="w-20 text-right ml-auto"
                                  min={1}
                                  placeholder="—"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-muted-foreground">
                                  {formatCurrency(selectedPlan.extra_adult_rate)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-muted-foreground">
                                  {formatCurrency(selectedPlan.extra_child_rate)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {prices.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No room types configured for this rate plan
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Channex Schema Info */}
                <div className="bg-muted/30 rounded-lg border p-4">
                  <h3 className="font-medium text-sm mb-2">Channex Schema Mapping</h3>
                  <p className="text-xs text-muted-foreground">
                    This data will map to Channex's rate plan schema: title → name, property_id → Channex property, 
                    currency → USD (fixed), sell_mode → per_room/per_person, options.base_occupancy, options.max_occupancy, 
                    options.extra_adult_rate ($50 default), options.extra_child_rate ($0 default).
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RoomRates;

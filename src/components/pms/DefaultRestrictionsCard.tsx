import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface DefaultRestrictionsCardProps {
  ratePlanId: string;
  ratePlanName: string;
}

interface Defaults {
  default_min_stay: number;
  default_max_stay: number | null;
  default_stop_sell: boolean;
  default_closed_to_arrival: boolean;
  default_closed_to_departure: boolean;
}

export function DefaultRestrictionsCard({ ratePlanId, ratePlanName }: DefaultRestrictionsCardProps) {
  const { toast } = useToast();
  const [defaults, setDefaults] = useState<Defaults>({
    default_min_stay: 1,
    default_max_stay: null,
    default_stop_sell: false,
    default_closed_to_arrival: false,
    default_closed_to_departure: false,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('rate_plans')
        .select('default_min_stay, default_max_stay, default_stop_sell, default_closed_to_arrival, default_closed_to_departure')
        .eq('id', ratePlanId)
        .maybeSingle();

      if (data) {
        setDefaults({
          default_min_stay: data.default_min_stay ?? 1,
          default_max_stay: data.default_max_stay ?? null,
          default_stop_sell: data.default_stop_sell ?? false,
          default_closed_to_arrival: data.default_closed_to_arrival ?? false,
          default_closed_to_departure: data.default_closed_to_departure ?? false,
        });
      }
      setDirty(false);
    };
    fetch();
  }, [ratePlanId]);

  const update = (key: keyof Defaults, value: any) => {
    setDefaults((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validation
      if (defaults.default_min_stay < 1) {
        toast({ title: 'Validation Error', description: 'Min stay must be at least 1', variant: 'destructive' });
        return;
      }
      if (defaults.default_max_stay !== null && defaults.default_max_stay <= defaults.default_min_stay) {
        toast({ title: 'Validation Error', description: 'Max stay must be greater than min stay', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('rate_plans')
        .update(defaults)
        .eq('id', ratePlanId);

      if (error) throw error;
      setDirty(false);
      toast({ title: 'Saved', description: 'Default restrictions updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Default Restrictions</CardTitle>
        <p className="text-xs text-muted-foreground">
          These apply to all dates unless overridden by date-specific restrictions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Min Stay (nights)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={defaults.default_min_stay}
              onChange={(e) => update('default_min_stay', parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Max Stay (nights)</Label>
            <Input
              type="number"
              min={1}
              max={365}
              placeholder="No limit"
              value={defaults.default_max_stay ?? ''}
              onChange={(e) => update('default_max_stay', e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Stop Sell</Label>
            <Switch
              checked={defaults.default_stop_sell}
              onCheckedChange={(v) => update('default_stop_sell', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Closed to Arrival</Label>
            <Switch
              checked={defaults.default_closed_to_arrival}
              onCheckedChange={(v) => update('default_closed_to_arrival', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Closed to Departure</Label>
            <Switch
              checked={defaults.default_closed_to_departure}
              onCheckedChange={(v) => update('default_closed_to_departure', v)}
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={!dirty || saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Defaults
        </Button>
      </CardContent>
    </Card>
  );
}

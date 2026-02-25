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

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_ARRAY = [1, 1, 1, 1, 1, 1, 1];

interface Defaults {
  default_min_stay_through: number[];
  default_min_stay_arrival: number[];
  default_max_stay: number | null;
  default_stop_sell: boolean;
  default_closed_to_arrival: boolean;
  default_closed_to_departure: boolean;
}

export function DefaultRestrictionsCard({ ratePlanId, ratePlanName }: DefaultRestrictionsCardProps) {
  const { toast } = useToast();
  const [defaults, setDefaults] = useState<Defaults>({
    default_min_stay_through: [...DEFAULT_ARRAY],
    default_min_stay_arrival: [...DEFAULT_ARRAY],
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
        .select('default_min_stay_through, default_min_stay_arrival, default_max_stay, default_stop_sell, default_closed_to_arrival, default_closed_to_departure')
        .eq('id', ratePlanId)
        .maybeSingle();

      if (data) {
        const arrivalRaw = data.default_min_stay_arrival as unknown;
        const throughRaw = data.default_min_stay_through as unknown;
        setDefaults({
          default_min_stay_arrival: Array.isArray(arrivalRaw) ? (arrivalRaw as number[]) : [...DEFAULT_ARRAY],
          default_min_stay_through: Array.isArray(throughRaw) ? (throughRaw as number[]) : [...DEFAULT_ARRAY],
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

  const updateScalar = (key: 'default_max_stay' | 'default_stop_sell' | 'default_closed_to_arrival' | 'default_closed_to_departure', value: any) => {
    setDefaults((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateDayValue = (field: 'default_min_stay_arrival' | 'default_min_stay_through', dayIndex: number, value: number) => {
    setDefaults((prev) => {
      const arr = [...prev[field]];
      arr[dayIndex] = Math.max(1, value);
      return { ...prev, [field]: arr };
    });
    setDirty(true);
  };

  const applyPreset = (arrival: number[], through: number[]) => {
    setDefaults((prev) => ({ ...prev, default_min_stay_arrival: arrival, default_min_stay_through: through }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (defaults.default_min_stay_arrival.some(v => v < 1) || defaults.default_min_stay_through.some(v => v < 1)) {
        toast({ title: 'Validation Error', description: 'Min stay values must be at least 1', variant: 'destructive' });
        return;
      }

      const maxArrival = Math.max(...defaults.default_min_stay_arrival);
      const maxThrough = Math.max(...defaults.default_min_stay_through);
      if (defaults.default_max_stay !== null && (defaults.default_max_stay <= maxArrival || defaults.default_max_stay <= maxThrough)) {
        toast({ title: 'Validation Error', description: 'Max stay must be greater than all min stay values', variant: 'destructive' });
        return;
      }

      const { error } = await supabase
        .from('rate_plans')
        .update(defaults as any)
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
        <CardTitle className="text-base">Default Restrictions (by day of week)</CardTitle>
        <p className="text-xs text-muted-foreground">
          These apply to all dates unless overridden by date-specific restrictions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Helper text */}
        <div className="space-y-1 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
          <p><strong>Min Stay Arrival:</strong> Minimum nights required when a guest <em>checks in</em> on this day</p>
          <p><strong>Min Stay Through:</strong> Minimum nights required for any booking that <em>includes</em> this day</p>
        </div>

        {/* Day-of-week table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium">Day</th>
                <th className="text-center py-2 px-2 font-medium">Min Stay Arrival</th>
                <th className="text-center py-2 px-2 font-medium">Min Stay Through</th>
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((day, i) => {
                const isWeekend = i === 0 || i === 6;
                return (
                  <tr key={day} className={`border-b ${isWeekend ? 'bg-muted/30' : ''}`}>
                    <td className="py-1.5 pr-4 text-sm">{day}</td>
                    <td className="py-1.5 px-2">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        className="h-8 w-20 mx-auto text-center"
                        value={defaults.default_min_stay_arrival[i]}
                        onChange={(e) => updateDayValue('default_min_stay_arrival', i, parseInt(e.target.value) || 1)}
                      />
                    </td>
                    <td className="py-1.5 px-2">
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        className="h-8 w-20 mx-auto text-center"
                        value={defaults.default_min_stay_through[i]}
                        onChange={(e) => updateDayValue('default_min_stay_through', i, parseInt(e.target.value) || 1)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset([2,1,1,1,1,1,2], [2,1,1,1,1,1,2])}
          >
            Weekday: 1 / Weekend: 2
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset([...DEFAULT_ARRAY], [...DEFAULT_ARRAY])}
          >
            All days: 1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset([2,2,2,2,2,2,2], [2,2,2,2,2,2,2])}
          >
            All days: 2
          </Button>
        </div>

        {/* Max stay + toggles */}
        <div className="space-y-1.5">
          <Label className="text-sm">Max Stay (nights)</Label>
          <Input
            type="number"
            min={1}
            max={365}
            placeholder="No limit"
            value={defaults.default_max_stay ?? ''}
            onChange={(e) => updateScalar('default_max_stay', e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Stop Sell</Label>
            <Switch
              checked={defaults.default_stop_sell}
              onCheckedChange={(v) => updateScalar('default_stop_sell', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Closed to Arrival</Label>
            <Switch
              checked={defaults.default_closed_to_arrival}
              onCheckedChange={(v) => updateScalar('default_closed_to_arrival', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Closed to Departure</Label>
            <Switch
              checked={defaults.default_closed_to_departure}
              onCheckedChange={(v) => updateScalar('default_closed_to_departure', v)}
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

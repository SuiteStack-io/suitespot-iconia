import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProperty } from '@/lib/propertyContext';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REGION_PRESETS: Record<string, { weekend_days: number[]; off_peak_days: number[] }> = {
  middle_east: { weekend_days: [4, 5], off_peak_days: [6] },
  western: { weekend_days: [5, 6], off_peak_days: [0] },
};

function detectPreset(weekend: number[], offPeak: number[]): string {
  for (const [key, val] of Object.entries(REGION_PRESETS)) {
    if (
      JSON.stringify([...val.weekend_days].sort()) === JSON.stringify([...weekend].sort()) &&
      JSON.stringify([...val.off_peak_days].sort()) === JSON.stringify([...offPeak].sort())
    ) return key;
  }
  return 'custom';
}

export const PricingRulesEditor = () => {
  const { activeProperty, refreshProperties } = useProperty();
  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [offPeakDays, setOffPeakDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeProperty) {
      setWeekendDays((activeProperty.weekend_days as number[]) || []);
      setOffPeakDays((activeProperty.off_peak_days as number[]) || []);
    }
  }, [activeProperty]);

  const preset = detectPreset(weekendDays, offPeakDays);

  const handlePreset = (key: string) => {
    const p = REGION_PRESETS[key];
    if (p) {
      setWeekendDays(p.weekend_days);
      setOffPeakDays(p.off_peak_days);
    }
  };

  const toggleDay = (list: number[], setList: (v: number[]) => void, idx: number) => {
    setList(list.includes(idx) ? list.filter(d => d !== idx) : [...list, idx]);
  };

  const handleSave = async () => {
    if (!activeProperty) return;
    setSaving(true);
    const { error } = await supabase
      .from('properties')
      .update({ weekend_days: weekendDays, off_peak_days: offPeakDays })
      .eq('id', activeProperty.id);
    setSaving(false);
    if (error) {
      toast.error('Failed to save pricing rules');
    } else {
      await refreshProperties();
      toast.success('Pricing rules updated');
    }
  };

  if (!activeProperty) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Pricing Rules</CardTitle>
        <CardDescription>
          Configure which days of the week use weekend (premium) or off-peak (discounted) rates. All other days use the standard weekday rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3">
          <Label className="text-sm">Region Preset</Label>
          <Select value={preset} onValueChange={handlePreset}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="Region preset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="middle_east">Middle East</SelectItem>
              <SelectItem value="western">Western</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Weekend Days (Premium Rates)</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, idx) => {
              const isSelected = weekendDays.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-accent'
                  }`}
                  onClick={() => {
                    toggleDay(weekendDays, setWeekendDays, idx);
                    // Remove from off-peak if added to weekend
                    if (!isSelected) setOffPeakDays(prev => prev.filter(d => d !== idx));
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground mb-2 block">Off-Peak Days (Discounted Rates)</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_NAMES.map((name, idx) => {
              const isSelected = offPeakDays.includes(idx);
              const isConflict = weekendDays.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  className={`px-4 py-2 text-sm rounded-md border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : isConflict
                        ? 'bg-muted text-muted-foreground border-input cursor-not-allowed opacity-50'
                        : 'bg-background border-input hover:bg-accent'
                  }`}
                  disabled={isConflict}
                  onClick={() => {
                    if (!isConflict) toggleDay(offPeakDays, setOffPeakDays, idx);
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Pricing Rules
        </Button>
      </CardContent>
    </Card>
  );
};

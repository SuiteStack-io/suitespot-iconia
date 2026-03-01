import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateWeekendRate } from '@/lib/rateResolver';
import { cn } from '@/lib/utils';

interface RoomType {
  name: string;
}

interface BulkRatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypes: RoomType[];
  onSave: () => void;
  propertyId: string | null;
}

interface RoomTypePrice {
  weekday_rate: number;
  weekend_rate: number;
}

export function BulkRatePlanDialog({ open, onOpenChange, roomTypes, onSave, propertyId }: BulkRatePlanDialogProps) {
  const [namePrefix, setNamePrefix] = useState('Standard Rate');
  const [minStay, setMinStay] = useState(1);
  const [autoCalculateWeekend, setAutoCalculateWeekend] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prices, setPrices] = useState<Record<string, RoomTypePrice>>(() => {
    const initial: Record<string, RoomTypePrice> = {};
    roomTypes.forEach(rt => {
      initial[rt.name] = { weekday_rate: 0, weekend_rate: 0 };
    });
    return initial;
  });

  const handleWeekdayChange = (roomType: string, value: number) => {
    setPrices(prev => ({
      ...prev,
      [roomType]: {
        weekday_rate: value,
        weekend_rate: autoCalculateWeekend ? calculateWeekendRate(value) : prev[roomType]?.weekend_rate || 0,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const rt of roomTypes) {
        const price = prices[rt.name];
        if (!price || price.weekday_rate <= 0) continue;

        const { data: newPlan, error: planError } = await supabase
          .from('rate_plans')
          .insert({
            name: `${namePrefix} - ${rt.name}`,
            room_type: rt.name,
            is_active: true,
            is_default: false,
            priority: 0,
            property_id: propertyId,
          })
          .select()
          .single();

        if (planError) throw planError;

        const { error: priceError } = await supabase
          .from('rate_plan_prices')
          .insert({
            rate_plan_id: newPlan.id,
            room_type: rt.name,
            weekday_rate: price.weekday_rate,
            weekend_rate: price.weekend_rate,
            min_stay: minStay,
          });

        if (priceError) throw priceError;
      }

      toast.success('Rate plans created for all room types');
      onOpenChange(false);
      onSave();
    } catch (error) {
      console.error('Error creating bulk rate plans:', error);
      toast.error('Failed to create rate plans');
    } finally {
      setSaving(false);
    }
  };

  const hasAnyPrice = Object.values(prices).some(p => p.weekday_rate > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Rate Plan for All Room Types</DialogTitle>
          <DialogDescription>
            Creates a separate rate plan for each room type in one action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plan Name Prefix</Label>
              <Input value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} placeholder="e.g., Standard Rate" />
              <p className="text-xs text-muted-foreground">Each plan will be named "{namePrefix} - [Room Type]"</p>
            </div>
            <div className="space-y-2">
              <Label>Min Stay (nights)</Label>
              <Input type="number" min={1} value={minStay} onChange={(e) => setMinStay(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="bulkAutoCalc" checked={autoCalculateWeekend} onCheckedChange={(c) => setAutoCalculateWeekend(!!c)} />
            <Label htmlFor="bulkAutoCalc" className="text-sm font-normal cursor-pointer">Auto-calculate weekend rate (+10%)</Label>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Room Type</TableHead>
                  <TableHead className="w-32">Weekday ($)</TableHead>
                  <TableHead className="w-32">Weekend ($)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomTypes.map(rt => (
                  <TableRow key={rt.name}>
                    <TableCell className="font-medium">{rt.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={prices[rt.name]?.weekday_rate || ''}
                        onChange={(e) => handleWeekdayChange(rt.name, Number(e.target.value))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={prices[rt.name]?.weekend_rate || ''}
                        onChange={(e) => setPrices(prev => ({ ...prev, [rt.name]: { ...prev[rt.name], weekend_rate: Number(e.target.value) } }))}
                        disabled={autoCalculateWeekend}
                        className={cn(autoCalculateWeekend && 'bg-muted')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!namePrefix.trim() || !hasAnyPrice || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create {roomTypes.length} Rate Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

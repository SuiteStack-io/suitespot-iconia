import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { calculateWeekendRate, calculateOffPeakRate } from '@/lib/rateResolver';
import { useProperty } from '@/lib/propertyContext';

interface Unit {
  id: string;
  unit_number: string | null;
  booking_com_name: string | null;
}

interface RatePlanPrice {
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  off_peak_rate?: number | null;
  min_stay: number;
  unit_id?: string | null;
}

interface RatePlan {
  id?: string;
  name: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
  booking_com_id?: string | null;
  room_type?: string | null;
}

interface RoomPriceState {
  weekday_rate: number;
  weekend_rate: number;
  isOverride?: boolean;
}

interface RatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratePlan: RatePlan | null;
  existingPrices: RatePlanPrice[];
  roomType: string;
  units: Unit[];
  onSave: (ratePlan: Omit<RatePlan, 'id'>, prices: RatePlanPrice[]) => void;
  isEditing: boolean;
}

export function RatePlanDialog({
  open,
  onOpenChange,
  ratePlan,
  existingPrices,
  roomType,
  units,
  onSave,
  isEditing,
}: RatePlanDialogProps) {
  const { activeProperty } = useProperty();
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekendDays = (activeProperty as any)?.weekend_days ?? [4, 5];
  const offPeakDays = (activeProperty as any)?.off_peak_days ?? [];

  const [name, setName] = useState('');
  const [bookingComId, setBookingComId] = useState('');
  const [validityType, setValidityType] = useState<'always' | 'dateRange'>('always');
  const [validFrom, setValidFrom] = useState<Date | undefined>();
  const [validTo, setValidTo] = useState<Date | undefined>();
  const [autoCalculateWeekend, setAutoCalculateWeekend] = useState(true);
  const [autoCalculateOffPeak, setAutoCalculateOffPeak] = useState(false);
  
  // Single rate for this room type
  const [weekdayRate, setWeekdayRate] = useState(0);
  const [weekendRate, setWeekendRate] = useState(0);
  const [offPeakRate, setOffPeakRate] = useState(0);
  
  // Unit-level overrides
  const [roomRates, setRoomRates] = useState<Record<string, RoomPriceState>>({});
  const [showUnitOverrides, setShowUnitOverrides] = useState(false);

  useEffect(() => {
    if (open) {
      if (ratePlan) {
        setName(ratePlan.name);
        setBookingComId(ratePlan.booking_com_id || '');
        setValidityType(ratePlan.is_default || (!ratePlan.valid_from && !ratePlan.valid_to) ? 'always' : 'dateRange');
        setValidFrom(ratePlan.valid_from ? new Date(ratePlan.valid_from) : undefined);
        setValidTo(ratePlan.valid_to ? new Date(ratePlan.valid_to) : undefined);
        
        const typePrice = existingPrices.find(p => !p.unit_id);
        if (typePrice) {
          setWeekdayRate(typePrice.weekday_rate);
          setWeekendRate(typePrice.weekend_rate);
          setOffPeakRate((typePrice as any).off_peak_rate ?? 0);
        }
        
        const roomPriceMap: Record<string, RoomPriceState> = {};
        existingPrices.filter(p => p.unit_id).forEach(p => {
          roomPriceMap[p.unit_id!] = {
            weekday_rate: p.weekday_rate,
            weekend_rate: p.weekend_rate,
            isOverride: true,
          };
        });
        setRoomRates(roomPriceMap);
        setShowUnitOverrides(Object.keys(roomPriceMap).length > 0);
      } else {
        setName('');
        setBookingComId('');
        setValidityType('dateRange');
        setValidFrom(undefined);
        setValidTo(undefined);
        setWeekdayRate(0);
        setWeekendRate(0);
        setOffPeakRate(0);
        setRoomRates({});
        setShowUnitOverrides(false);
      }
      setAutoCalculateWeekend(true);
      setAutoCalculateOffPeak(false);
    }
  }, [open, ratePlan, existingPrices]);

  const handleWeekdayChange = (value: number) => {
    setWeekdayRate(value);
    if (autoCalculateWeekend) {
      setWeekendRate(calculateWeekendRate(value));
    }
    if (autoCalculateOffPeak) {
      setOffPeakRate(calculateOffPeakRate(value));
    }
  };

  const handleAutoCalculateChange = (checked: boolean) => {
    setAutoCalculateWeekend(checked);
    if (checked) {
      setWeekendRate(calculateWeekendRate(weekdayRate));
      setRoomRates(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(unitId => {
          if (updated[unitId].isOverride) {
            updated[unitId] = { ...updated[unitId], weekend_rate: calculateWeekendRate(updated[unitId].weekday_rate) };
          }
        });
        return updated;
      });
    }
  };

  const handleRoomRateChange = (unitId: string, field: 'weekday_rate' | 'weekend_rate', value: number) => {
    setRoomRates(prev => {
      const existing = prev[unitId] || { weekday_rate: weekdayRate, weekend_rate: weekendRate, isOverride: false };
      let updated = { ...existing, [field]: value, isOverride: true };
      if (field === 'weekday_rate' && autoCalculateWeekend) {
        updated.weekend_rate = calculateWeekendRate(value);
      }
      return { ...prev, [unitId]: updated };
    });
  };

  const resetRoomRate = (unitId: string) => {
    setRoomRates(prev => {
      const updated = { ...prev };
      delete updated[unitId];
      return updated;
    });
  };

  const handleSave = () => {
    const ratePlanData: Omit<RatePlan, 'id'> = {
      name,
      is_default: validityType === 'always' && !isEditing,
      valid_from: validityType === 'dateRange' && validFrom ? format(validFrom, 'yyyy-MM-dd') : null,
      valid_to: validityType === 'dateRange' && validTo ? format(validTo, 'yyyy-MM-dd') : null,
      is_active: true,
      priority: ratePlan?.priority || 0,
      booking_com_id: bookingComId || null,
      room_type: roomType,
    };

    const pricesArray: RatePlanPrice[] = [];

    // Room-type-level price
    if (weekdayRate > 0) {
      pricesArray.push({
        room_type: roomType,
        weekday_rate: weekdayRate,
        weekend_rate: weekendRate,
        off_peak_rate: offPeakRate > 0 ? offPeakRate : null,
        min_stay: 1,
        unit_id: null,
      });
    }

    // Unit overrides
    Object.entries(roomRates).forEach(([unitId, p]) => {
      if (p.isOverride && p.weekday_rate > 0) {
        pricesArray.push({
          room_type: roomType,
          weekday_rate: p.weekday_rate,
          weekend_rate: p.weekend_rate,
          min_stay: 1,
          unit_id: unitId,
        });
      }
    });

    onSave(ratePlanData, pricesArray);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rate Plan' : 'Create Rate Plan'}</DialogTitle>
          <DialogDescription>
            {roomType ? `Rate plan for ${roomType}` : 'Configure rate plan details.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Plan Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Standard Rate" />
          </div>

          <div className="space-y-3">
            <Label>Validity Period</Label>
            <RadioGroup value={validityType} onValueChange={(v: 'always' | 'dateRange') => setValidityType(v)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="always" id="always" />
                <Label htmlFor="always" className="font-normal cursor-pointer">Always active (default rate)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dateRange" id="dateRange" />
                <Label htmlFor="dateRange" className="font-normal cursor-pointer">Date range</Label>
              </div>
            </RadioGroup>

            {validityType === 'dateRange' && (
              <div className="flex gap-4 mt-3">
                <div className="space-y-2 flex-1">
                  <Label>From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !validFrom && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validFrom ? format(validFrom, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={validFrom} onSelect={setValidFrom} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 flex-1">
                  <Label>To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !validTo && 'text-muted-foreground')}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validTo ? format(validTo, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={validTo} onSelect={setValidTo} disabled={(date) => validFrom ? date < validFrom : false} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Rates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Pricing</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="autoCalc" checked={autoCalculateWeekend} onCheckedChange={handleAutoCalculateChange} />
                  <Label htmlFor="autoCalc" className="text-sm font-normal cursor-pointer">Auto weekend (+10%)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="autoOffPeak" checked={autoCalculateOffPeak} onCheckedChange={(checked) => {
                    setAutoCalculateOffPeak(!!checked);
                    if (checked) setOffPeakRate(calculateOffPeakRate(weekdayRate));
                  }} />
                  <Label htmlFor="autoOffPeak" className="text-sm font-normal cursor-pointer">Auto off-peak (-15%)</Label>
                </div>
              </div>
            </div>

            <div className="grid gap-3 grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Weekday ($)</Label>
                <Input type="number" min="0" value={weekdayRate || ''} onChange={(e) => handleWeekdayChange(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Weekend ($)</Label>
                <Input type="number" min="0" value={weekendRate || ''} onChange={(e) => setWeekendRate(Number(e.target.value))} disabled={autoCalculateWeekend} className={cn(autoCalculateWeekend && 'bg-muted')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Off-Peak ($)</Label>
                <Input type="number" min="0" value={offPeakRate || ''} onChange={(e) => setOffPeakRate(Number(e.target.value))} disabled={autoCalculateOffPeak} className={cn(autoCalculateOffPeak && 'bg-muted')} />
              </div>
            </div>

            {(weekendDays.length > 0 || offPeakDays.length > 0) && (
              <p className="text-[11px] text-muted-foreground">
                Days based on Property Pricing Rules: Weekend: {weekendDays.map((d: number) => DAY_NAMES[d]).join(', ')}
                {offPeakDays.length > 0 && ` · Off-Peak: ${offPeakDays.map((d: number) => DAY_NAMES[d]).join(', ')}`}
              </p>
            )}
          </div>

          {/* Unit Overrides */}
          {units.length > 1 && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="showOverrides" checked={showUnitOverrides} onCheckedChange={(c) => setShowUnitOverrides(!!c)} />
                <Label htmlFor="showOverrides" className="text-sm font-normal cursor-pointer">Set different prices per room</Label>
              </div>

              {showUnitOverrides && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Room</TableHead>
                        <TableHead className="w-28">Weekday ($)</TableHead>
                        <TableHead className="w-28">Weekend ($)</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.sort((a, b) => (a.unit_number || '').localeCompare(b.unit_number || '')).map(unit => {
                        const override = roomRates[unit.id];
                        const hasOverride = override?.isOverride;
                        const effective = hasOverride ? override : { weekday_rate: weekdayRate, weekend_rate: weekendRate };

                        return (
                          <TableRow key={unit.id} className={cn(hasOverride && 'bg-muted/10')}>
                            <TableCell className="font-medium text-sm">
                              Room {unit.unit_number}
                              {hasOverride && <span className="ml-1 text-xs text-primary">(custom)</span>}
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" value={effective.weekday_rate || ''} onChange={(e) => handleRoomRateChange(unit.id, 'weekday_rate', Number(e.target.value))} className="w-full" />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="0" value={effective.weekend_rate || ''} onChange={(e) => handleRoomRateChange(unit.id, 'weekend_rate', Number(e.target.value))} disabled={autoCalculateWeekend} className={cn('w-full', autoCalculateWeekend && 'bg-muted')} />
                            </TableCell>
                            <TableCell>
                              {hasOverride && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetRoomRate(unit.id)} title="Reset">
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || weekdayRate <= 0}>{isEditing ? 'Confirm' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

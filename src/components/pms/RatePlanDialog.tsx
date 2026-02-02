import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
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
import { calculateWeekendRate } from '@/lib/rateResolver';

interface RoomType {
  name: string;
}

interface RatePlanPrice {
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
}

interface RatePlan {
  id?: string;
  name: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
}

interface RatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratePlan: RatePlan | null;
  existingPrices: RatePlanPrice[];
  roomTypes: RoomType[];
  onSave: (ratePlan: Omit<RatePlan, 'id'>, prices: RatePlanPrice[]) => void;
  isEditing: boolean;
}

export function RatePlanDialog({
  open,
  onOpenChange,
  ratePlan,
  existingPrices,
  roomTypes,
  onSave,
  isEditing,
}: RatePlanDialogProps) {
  const [name, setName] = useState('');
  const [validityType, setValidityType] = useState<'always' | 'dateRange'>('always');
  const [validFrom, setValidFrom] = useState<Date | undefined>();
  const [validTo, setValidTo] = useState<Date | undefined>();
  const [autoCalculateWeekend, setAutoCalculateWeekend] = useState(true);
  const [prices, setPrices] = useState<Record<string, RatePlanPrice>>({});

  // Initialize form when dialog opens or ratePlan changes
  useEffect(() => {
    if (open) {
      if (ratePlan) {
        setName(ratePlan.name);
        setValidityType(ratePlan.is_default || (!ratePlan.valid_from && !ratePlan.valid_to) ? 'always' : 'dateRange');
        setValidFrom(ratePlan.valid_from ? new Date(ratePlan.valid_from) : undefined);
        setValidTo(ratePlan.valid_to ? new Date(ratePlan.valid_to) : undefined);
        
        // Set existing prices
        const priceMap: Record<string, RatePlanPrice> = {};
        existingPrices.forEach(p => {
          priceMap[p.room_type] = p;
        });
        setPrices(priceMap);
      } else {
        // New rate plan - reset form
        setName('');
        setValidityType('dateRange');
        setValidFrom(undefined);
        setValidTo(undefined);
        
        // Initialize prices with empty values for all room types
        const priceMap: Record<string, RatePlanPrice> = {};
        roomTypes.forEach(rt => {
          priceMap[rt.name] = {
            room_type: rt.name,
            weekday_rate: 0,
            weekend_rate: 0,
            min_stay: 1,
          };
        });
        setPrices(priceMap);
      }
      setAutoCalculateWeekend(true);
    }
  }, [open, ratePlan, existingPrices, roomTypes]);

  const handleWeekdayRateChange = (roomType: string, value: number) => {
    setPrices(prev => {
      const updated = { ...prev };
      updated[roomType] = {
        ...updated[roomType],
        weekday_rate: value,
        weekend_rate: autoCalculateWeekend ? calculateWeekendRate(value) : updated[roomType].weekend_rate,
      };
      return updated;
    });
  };

  const handleWeekendRateChange = (roomType: string, value: number) => {
    setPrices(prev => ({
      ...prev,
      [roomType]: {
        ...prev[roomType],
        weekend_rate: value,
      },
    }));
  };

  const handleMinStayChange = (roomType: string, value: number) => {
    setPrices(prev => ({
      ...prev,
      [roomType]: {
        ...prev[roomType],
        min_stay: value,
      },
    }));
  };

  const handleAutoCalculateChange = (checked: boolean) => {
    setAutoCalculateWeekend(checked);
    if (checked) {
      // Recalculate all weekend rates
      setPrices(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(roomType => {
          updated[roomType] = {
            ...updated[roomType],
            weekend_rate: calculateWeekendRate(updated[roomType].weekday_rate),
          };
        });
        return updated;
      });
    }
  };

  const handleSave = () => {
    const ratePlanData: Omit<RatePlan, 'id'> = {
      name,
      is_default: validityType === 'always' && !isEditing,
      valid_from: validityType === 'dateRange' && validFrom ? format(validFrom, 'yyyy-MM-dd') : null,
      valid_to: validityType === 'dateRange' && validTo ? format(validTo, 'yyyy-MM-dd') : null,
      is_active: true,
      priority: ratePlan?.priority || 0,
    };

    const pricesArray = Object.values(prices).filter(p => p.weekday_rate > 0);
    onSave(ratePlanData, pricesArray);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Rate Plan' : 'Create Rate Plan'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the rate plan settings and room prices.'
              : 'Create a new rate plan with pricing for each room type.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Plan Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Plan Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Summer Season 2026"
            />
          </div>

          {/* Validity Period */}
          <div className="space-y-3">
            <Label>Validity Period</Label>
            <RadioGroup
              value={validityType}
              onValueChange={(value: 'always' | 'dateRange') => setValidityType(value)}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="always" id="always" disabled={isEditing && !ratePlan?.is_default} />
                <Label htmlFor="always" className="font-normal cursor-pointer">
                  Always active (default rate)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dateRange" id="dateRange" />
                <Label htmlFor="dateRange" className="font-normal cursor-pointer">
                  Date range
                </Label>
              </div>
            </RadioGroup>

            {validityType === 'dateRange' && (
              <div className="flex gap-4 mt-3">
                <div className="space-y-2 flex-1">
                  <Label>From</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !validFrom && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validFrom ? format(validFrom, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={validFrom}
                        onSelect={setValidFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 flex-1">
                  <Label>To</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !validTo && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {validTo ? format(validTo, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={validTo}
                        onSelect={setValidTo}
                        disabled={(date) => validFrom ? date < validFrom : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Room Type Rates */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Room Type Rates</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoCalculate"
                  checked={autoCalculateWeekend}
                  onCheckedChange={handleAutoCalculateChange}
                />
                <Label htmlFor="autoCalculate" className="text-sm font-normal cursor-pointer">
                  Auto-calculate weekend rate (+10%, round to $5)
                </Label>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Room Type</TableHead>
                    <TableHead className="w-32">Weekday ($)</TableHead>
                    <TableHead className="w-32">Weekend ($)</TableHead>
                    <TableHead className="w-28">Min Stay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypes.map((rt) => (
                    <TableRow key={rt.name}>
                      <TableCell className="font-medium">{rt.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={prices[rt.name]?.weekday_rate || ''}
                          onChange={(e) => handleWeekdayRateChange(rt.name, Number(e.target.value))}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={prices[rt.name]?.weekend_rate || ''}
                          onChange={(e) => handleWeekendRateChange(rt.name, Number(e.target.value))}
                          disabled={autoCalculateWeekend}
                          className={cn('w-full', autoCalculateWeekend && 'bg-muted')}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={prices[rt.name]?.min_stay || 1}
                          onChange={(e) => handleMinStayChange(rt.name, Number(e.target.value))}
                          className="w-full"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {isEditing ? 'Save Changes' : 'Create Rate Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

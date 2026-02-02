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
import { calculateWeekendRate } from '@/lib/rateResolver';

interface RoomType {
  name: string;
}

interface Unit {
  id: string;
  unit_number: string | null;
  booking_com_name: string | null;
}

interface RatePlanPrice {
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
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
}

interface RoomPriceState {
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  isOverride?: boolean;
}

interface RatePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratePlan: RatePlan | null;
  existingPrices: RatePlanPrice[];
  roomTypes: RoomType[];
  units: Unit[];
  onSave: (ratePlan: Omit<RatePlan, 'id'>, prices: RatePlanPrice[]) => void;
  isEditing: boolean;
}

export function RatePlanDialog({
  open,
  onOpenChange,
  ratePlan,
  existingPrices,
  roomTypes,
  units,
  onSave,
  isEditing,
}: RatePlanDialogProps) {
  const [name, setName] = useState('');
  const [bookingComId, setBookingComId] = useState('');
  const [validityType, setValidityType] = useState<'always' | 'dateRange'>('always');
  const [validFrom, setValidFrom] = useState<Date | undefined>();
  const [validTo, setValidTo] = useState<Date | undefined>();
  const [autoCalculateWeekend, setAutoCalculateWeekend] = useState(true);
  const [typeRates, setTypeRates] = useState<Record<string, RoomPriceState>>({});
  const [roomRates, setRoomRates] = useState<Record<string, RoomPriceState>>({});
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  // Group units by room type
  const unitsByRoomType = useMemo(() => {
    const grouped: Record<string, Unit[]> = {};
    units.forEach(unit => {
      if (unit.booking_com_name) {
        if (!grouped[unit.booking_com_name]) {
          grouped[unit.booking_com_name] = [];
        }
        grouped[unit.booking_com_name].push(unit);
      }
    });
    // Sort units by unit_number within each group
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.unit_number || '').localeCompare(b.unit_number || ''));
    });
    return grouped;
  }, [units]);

  // Initialize form when dialog opens or ratePlan changes
  useEffect(() => {
    if (open) {
      if (ratePlan) {
        setName(ratePlan.name);
        setBookingComId(ratePlan.booking_com_id || '');
        setValidityType(ratePlan.is_default || (!ratePlan.valid_from && !ratePlan.valid_to) ? 'always' : 'dateRange');
        setValidFrom(ratePlan.valid_from ? new Date(ratePlan.valid_from) : undefined);
        setValidTo(ratePlan.valid_to ? new Date(ratePlan.valid_to) : undefined);
        
        // Set existing type-level prices (unit_id is null)
        const typePriceMap: Record<string, RoomPriceState> = {};
        const roomPriceMap: Record<string, RoomPriceState> = {};
        
        existingPrices.forEach(p => {
          if (!p.unit_id) {
            typePriceMap[p.room_type] = {
              weekday_rate: p.weekday_rate,
              weekend_rate: p.weekend_rate,
              min_stay: p.min_stay,
            };
          } else {
            roomPriceMap[p.unit_id] = {
              weekday_rate: p.weekday_rate,
              weekend_rate: p.weekend_rate,
              min_stay: p.min_stay,
              isOverride: true,
            };
          }
        });
        
        setTypeRates(typePriceMap);
        setRoomRates(roomPriceMap);
      } else {
        // New rate plan - reset form
        setName('');
        setBookingComId('');
        setValidityType('dateRange');
        setValidFrom(undefined);
        setValidTo(undefined);
        
        // Initialize type prices with empty values
        const typePriceMap: Record<string, RoomPriceState> = {};
        roomTypes.forEach(rt => {
          typePriceMap[rt.name] = {
            weekday_rate: 0,
            weekend_rate: 0,
            min_stay: 1,
          };
        });
        setTypeRates(typePriceMap);
        setRoomRates({});
      }
      setAutoCalculateWeekend(true);
      setExpandedTypes(new Set());
    }
  }, [open, ratePlan, existingPrices, roomTypes]);

  const toggleExpanded = (roomType: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(roomType)) {
        next.delete(roomType);
      } else {
        next.add(roomType);
      }
      return next;
    });
  };

  const handleTypeWeekdayRateChange = (roomType: string, value: number) => {
    setTypeRates(prev => {
      const updated = { ...prev };
      updated[roomType] = {
        ...updated[roomType],
        weekday_rate: value,
        weekend_rate: autoCalculateWeekend ? calculateWeekendRate(value) : updated[roomType].weekend_rate,
      };
      return updated;
    });
  };

  const handleTypeWeekendRateChange = (roomType: string, value: number) => {
    setTypeRates(prev => ({
      ...prev,
      [roomType]: {
        ...prev[roomType],
        weekend_rate: value,
      },
    }));
  };

  const handleTypeMinStayChange = (roomType: string, value: number) => {
    setTypeRates(prev => ({
      ...prev,
      [roomType]: {
        ...prev[roomType],
        min_stay: value,
      },
    }));
  };

  const handleRoomRateChange = (unitId: string, roomType: string, field: 'weekday_rate' | 'weekend_rate' | 'min_stay', value: number) => {
    const typeRate = typeRates[roomType] || { weekday_rate: 0, weekend_rate: 0, min_stay: 1 };
    
    setRoomRates(prev => {
      const existing = prev[unitId] || { ...typeRate, isOverride: false };
      let updated = { ...existing, [field]: value, isOverride: true };
      
      // Auto-calculate weekend if enabled
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

  const getEffectiveRoomRate = (unitId: string, roomType: string): RoomPriceState => {
    if (roomRates[unitId]?.isOverride) {
      return roomRates[unitId];
    }
    return typeRates[roomType] || { weekday_rate: 0, weekend_rate: 0, min_stay: 1 };
  };

  const handleAutoCalculateChange = (checked: boolean) => {
    setAutoCalculateWeekend(checked);
    if (checked) {
      // Recalculate all weekend rates for types
      setTypeRates(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(roomType => {
          updated[roomType] = {
            ...updated[roomType],
            weekend_rate: calculateWeekendRate(updated[roomType].weekday_rate),
          };
        });
        return updated;
      });
      // Recalculate for room overrides
      setRoomRates(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(unitId => {
          if (updated[unitId].isOverride) {
            updated[unitId] = {
              ...updated[unitId],
              weekend_rate: calculateWeekendRate(updated[unitId].weekday_rate),
            };
          }
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
      booking_com_id: bookingComId || null,
    };

    // Collect type-level prices (unit_id = null)
    const pricesArray: RatePlanPrice[] = Object.entries(typeRates)
      .filter(([, p]) => p.weekday_rate > 0)
      .map(([room_type, p]) => ({
        room_type,
        weekday_rate: p.weekday_rate,
        weekend_rate: p.weekend_rate,
        min_stay: p.min_stay,
        unit_id: null,
      }));

    // Collect room-level overrides (unit_id set)
    Object.entries(roomRates).forEach(([unitId, p]) => {
      if (p.isOverride && p.weekday_rate > 0) {
        const unit = units.find(u => u.id === unitId);
        if (unit?.booking_com_name) {
          pricesArray.push({
            room_type: unit.booking_com_name,
            weekday_rate: p.weekday_rate,
            weekend_rate: p.weekend_rate,
            min_stay: p.min_stay,
            unit_id: unitId,
          });
        }
      }
    });

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

          {/* Booking.com ID */}
          <div className="space-y-2">
            <Label htmlFor="bookingComId">Booking.com ID</Label>
            <Input
              id="bookingComId"
              value={bookingComId}
              onChange={(e) => setBookingComId(e.target.value)}
              placeholder="e.g., 59882860"
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for Booking.com integration
            </p>
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
                    <TableHead className="w-[200px]">Room Type</TableHead>
                    <TableHead className="w-32">Weekday ($)</TableHead>
                    <TableHead className="w-32">Weekend ($)</TableHead>
                    <TableHead className="w-28">Min Stay</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypes.map((rt) => {
                    const isExpanded = expandedTypes.has(rt.name);
                    const unitsInType = unitsByRoomType[rt.name] || [];
                    const hasUnits = unitsInType.length > 0;
                    
                    return (
                      <>
                        {/* Room Type Row */}
                        <TableRow 
                          key={rt.name} 
                          className={cn(
                            hasUnits && 'cursor-pointer hover:bg-muted/30',
                            isExpanded && 'bg-muted/20'
                          )}
                        >
                          <TableCell 
                            className="font-medium"
                            onClick={() => hasUnits && toggleExpanded(rt.name)}
                          >
                            <div className="flex items-center gap-2">
                              {hasUnits && (
                                isExpanded 
                                  ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              {rt.name}
                              {hasUnits && (
                                <span className="text-xs text-muted-foreground">({unitsInType.length})</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={typeRates[rt.name]?.weekday_rate || ''}
                              onChange={(e) => handleTypeWeekdayRateChange(rt.name, Number(e.target.value))}
                              className="w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={typeRates[rt.name]?.weekend_rate || ''}
                              onChange={(e) => handleTypeWeekendRateChange(rt.name, Number(e.target.value))}
                              disabled={autoCalculateWeekend}
                              className={cn('w-full', autoCalculateWeekend && 'bg-muted')}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={typeRates[rt.name]?.min_stay || 1}
                              onChange={(e) => handleTypeMinStayChange(rt.name, Number(e.target.value))}
                              className="w-full"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>

                        {/* Individual Room Rows (when expanded) */}
                        {isExpanded && unitsInType.map((unit) => {
                          const effectiveRate = getEffectiveRoomRate(unit.id, rt.name);
                          const hasOverride = roomRates[unit.id]?.isOverride;
                          
                          return (
                            <TableRow 
                              key={unit.id} 
                              className="bg-muted/5"
                            >
                              <TableCell className="pl-10">
                                <span className={cn(
                                  'text-sm',
                                  hasOverride ? 'font-medium' : 'text-muted-foreground'
                                )}>
                                  └ Room {unit.unit_number}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={effectiveRate.weekday_rate || ''}
                                  onChange={(e) => handleRoomRateChange(unit.id, rt.name, 'weekday_rate', Number(e.target.value))}
                                  className={cn(
                                    'w-full',
                                    !hasOverride && 'text-muted-foreground'
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  value={effectiveRate.weekend_rate || ''}
                                  onChange={(e) => handleRoomRateChange(unit.id, rt.name, 'weekend_rate', Number(e.target.value))}
                                  disabled={autoCalculateWeekend}
                                  className={cn(
                                    'w-full',
                                    autoCalculateWeekend && 'bg-muted',
                                    !hasOverride && 'text-muted-foreground'
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  value={effectiveRate.min_stay || 1}
                                  onChange={(e) => handleRoomRateChange(unit.id, rt.name, 'min_stay', Number(e.target.value))}
                                  className={cn(
                                    'w-full',
                                    !hasOverride && 'text-muted-foreground'
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                {hasOverride && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => resetRoomRate(unit.id)}
                                    title="Reset to room type rate"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    );
                  })}
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

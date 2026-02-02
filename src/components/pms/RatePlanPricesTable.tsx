import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  unit_id?: string | null;
}

interface Unit {
  id: string;
  unit_number: string | null;
  booking_com_name: string | null;
}

interface RatePlanPricesTableProps {
  prices: RatePlanPrice[];
  units: Unit[];
}

export function RatePlanPricesTable({ prices, units }: RatePlanPricesTableProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString()}`;
  };

  // Separate type-level prices from room-level overrides
  const { typePrices, roomPrices } = useMemo(() => {
    const typeLevel: Record<string, RatePlanPrice> = {};
    const roomLevel: Record<string, RatePlanPrice> = {};

    prices.forEach(price => {
      if (!price.unit_id) {
        typeLevel[price.room_type] = price;
      } else {
        roomLevel[price.unit_id] = price;
      }
    });

    return { typePrices: typeLevel, roomPrices: roomLevel };
  }, [prices]);

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

  // Get room types that have prices defined
  const roomTypesWithPrices = Object.keys(typePrices);

  if (roomTypesWithPrices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No room types configured for this rate plan.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30">
          <TableHead className="font-medium">Room Type</TableHead>
          <TableHead className="font-medium text-right">Weekday Rate</TableHead>
          <TableHead className="font-medium text-right">Weekend Rate</TableHead>
          <TableHead className="font-medium text-right">Min Stay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roomTypesWithPrices.map((roomType) => {
          const typePrice = typePrices[roomType];
          const unitsInType = unitsByRoomType[roomType] || [];
          const hasUnits = unitsInType.length > 0;
          const isExpanded = expandedTypes.has(roomType);
          
          // Count rooms with overrides
          const overrideCount = unitsInType.filter(u => roomPrices[u.id]).length;

          return (
            <>
              {/* Room Type Row */}
              <TableRow 
                key={typePrice.id}
                className={cn(
                  hasUnits && 'cursor-pointer hover:bg-muted/20',
                  isExpanded && 'bg-muted/10'
                )}
                onClick={() => hasUnits && toggleExpanded(roomType)}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {hasUnits && (
                      isExpanded 
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    {roomType}
                    {hasUnits && (
                      <span className="text-xs text-muted-foreground">
                        ({unitsInType.length})
                        {overrideCount > 0 && (
                          <span className="ml-1 text-primary">• {overrideCount} custom</span>
                        )}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(typePrice.weekday_rate)}</TableCell>
                <TableCell className="text-right">{formatCurrency(typePrice.weekend_rate)}</TableCell>
                <TableCell className="text-right">{typePrice.min_stay} night{typePrice.min_stay !== 1 ? 's' : ''}</TableCell>
              </TableRow>

              {/* Individual Room Rows (when expanded) */}
              {isExpanded && unitsInType.map((unit) => {
                const roomPrice = roomPrices[unit.id];
                const effectivePrice = roomPrice || typePrice;
                const hasOverride = !!roomPrice;

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
                        {hasOverride && (
                          <span className="ml-2 text-xs text-primary">(custom)</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className={cn(
                      'text-right text-sm',
                      !hasOverride && 'text-muted-foreground'
                    )}>
                      {formatCurrency(effectivePrice.weekday_rate)}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right text-sm',
                      !hasOverride && 'text-muted-foreground'
                    )}>
                      {formatCurrency(effectivePrice.weekend_rate)}
                    </TableCell>
                    <TableCell className={cn(
                      'text-right text-sm',
                      !hasOverride && 'text-muted-foreground'
                    )}>
                      {effectivePrice.min_stay} night{effectivePrice.min_stay !== 1 ? 's' : ''}
                    </TableCell>
                  </TableRow>
                );
              })}
            </>
          );
        })}
      </TableBody>
    </Table>
  );
}

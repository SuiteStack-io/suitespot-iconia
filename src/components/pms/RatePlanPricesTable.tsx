import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
}

interface RatePlanPricesTableProps {
  prices: RatePlanPrice[];
}

export function RatePlanPricesTable({ prices }: RatePlanPricesTableProps) {
  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString()}`;
  };

  if (prices.length === 0) {
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
        {prices.map((price) => (
          <TableRow key={price.id}>
            <TableCell className="font-medium">{price.room_type}</TableCell>
            <TableCell className="text-right">{formatCurrency(price.weekday_rate)}</TableCell>
            <TableCell className="text-right">{formatCurrency(price.weekend_rate)}</TableCell>
            <TableCell className="text-right">{price.min_stay} night{price.min_stay !== 1 ? 's' : ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

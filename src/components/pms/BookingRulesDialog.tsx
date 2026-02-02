import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BookingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  advanceBookingDays: number;
  onChange: (days: number) => void;
}

export const BookingRulesDialog = ({
  open,
  onOpenChange,
  advanceBookingDays,
  onChange,
}: BookingRulesDialogProps) => {
  const [localDays, setLocalDays] = useState<string>(
    advanceBookingDays.toString()
  );

  useEffect(() => {
    setLocalDays(advanceBookingDays.toString());
  }, [advanceBookingDays, open]);

  const handleSave = () => {
    onChange(parseInt(localDays) || 0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Booking Rules</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="advance-days">
              Minimum days before check-in (advance booking window)
            </Label>
            <Input
              id="advance-days"
              type="number"
              min="0"
              max="365"
              value={localDays}
              onChange={(e) => setLocalDays(e.target.value)}
              placeholder="0"
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 for same-day bookings. Set to 1 to require at least 1 day
              before check-in.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const getBookingRulesLabel = (days: number): string => {
  if (days === 0) return 'Same-day bookings allowed';
  if (days === 1) return '1 day or more before check-in';
  return `${days} days or more before check-in`;
};

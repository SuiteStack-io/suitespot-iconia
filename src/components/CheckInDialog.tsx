import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreditCard } from 'lucide-react';

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  units: { name: string; booking_com_name: string | null; unit_number: string | null } | null;
}

interface CheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onConfirm: (accessCards: number) => void;
  loading: boolean;
}

export const CheckInDialog = ({
  open,
  onOpenChange,
  reservation,
  onConfirm,
  loading,
}: CheckInDialogProps) => {
  const [accessCards, setAccessCards] = useState<string>('2');

  const handleConfirm = () => {
    onConfirm(parseInt(accessCards, 10));
  };

  if (!reservation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Check In Guest
          </DialogTitle>
          <DialogDescription>
            Confirm guest check-in and record access cards issued.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            {reservation.units?.unit_number && (
              <p className="text-lg font-bold text-primary">
                Room #{reservation.units.unit_number}
              </p>
            )}
            <p className="font-medium">{reservation.guest_names[0]}</p>
            {(reservation.units?.booking_com_name || reservation.units?.name) && (
              <p className="text-sm text-muted-foreground">
                {reservation.units?.booking_com_name || reservation.units?.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-cards">
              How many access cards did the guest receive?
            </Label>
            <Select value={accessCards} onValueChange={setAccessCards}>
              <SelectTrigger id="access-cards">
                <SelectValue placeholder="Select number of cards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 cards</SelectItem>
                <SelectItem value="3">3 cards</SelectItem>
                <SelectItem value="4">4 cards</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Checking In...' : 'Confirm Check In'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, Info } from 'lucide-react';

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  access_cards_given: number | null;
  units: { name: string; booking_com_name: string | null; unit_number: string | null } | null;
}

interface CheckOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: Reservation | null;
  onConfirm: () => void;
  loading: boolean;
}

export const CheckOutDialog = ({
  open,
  onOpenChange,
  reservation,
  onConfirm,
  loading,
}: CheckOutDialogProps) => {
  const [cardsReceived, setCardsReceived] = useState(false);

  // Reset checkbox when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setCardsReceived(false);
    }
    onOpenChange(isOpen);
  };

  if (!reservation) return null;

  const cardCount = reservation.access_cards_given ?? 2;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Check Out Guest
          </DialogTitle>
          <DialogDescription>
            Confirm guest check-out and access card return.
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

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              This guest received <strong>{cardCount} access cards</strong> at check-in.
            </AlertDescription>
          </Alert>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="cards-received"
              checked={cardsReceived}
              onCheckedChange={(checked) => setCardsReceived(checked === true)}
            />
            <Label
              htmlFor="cards-received"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I confirm that I have received all {cardCount} access cards from the guest
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading || !cardsReceived}
          >
            {loading ? 'Checking Out...' : 'Confirm Check Out'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

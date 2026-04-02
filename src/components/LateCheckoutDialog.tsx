import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLateCheckout } from '@/hooks/useLateCheckout';

const LATE_CHECKOUT_TIMES = [
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const TIME_LABELS: Record<string, string> = {
  '13:00': '1:00 PM',
  '14:00': '2:00 PM',
  '15:00': '3:00 PM',
  '16:00': '4:00 PM',
  '17:00': '5:00 PM',
  '18:00': '6:00 PM',
  '19:00': '7:00 PM',
  '20:00': '8:00 PM',
};

interface LateCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'apply' | 'remove';
  reservationId: string;
  unitId: string | null;
  unitName: string;
  checkoutDate: string;
  onSuccess: () => void;
}

export const LateCheckoutDialog = ({
  open,
  onOpenChange,
  mode,
  reservationId,
  unitId,
  unitName,
  checkoutDate,
  onSuccess,
}: LateCheckoutDialogProps) => {
  const [selectedTime, setSelectedTime] = useState<string>('14:00');
  const { toast } = useToast();
  const { applyLateCheckout, removeLateCheckout, loading } = useLateCheckout({
    reservationId,
    unitId,
    unitName,
    checkoutDate,
  });

  const formattedDate = (() => {
    try {
      return format(new Date(checkoutDate + 'T00:00:00'), 'MMMM d, yyyy');
    } catch {
      return checkoutDate;
    }
  })();

  const handleSave = async () => {
    if (mode === 'apply') {
      const timeLabel = TIME_LABELS[selectedTime] || selectedTime;
      const result = await applyLateCheckout(timeLabel);
      if (result.success) {
        toast({
          title: 'Late checkout set',
          description: `Late checkout set to ${timeLabel}. ${unitName} blocked for ${formattedDate}. OTA availability updated.`,
        });
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    } else {
      const result = await removeLateCheckout();
      if (result.success) {
        toast({
          title: 'Late checkout removed',
          description: `Late checkout removed. ${unitName} availability restored.`,
        });
        onOpenChange(false);
        onSuccess();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'apply' ? 'Late Checkout' : 'Remove Late Checkout'}</DialogTitle>
          <DialogDescription>
            {mode === 'apply'
              ? 'Set a late checkout time for this reservation.'
              : 'Remove the late checkout and restore availability.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'apply' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Late Checkout Time</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LATE_CHECKOUT_TIMES.map((time) => (
                      <SelectItem key={time} value={time}>
                        {TIME_LABELS[time]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-muted-foreground">
                This will block <span className="font-medium">{unitName}</span> on{' '}
                <span className="font-medium">{formattedDate}</span> so no new check-ins can be made that day.
              </p>

              <Alert variant="default" className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 text-xs">
                  The availability calendar on all connected OTAs (Booking.com, Airbnb, etc.) will be updated automatically.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This will unblock <span className="font-medium">{unitName}</span> on{' '}
                <span className="font-medium">{formattedDate}</span> and restore availability on all connected OTAs.
              </p>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Discard Changes
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

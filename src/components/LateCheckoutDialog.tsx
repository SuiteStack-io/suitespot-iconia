import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLateCheckout } from '@/hooks/useLateCheckout';
import { usePropertySafe } from '@/lib/propertyContext';

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
  // New props for consolidated flow
  guestName?: string;
  bookingReference?: string;
  currency?: string;
  currentUserName?: string;
  fullReservation?: any;
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
  guestName,
  bookingReference,
  currency = 'USD',
  currentUserName,
  fullReservation,
}: LateCheckoutDialogProps) => {
  const [selectedTime, setSelectedTime] = useState<string>('14:00');
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [feeAmount, setFeeAmount] = useState<string>('50');
  const { toast } = useToast();
  const propertyCtx = usePropertySafe();
  const activeProperty = propertyCtx?.activeProperty;
  const vatRate = activeProperty?.vat_rate ?? 0;
  const vatDivisor = 1 + vatRate / 100;
  const { applyLateCheckout, removeLateCheckout, loading } = useLateCheckout({
    reservationId,
    unitId,
    unitName,
    checkoutDate,
    vatRate,
  });

  const formattedDate = (() => {
    try {
      return format(new Date(checkoutDate + 'T00:00:00'), 'MMMM d, yyyy');
    } catch {
      return checkoutDate;
    }
  })();

  const fee = parseFloat(feeAmount) || 0;
  const feeBase = fee / vatDivisor;
  const feeVAT = fee - feeBase;

  const handleSave = async () => {
    if (mode === 'apply') {
      const timeLabel = TIME_LABELS[selectedTime] || selectedTime;
      const result = await applyLateCheckout(timeLabel, {
        feeEnabled,
        feeAmount: fee,
        fullReservation,
        currentUserName,
        bookingReference,
      });
      if (result.success) {
        const feeMsg = feeEnabled && fee > 0
          ? ` ${currency} ${fee.toFixed(2)} fee added.`
          : '';
        toast({
          title: 'Late checkout set',
          description: `Late checkout set to ${timeLabel}. ${unitName} blocked for ${formattedDate}.${feeMsg}`,
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
              ? 'Set a late checkout time and optional fee for this reservation.'
              : 'Remove the late checkout and restore availability.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'apply' ? (
            <>
              {/* Time picker */}
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

              {/* Fee section */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="charge-fee"
                    checked={feeEnabled}
                    onCheckedChange={(checked) => setFeeEnabled(checked === true)}
                  />
                  <label htmlFor="charge-fee" className="text-sm font-medium cursor-pointer">
                    Charge late checkout fee
                  </label>
                </div>

                {feeEnabled && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fee Amount (incl. VAT)</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base Amount</span>
                        <span>${feeBase.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">VAT ({vatRate}%)</span>
                        <span>${feeVAT.toFixed(2)}</span>
                      </div>
                      <div className="border-t pt-1.5 flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-primary">${fee.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Attribution */}
              {feeEnabled && (currentUserName || guestName) && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Late checkout attributed to:</span>
                    <span className="font-medium">{currentUserName || 'Admin'}</span>
                  </div>
                </div>
              )}

              {/* Unit block info */}
              <p className="text-sm text-muted-foreground">
                This will block <span className="font-medium">{unitName}</span> on{' '}
                <span className="font-medium">{formattedDate}</span> so no new check-ins can be made that day.
              </p>

              <Alert variant="default" className="border-primary/20 bg-primary/5">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary/80 text-xs">
                  The availability calendar on all connected OTAs (Booking.com, Airbnb, etc.) will be updated automatically.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This will unblock <span className="font-medium">{unitName}</span> on{' '}
              <span className="font-medium">{formattedDate}</span> and restore availability on all connected OTAs.
            </p>
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

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface CancellationPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
}

const POLICY_OPTIONS = [
  {
    value: 'flexible_1_day',
    label: 'Flexible - 1 day before check-in',
    description: 'Guest can cancel up to 1 day before check-in for a full refund.',
  },
  {
    value: 'non_refundable',
    label: 'Non-refundable',
    description: 'No refund if the guest cancels.',
  },
];

export const CancellationPolicyDialog = ({
  open,
  onOpenChange,
  value,
  onChange,
}: CancellationPolicyDialogProps) => {
  const handleSave = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancellation Policy</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup value={value} onValueChange={onChange} className="space-y-4">
            {POLICY_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                <div className="grid gap-1">
                  <Label htmlFor={option.value} className="font-medium cursor-pointer">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            ))}
          </RadioGroup>
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

export const getCancellationPolicyLabel = (value: string): string => {
  const option = POLICY_OPTIONS.find((o) => o.value === value);
  return option?.label || 'Flexible - 1 day';
};

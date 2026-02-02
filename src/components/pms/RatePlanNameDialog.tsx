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

interface RatePlanNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onChange: (name: string) => void;
}

export const RatePlanNameDialog = ({
  open,
  onOpenChange,
  name,
  onChange,
}: RatePlanNameDialogProps) => {
  const [localName, setLocalName] = useState(name);

  useEffect(() => {
    setLocalName(name);
  }, [name, open]);

  const handleSave = () => {
    if (localName.trim()) {
      onChange(localName.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Plan Name</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rate-plan-name">Name</Label>
            <Input
              id="rate-plan-name"
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              placeholder="e.g., Standard Rate"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!localName.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';

export interface ValueAdd {
  id?: string;
  name: string;
  description?: string;
  price: number;
  is_per_night: boolean;
}

interface ValueAddsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  valueAdds: ValueAdd[];
  onChange: (valueAdds: ValueAdd[]) => void;
}

const SUGGESTED_VALUE_ADDS = [
  'Parking',
  'Massage',
  'Night credits',
  'Airport transfer',
  'Late checkout',
  'Early check-in',
  'Welcome basket',
];

export const ValueAddsDialog = ({
  open,
  onOpenChange,
  valueAdds,
  onChange,
}: ValueAddsDialogProps) => {
  const [localValueAdds, setLocalValueAdds] = useState<ValueAdd[]>(valueAdds);

  useEffect(() => {
    setLocalValueAdds(valueAdds);
  }, [valueAdds, open]);

  const handleAddValueAdd = () => {
    setLocalValueAdds([
      ...localValueAdds,
      { name: '', price: 0, is_per_night: false },
    ]);
  };

  const handleRemoveValueAdd = (index: number) => {
    setLocalValueAdds(localValueAdds.filter((_, i) => i !== index));
  };

  const handleUpdateValueAdd = (index: number, updates: Partial<ValueAdd>) => {
    setLocalValueAdds(
      localValueAdds.map((va, i) => (i === index ? { ...va, ...updates } : va))
    );
  };

  const handleSave = () => {
    // Filter out empty entries
    const filtered = localValueAdds.filter((va) => va.name.trim() !== '');
    onChange(filtered);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Value Adds</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {localValueAdds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No value adds configured. Add one below.
            </p>
          ) : (
            <div className="space-y-4">
              {localValueAdds.map((valueAdd, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg space-y-3 bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      Value Add #{index + 1}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveValueAdd(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    <div>
                      <Label htmlFor={`name-${index}`}>Name</Label>
                      <Input
                        id={`name-${index}`}
                        value={valueAdd.name}
                        onChange={(e) =>
                          handleUpdateValueAdd(index, { name: e.target.value })
                        }
                        placeholder="e.g., Parking"
                        list={`suggestions-${index}`}
                      />
                      <datalist id={`suggestions-${index}`}>
                        {SUGGESTED_VALUE_ADDS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`price-${index}`}>Price ($)</Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={valueAdd.price || ''}
                          onChange={(e) =>
                            handleUpdateValueAdd(index, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex items-end pb-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`per-night-${index}`}
                            checked={valueAdd.is_per_night}
                            onCheckedChange={(checked) =>
                              handleUpdateValueAdd(index, {
                                is_per_night: checked === true,
                              })
                            }
                          />
                          <Label
                            htmlFor={`per-night-${index}`}
                            className="text-sm cursor-pointer"
                          >
                            Per night
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            onClick={handleAddValueAdd}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Value Add
          </Button>
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

export const getValueAddsLabel = (valueAdds: ValueAdd[]): string => {
  if (valueAdds.length === 0) return 'No value adds';
  return valueAdds.map((va) => va.name).join(', ');
};

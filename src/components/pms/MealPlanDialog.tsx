import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';

interface MealPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealPlan: string;
  mealPlanPrice: number | null;
  onChange: (mealPlan: string, mealPlanPrice: number | null) => void;
}

const MEAL_OPTIONS = [
  { value: 'no_meals', label: 'No meals', hasPrice: false },
  { value: 'breakfast', label: 'Breakfast included', hasPrice: true },
  { value: 'half_board', label: 'Half board (breakfast + dinner)', hasPrice: true },
  { value: 'full_board', label: 'Full board (all meals)', hasPrice: true },
];

export const MealPlanDialog = ({
  open,
  onOpenChange,
  mealPlan,
  mealPlanPrice,
  onChange,
}: MealPlanDialogProps) => {
  const [localMealPlan, setLocalMealPlan] = useState(mealPlan);
  const [localPrice, setLocalPrice] = useState<string>(
    mealPlanPrice?.toString() || ''
  );

  useEffect(() => {
    setLocalMealPlan(mealPlan);
    setLocalPrice(mealPlanPrice?.toString() || '');
  }, [mealPlan, mealPlanPrice, open]);

  const showPriceInput = MEAL_OPTIONS.find((o) => o.value === localMealPlan)?.hasPrice;

  const handleSave = () => {
    const price = showPriceInput && localPrice ? parseFloat(localPrice) : null;
    onChange(localMealPlan, price);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Meal Plan</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <RadioGroup
            value={localMealPlan}
            onValueChange={setLocalMealPlan}
            className="space-y-3"
          >
            {MEAL_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center space-x-3">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {showPriceInput && (
            <div className="pt-2 space-y-2">
              <Label htmlFor="meal-price">Price per person per night ($)</Label>
              <Input
                id="meal-price"
                type="number"
                min="0"
                step="0.01"
                value={localPrice}
                onChange={(e) => setLocalPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
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

export const getMealPlanLabel = (value: string, price: number | null): string => {
  const option = MEAL_OPTIONS.find((o) => o.value === value);
  if (!option) return 'No meals';
  if (option.hasPrice && price) {
    return `${option.label} ($${price}/person/night)`;
  }
  return option.label;
};

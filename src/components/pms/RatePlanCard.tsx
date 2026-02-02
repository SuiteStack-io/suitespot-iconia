import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Pencil, Trash2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RatePlanPricesTable } from './RatePlanPricesTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
  unit_id?: string | null;
}

interface Unit {
  id: string;
  unit_number: string | null;
  booking_com_name: string | null;
}

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  valid_from: string | null;
  valid_to: string | null;
  is_active: boolean;
  priority: number;
}

interface RatePlanCardProps {
  ratePlan: RatePlan;
  prices: RatePlanPrice[];
  units: Unit[];
  onEdit: (ratePlan: RatePlan) => void;
  onDelete: (ratePlanId: string) => void;
  onToggleActive: (ratePlanId: string, isActive: boolean) => void;
  onSetDefault: (ratePlanId: string) => void;
}

export function RatePlanCard({
  ratePlan,
  prices,
  units,
  onEdit,
  onDelete,
  onToggleActive,
  onSetDefault,
}: RatePlanCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const getValidityText = (): string => {
    if (ratePlan.is_default) return 'Always active (default rate)';
    if (ratePlan.valid_from && ratePlan.valid_to) {
      return `${format(new Date(ratePlan.valid_from), 'MMM d, yyyy')} - ${format(new Date(ratePlan.valid_to), 'MMM d, yyyy')}`;
    }
    return 'No date range specified';
  };

  const handleDeleteClick = () => {
    if (ratePlan.is_default) return; // Cannot delete default rate plan
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    onDelete(ratePlan.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className={`transition-all ${!ratePlan.is_active ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 hover:bg-muted rounded-md transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{ratePlan.name}</h3>
                  {ratePlan.is_default && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Default
                    </Badge>
                  )}
                  {!ratePlan.is_active && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {getValidityText()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-muted-foreground">Active</span>
                <Switch
                  checked={ratePlan.is_active}
                  onCheckedChange={(checked) => onToggleActive(ratePlan.id, checked)}
                />
              </div>
              {!ratePlan.is_default && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSetDefault(ratePlan.id)}
                  className="text-xs"
                >
                  Set as Default
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(ratePlan)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {!ratePlan.is_default && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDeleteClick}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            <RatePlanPricesTable prices={prices} units={units} />
          </CardContent>
        )}
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{ratePlan.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

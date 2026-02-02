import { Button } from '@/components/ui/button';

interface RestrictionRowProps {
  label: string;
  value: string;
  onEdit?: () => void;
  editLabel?: string;
  disabled?: boolean;
}

export const RestrictionRow = ({
  label,
  value,
  onEdit,
  editLabel = 'Edit',
  disabled = false,
}: RestrictionRowProps) => {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0 text-center">
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={disabled || !onEdit}
        >
          {editLabel}
        </Button>
      </div>
    </div>
  );
};

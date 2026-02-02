import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface RoomApplicabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRoomTypes: string[] | null;
  availableRoomTypes: string[];
  onChange: (roomTypes: string[] | null) => void;
}

export const RoomApplicabilityDialog = ({
  open,
  onOpenChange,
  selectedRoomTypes,
  availableRoomTypes,
  onChange,
}: RoomApplicabilityDialogProps) => {
  const [localSelected, setLocalSelected] = useState<Set<string>>(
    new Set(selectedRoomTypes || [])
  );
  const [selectAll, setSelectAll] = useState(
    selectedRoomTypes === null || selectedRoomTypes.length === availableRoomTypes.length
  );

  useEffect(() => {
    const selected = selectedRoomTypes || [];
    setLocalSelected(new Set(selected));
    setSelectAll(
      selectedRoomTypes === null ||
        (selectedRoomTypes.length === availableRoomTypes.length && availableRoomTypes.length > 0)
    );
  }, [selectedRoomTypes, availableRoomTypes, open]);

  const handleToggle = (roomType: string) => {
    const newSelected = new Set(localSelected);
    if (newSelected.has(roomType)) {
      newSelected.delete(roomType);
    } else {
      newSelected.add(roomType);
    }
    setLocalSelected(newSelected);
    setSelectAll(newSelected.size === availableRoomTypes.length);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setLocalSelected(new Set(availableRoomTypes));
    } else {
      setLocalSelected(new Set());
    }
  };

  const handleSave = () => {
    if (selectAll || localSelected.size === availableRoomTypes.length) {
      onChange(null); // null means all rooms
    } else if (localSelected.size === 0) {
      onChange([]); // empty array means no rooms
    } else {
      onChange(Array.from(localSelected));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Room Applicability</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select which room types this rate plan applies to.
          </p>

          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              id="select-all"
              checked={selectAll}
              onCheckedChange={handleSelectAll}
            />
            <Label htmlFor="select-all" className="font-medium cursor-pointer">
              All room types
            </Label>
          </div>

          <div className="space-y-3">
            {availableRoomTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No room types configured.
              </p>
            ) : (
              availableRoomTypes.map((roomType) => (
                <div key={roomType} className="flex items-center space-x-2">
                  <Checkbox
                    id={roomType}
                    checked={localSelected.has(roomType)}
                    onCheckedChange={() => handleToggle(roomType)}
                    disabled={selectAll}
                  />
                  <Label
                    htmlFor={roomType}
                    className={`cursor-pointer ${selectAll ? 'text-muted-foreground' : ''}`}
                  >
                    {roomType}
                  </Label>
                </div>
              ))
            )}
          </div>
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

export const getRoomApplicabilityLabel = (
  selectedRoomTypes: string[] | null,
  totalRoomTypes: number
): string => {
  if (selectedRoomTypes === null || selectedRoomTypes.length === totalRoomTypes) {
    return 'All room types';
  }
  if (selectedRoomTypes.length === 0) {
    return 'No room types selected';
  }
  if (selectedRoomTypes.length <= 2) {
    return selectedRoomTypes.join(', ');
  }
  return `${selectedRoomTypes.slice(0, 2).join(', ')} +${selectedRoomTypes.length - 2} more`;
};

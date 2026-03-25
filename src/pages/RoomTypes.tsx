import { useState, useEffect, useMemo } from 'react';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { SlideMenu } from '@/components/SlideMenu';
import { Save, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface RoomTypeData {
  id: string;
  name: string;
  booking_com_name: string | null;
  max_guests: number | null;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
  show_on_website: boolean;
}

interface GroupedRoomType {
  displayName: string;
  unitIds: string[];
  count_of_rooms: number;
  max_guests: number;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
  show_on_website: boolean;
}

interface EditedGroupData {
  max_guests: number;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
  show_on_website: boolean;
}

const groupRoomsByType = (rooms: RoomTypeData[]): GroupedRoomType[] => {
  const groups: Record<string, GroupedRoomType> = {};

  rooms.forEach(room => {
    const displayName = room.booking_com_name || room.name;

    if (!groups[displayName]) {
      groups[displayName] = {
        displayName,
        unitIds: [room.id],
        count_of_rooms: 1,
        max_guests: room.max_guests ?? 2,
        max_children: room.max_children ?? 0,
        max_infants: room.max_infants ?? 0,
        default_occupancy: room.default_occupancy ?? 2,
        room_kind: room.room_kind ?? 'room',
        show_on_website: room.show_on_website ?? true,
      };
    } else {
      groups[displayName].unitIds.push(room.id);
      groups[displayName].count_of_rooms += 1;
    }
  });

  return Object.values(groups).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
};

export default function RoomTypes() {
  const { userRole } = useAuth();
  const propertyId = usePropertyId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editedData, setEditedData] = useState<Record<string, EditedGroupData>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch ICONIA room types
  const { data: roomTypes, isLoading } = useQuery({
    queryKey: ['room-types'],
    queryFn: async () => {
      const { data, error } = await withPropertyFilter(supabase
        .from('units')
        .select('id, name, booking_com_name, max_guests, max_children, max_infants, default_occupancy, room_kind, show_on_website')
        .or('is_private.eq.false,is_private.is.null')
        .order('name'), propertyId);

      if (error) throw error;
      return data as RoomTypeData[];
    },
  });

  // Group rooms by display name
  const groupedRoomTypes = useMemo(() => {
    if (!roomTypes) return [];
    return groupRoomsByType(roomTypes);
  }, [roomTypes]);

  // Initialize edited data when grouped room types are computed
  useEffect(() => {
    if (groupedRoomTypes.length > 0 && Object.keys(editedData).length === 0) {
      const initial: Record<string, EditedGroupData> = {};
      groupedRoomTypes.forEach(group => {
        initial[group.displayName] = {
          max_guests: group.max_guests,
          max_children: group.max_children,
          max_infants: group.max_infants,
          default_occupancy: group.default_occupancy,
          room_kind: group.room_kind,
          show_on_website: group.show_on_website,
        };
      });
      setEditedData(initial);
    }
  }, [groupedRoomTypes]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; data: EditedGroupData }[]) => {
      const promises = updates.map(({ id, data }) =>
        supabase
          .from('units')
          .update({
            max_guests: data.max_guests,
            max_children: data.max_children,
            max_infants: data.max_infants,
            default_occupancy: data.default_occupancy,
            room_kind: data.room_kind,
            show_on_website: data.show_on_website,
          })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || 'Failed to update room types');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-types'] });
      setHasChanges(false);
      toast({
        title: 'Room Types Updated',
        description: 'All changes have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFieldChange = (displayName: string, field: keyof EditedGroupData, value: number | string) => {
    setEditedData(prev => ({
      ...prev,
      [displayName]: {
        ...prev[displayName],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const updates: { id: string; data: EditedGroupData }[] = [];
    let hasValidationError = false;

    groupedRoomTypes.forEach(group => {
      const data = editedData[group.displayName];
      if (!data) return;

      if (data.max_guests < 1) {
        toast({ title: 'Validation Error', description: 'Max Guests must be at least 1', variant: 'destructive' });
        hasValidationError = true;
        return;
      }
      if (data.default_occupancy > data.max_guests) {
        toast({ title: 'Validation Error', description: 'Default Occupancy cannot exceed Max Guests', variant: 'destructive' });
        hasValidationError = true;
        return;
      }

      // Apply same values to all units in this group
      group.unitIds.forEach(unitId => {
        updates.push({ id: unitId, data });
      });
    });

    if (!hasValidationError) {
      updateMutation.mutate(updates);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <SlideMenu userRole={userRole} />
            <h1 className="text-lg font-semibold">Room Types</h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Room Title</TableHead>
                <TableHead className="w-[100px]">Room Count</TableHead>
                <TableHead className="w-[100px]">Max Guests</TableHead>
                <TableHead className="w-[110px]">Max Children</TableHead>
                <TableHead className="w-[100px]">Max Infants</TableHead>
                <TableHead className="w-[110px]">Default Occ</TableHead>
                <TableHead className="w-[120px]">Room Kind</TableHead>
                <TableHead className="w-[90px]">Website</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedRoomTypes.map((group) => (
                <TableRow key={group.displayName}>
                  <TableCell className="font-medium">
                    {group.displayName}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground px-2">{group.count_of_rooms}</span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={editedData[group.displayName]?.max_guests ?? 2}
                      onChange={(e) => handleFieldChange(group.displayName, 'max_guests', parseInt(e.target.value) || 1)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={editedData[group.displayName]?.max_children ?? 0}
                      onChange={(e) => handleFieldChange(group.displayName, 'max_children', parseInt(e.target.value) || 0)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={editedData[group.displayName]?.max_infants ?? 0}
                      onChange={(e) => handleFieldChange(group.displayName, 'max_infants', parseInt(e.target.value) || 0)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={editedData[group.displayName]?.default_occupancy ?? 2}
                      onChange={(e) => handleFieldChange(group.displayName, 'default_occupancy', parseInt(e.target.value) || 1)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={editedData[group.displayName]?.room_kind ?? 'room'}
                      onValueChange={(value) => handleFieldChange(group.displayName, 'room_kind', value)}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="dorm">Dorm</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { PanelLeft, Save, Loader2 } from 'lucide-react';

interface RoomTypeData {
  id: string;
  name: string;
  booking_com_name: string | null;
  count_of_rooms: number;
  max_guests: number | null;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
}

interface EditedRoomType {
  count_of_rooms: number;
  max_guests: number;
  max_children: number;
  max_infants: number;
  default_occupancy: number;
  room_kind: string;
}

export default function RoomTypes() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [editedData, setEditedData] = useState<Record<string, EditedRoomType>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch ICONIA room types
  const { data: roomTypes, isLoading } = useQuery({
    queryKey: ['room-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('id, name, booking_com_name, count_of_rooms, max_guests, max_children, max_infants, default_occupancy, room_kind')
        .eq('location', 'ICONIA')
        .or('is_private.eq.false,is_private.is.null')
        .order('name');
      
      if (error) throw error;
      return data as RoomTypeData[];
    },
  });

  // Initialize edited data when room types load
  useEffect(() => {
    if (roomTypes && Object.keys(editedData).length === 0) {
      const initial: Record<string, EditedRoomType> = {};
      roomTypes.forEach(room => {
        initial[room.id] = {
          count_of_rooms: room.count_of_rooms ?? 1,
          max_guests: room.max_guests ?? 2,
          max_children: room.max_children ?? 0,
          max_infants: room.max_infants ?? 0,
          default_occupancy: room.default_occupancy ?? 2,
          room_kind: room.room_kind ?? 'room',
        };
      });
      setEditedData(initial);
    }
  }, [roomTypes]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; data: EditedRoomType }[]) => {
      const promises = updates.map(({ id, data }) =>
        supabase
          .from('units')
          .update({
            count_of_rooms: data.count_of_rooms,
            max_guests: data.max_guests,
            max_children: data.max_children,
            max_infants: data.max_infants,
            default_occupancy: data.default_occupancy,
            room_kind: data.room_kind,
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

  const handleFieldChange = (id: string, field: keyof EditedRoomType, value: number | string) => {
    setEditedData(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // Validate data before saving
    const updates: { id: string; data: EditedRoomType }[] = [];
    let hasValidationError = false;

    Object.entries(editedData).forEach(([id, data]) => {
      if (data.count_of_rooms < 1) {
        toast({ title: 'Validation Error', description: 'Room Count must be at least 1', variant: 'destructive' });
        hasValidationError = true;
        return;
      }
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
      updates.push({ id, data });
    });

    if (!hasValidationError) {
      updateMutation.mutate(updates);
    }
  };

  const getDisplayName = (room: RoomTypeData) => room.booking_com_name || room.name;

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
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes?.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">
                    {getDisplayName(room)}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={editedData[room.id]?.count_of_rooms ?? 1}
                      onChange={(e) => handleFieldChange(room.id, 'count_of_rooms', parseInt(e.target.value) || 1)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={editedData[room.id]?.max_guests ?? 2}
                      onChange={(e) => handleFieldChange(room.id, 'max_guests', parseInt(e.target.value) || 1)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={editedData[room.id]?.max_children ?? 0}
                      onChange={(e) => handleFieldChange(room.id, 'max_children', parseInt(e.target.value) || 0)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={editedData[room.id]?.max_infants ?? 0}
                      onChange={(e) => handleFieldChange(room.id, 'max_infants', parseInt(e.target.value) || 0)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={editedData[room.id]?.default_occupancy ?? 2}
                      onChange={(e) => handleFieldChange(room.id, 'default_occupancy', parseInt(e.target.value) || 1)}
                      className="w-20 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={editedData[room.id]?.room_kind ?? 'room'}
                      onValueChange={(value) => handleFieldChange(room.id, 'room_kind', value)}
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

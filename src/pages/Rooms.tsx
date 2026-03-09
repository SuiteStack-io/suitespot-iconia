import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Plus, Pencil, X, Upload, Trash2, Eye, ChevronDown, Copy, Image as ImageIcon, GripVertical, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';

import { Unit } from '@/types/unit';

interface Reservation {
  id: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

const STATUS_OPTIONS = ['available', 'occupied', 'maintenance', 'reserved'];


const Rooms = () => {
  const { user, loading, userRole } = useAuth();
  const propertyId = usePropertyId();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedUnit, setEditedUnit] = useState<Partial<Unit>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isBulkEdit, setIsBulkEdit] = useState(false);
  const [bulkEditUnits, setBulkEditUnits] = useState<Record<string, Partial<Unit>>>({});
  const [newUnit, setNewUnit] = useState<Partial<Unit>>({
    name: '',
    unit_number: '',
    unit_type: '',
    unit_size: '',
    status: 'available',
    booking_com_id: '',
    booking_com_name: '',
    comments: '',
    beds: null,
    baths: null,
    max_guests: null,
    sofa_bed: false,
    price_per_night: null,
    weekend_rate: null,
    tax_percentage: 14.00,
    photos: [],
    view: null,
    count_of_rooms: 1,
    default_occupancy: 2,
  });
  const [uploadingPhotos, setUploadingPhotos] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [roomToClone, setRoomToClone] = useState<Unit | null>(null);
  const [cloneRoomNumber, setCloneRoomNumber] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Unit | null>(null);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [currentUnitPhotos, setCurrentUnitPhotos] = useState<{ id: string; photos: string[] } | null>(null);
  const [sortField, setSortField] = useState<'unit_number' | 'unit_type' | 'view' | 'booking_com_name' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSort = (field: 'unit_number' | 'unit_type' | 'view' | 'booking_com_name') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedUnits = [...units].sort((a, b) => {
    if (!sortField) return 0;
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    const comparison = aVal.toString().localeCompare(bVal.toString(), undefined, { numeric: true });
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && user && userRole && userRole !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only administrators can access room management',
      });
      navigate('/admin');
    }
  }, [user, loading, userRole, navigate, toast]);

  useEffect(() => {
    if (user) {
      fetchUnits();
      fetchReservations();
    }

    // Real-time updates for units and reservations
    const unitsChannel = supabase
      .channel('units-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
        },
        () => {
          fetchUnits();
        }
      )
      .subscribe();

    const reservationsChannel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchReservations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(unitsChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [user]);

  const fetchUnits = async () => {
    const { data, error } = await withPropertyFilter(supabase
      .from('units')
      .select('*')
      .order('name'), propertyId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch rooms',
      });
      return;
    }

    setUnits(data || []);
  };

  const fetchReservations = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await withPropertyFilter(supabase
      .from('reservations')
      .select('id, unit_id, check_in_date, check_out_date, status')
      .gte('check_in_date', today)
      .order('check_in_date'), propertyId);

    if (error) {
      console.error('Failed to fetch reservations:', error);
      return;
    }

    setReservations(data || []);
  };

  const handlePhotoUpload = async (unitId: string, files: FileList) => {
    const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB in bytes
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    // Validate file sizes
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      } else if (file.type.startsWith('image/')) {
        validFiles.push(file);
      } else {
        invalidFiles.push(`${file.name} (not an image)`);
      }
    });

    if (invalidFiles.length > 0) {
      toast({
        title: 'Some files were skipped',
        description: `Files exceeding 3MB or invalid formats: ${invalidFiles.join(', ')}`,
        variant: 'destructive',
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    setUploadingPhotos(unitId);
    setUploadProgress({ [unitId]: 0 });

    try {
      const uploadedUrls: string[] = [];
      const totalFiles = validFiles.length;

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${unitId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError, data } = await supabase.storage
          .from('assets')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('assets')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
        
        // Update progress
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress({ [unitId]: progress });
      }

      // Get current photos and append new ones
      const { data: currentUnit } = await supabase
        .from('units')
        .select('photos')
        .eq('id', unitId)
        .single();

      const currentPhotos = currentUnit?.photos || [];
      const updatedPhotos = [...currentPhotos, ...uploadedUrls];

      // Update database with new photo URLs
      const { error: updateError } = await supabase
        .from('units')
        .update({ photos: updatedPhotos })
        .eq('id', unitId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: `${validFiles.length} photo(s) uploaded successfully`,
      });

      fetchUnits();
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingPhotos(null);
      setUploadProgress({});
    }
  };

  const handleDeletePhoto = async (unitId: string, photoUrl: string) => {
    try {
      // Get current photos
      const { data: currentUnit } = await supabase
        .from('units')
        .select('photos')
        .eq('id', unitId)
        .single();

      const currentPhotos = currentUnit?.photos || [];
      const updatedPhotos = currentPhotos.filter((url: string) => url !== photoUrl);

      // Update database
      const { error: updateError } = await supabase
        .from('units')
        .update({ photos: updatedPhotos })
        .eq('id', unitId);

      if (updateError) throw updateError;

      // Delete from storage
      const fileName = photoUrl.split('/assets/')[1];
      if (fileName) {
        await supabase.storage.from('assets').remove([fileName]);
      }

      toast({
        title: 'Success',
        description: 'Photo deleted successfully',
      });

      fetchUnits();
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };


  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditedUnit(unit);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedUnit({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('units')
      .update(editedUnit)
      .eq('id', editingId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update room',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Room updated successfully',
    });

    setEditingId(null);
    setEditedUnit({});
    fetchUnits();
  };

  const handleBulkEdit = () => {
    setIsBulkEdit(true);
    const initialBulkEdit: Record<string, Partial<Unit>> = {};
    units.forEach((unit) => {
      initialBulkEdit[unit.id] = { ...unit };
    });
    setBulkEditUnits(initialBulkEdit);
  };

  const handleCancelBulkEdit = () => {
    setIsBulkEdit(false);
    setBulkEditUnits({});
  };

  const handleSaveBulkEdit = async () => {
    try {
      const updates = Object.values(bulkEditUnits).map((unit) => {
        // Only include fields that should be updated, exclude photos array and other non-updatable fields
        const {
          name,
          unit_number,
          unit_type,
          unit_size,
          status,
          booking_com_id,
          booking_com_name,
          comments,
          beds,
          baths,
          max_guests,
          sofa_bed,
          price_per_night,
          weekend_rate,
          tax_percentage,
          view
        } = unit;
        
        return supabase
          .from('units')
          .update({
            name,
            unit_number,
            unit_type,
            unit_size,
            status,
            booking_com_id,
            booking_com_name,
            comments,
            beds,
            baths,
            max_guests,
            sofa_bed,
            price_per_night,
            weekend_rate,
            tax_percentage,
            view
          })
          .eq('id', unit.id!);
      });

      const results = await Promise.all(updates);
      const errors = results.filter((result) => result.error);

      if (errors.length > 0) {
        console.error('Bulk update errors:', errors);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: `Failed to update ${errors.length} room(s). Check console for details.`,
        });
        return;
      }

      toast({
        title: 'Success',
        description: `Successfully updated ${results.length} room(s)`,
      });

      setIsBulkEdit(false);
      setBulkEditUnits({});
      fetchUnits();
    } catch (error) {
      console.error('Bulk save error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save changes',
      });
    }
  };

  const handleBulkEditChange = (unitId: string, field: keyof Unit, value: any) => {
    setBulkEditUnits((prev) => ({
      ...prev,
      [unitId]: {
        ...prev[unitId],
        [field]: value,
      },
    }));
  };

  const handleAddRoom = async () => {
    if (!newUnit.name) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Room name is required',
      });
      return;
    }

    const { error } = await supabase.from('units').insert([{
      name: newUnit.name,
      unit_number: newUnit.unit_number || null,
      unit_type: newUnit.unit_type || null,
      unit_size: newUnit.unit_size || null,
      status: newUnit.status || 'available',
      booking_com_id: newUnit.booking_com_id || null,
      booking_com_name: newUnit.booking_com_name || null,
      comments: newUnit.comments || null,
      beds: newUnit.beds || null,
      baths: newUnit.baths || null,
      max_guests: newUnit.max_guests || null,
      sofa_bed: newUnit.sofa_bed || false,
      price_per_night: newUnit.price_per_night || null,
      weekend_rate: newUnit.weekend_rate || null,
      tax_percentage: newUnit.tax_percentage || 14.00,
      property_id: propertyId || null,
      view: newUnit.view || null,
      count_of_rooms: newUnit.count_of_rooms ?? 1,
      default_occupancy: newUnit.default_occupancy ?? 2,
    }]);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to add room',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Room added successfully',
    });

    setAddDialogOpen(false);
    setNewUnit({
      name: '',
      unit_number: '',
      unit_type: '',
      unit_size: '',
      status: 'available',
      booking_com_id: '',
      booking_com_name: '',
      comments: '',
      beds: null,
      baths: null,
      max_guests: null,
      sofa_bed: false,
      price_per_night: null,
      weekend_rate: null,
      tax_percentage: 14.00,
      photos: [],
      view: null,
      count_of_rooms: 1,
      default_occupancy: 2,
    });
    fetchUnits();
  };

  const handleCloneClick = (unit: Unit) => {
    setRoomToClone(unit);
    setCloneRoomNumber('');
    setCloneDialogOpen(true);
  };

  const handleConfirmClone = async () => {
    if (!roomToClone) return;

    const newRoomNumber = cloneRoomNumber.trim();
    
    if (!newRoomNumber) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a room number',
      });
      return;
    }

    // Check if room number already exists
    const existingRoom = units.find(u => u.unit_number === newRoomNumber);
    if (existingRoom) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'A room with this number already exists',
      });
      return;
    }

    try {
      console.log('Cloning room with source data:', roomToClone);
      
      // Clone the room with all specifications except id and unit_number
      const clonedData = {
        name: roomToClone.name,
        unit_number: newRoomNumber,
        unit_type: roomToClone.unit_type,
        unit_size: roomToClone.unit_size,
        status: 'available',
        booking_com_id: null,
        booking_com_name: roomToClone.booking_com_name,
        comments: roomToClone.comments,
        beds: roomToClone.beds,
        baths: roomToClone.baths,
        max_guests: roomToClone.max_guests,
        sofa_bed: roomToClone.sofa_bed,
        price_per_night: roomToClone.price_per_night,
        weekend_rate: roomToClone.weekend_rate,
        tax_percentage: roomToClone.tax_percentage,
        photos: roomToClone.photos || [],
        view: roomToClone.view,
        property_id: propertyId || (roomToClone as any).property_id,
        count_of_rooms: roomToClone.count_of_rooms,
        default_occupancy: roomToClone.default_occupancy,
        max_children: roomToClone.max_children,
        max_infants: roomToClone.max_infants,
        room_kind: roomToClone.room_kind,
        location: roomToClone.location,
        features: roomToClone.features || [],
        min_stay: roomToClone.min_stay,
      };
      
      console.log('Inserting cloned data:', clonedData);
      
      const { error, data } = await supabase.from('units').insert([clonedData]).select();

      if (error) {
        console.error('Clone error details:', error);
        throw error;
      }

      console.log('Clone successful:', data);

      setCloneDialogOpen(false);
      setRoomToClone(null);
      setCloneRoomNumber('');

      toast({
        title: 'Success',
        description: `Room ${newRoomNumber} created successfully`,
      });

      fetchUnits();
    } catch (error: any) {
      console.error('Failed to clone room:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to clone room',
      });
    }
  };

  const handleDeleteClick = (unit: Unit) => {
    setRoomToDelete(unit);
    setDeleteDialogOpen(true);
  };

  const handleReorderPhotos = async (unitId: string, newPhotosOrder: string[]) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ photos: newPhotosOrder })
        .eq('id', unitId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Photo order updated',
      });

      fetchUnits();
      if (currentUnitPhotos?.id === unitId) {
        setCurrentUnitPhotos({ id: unitId, photos: newPhotosOrder });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !currentUnitPhotos) return;

    if (active.id !== over.id) {
      const oldIndex = currentUnitPhotos.photos.indexOf(active.id as string);
      const newIndex = currentUnitPhotos.photos.indexOf(over.id as string);

      const newOrder = arrayMove(currentUnitPhotos.photos, oldIndex, newIndex);
      setCurrentUnitPhotos({ ...currentUnitPhotos, photos: newOrder });
      handleReorderPhotos(currentUnitPhotos.id, newOrder);
    }
  };

  const handleConfirmDelete = async () => {
    if (!roomToDelete) return;

    try {
      // Check if room has any reservations
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', roomToDelete.id)
        .limit(1);

      if (resError) throw resError;

      if (reservations && reservations.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Cannot Delete',
          description: 'This room has existing reservations and cannot be deleted.',
        });
        setDeleteDialogOpen(false);
        setRoomToDelete(null);
        return;
      }

      // Delete room photos from storage
      if (roomToDelete.photos && roomToDelete.photos.length > 0) {
        const photoFilenames = roomToDelete.photos.map(url => {
          const parts = url.split('/assets/');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean);

        if (photoFilenames.length > 0) {
          await supabase.storage.from('assets').remove(photoFilenames as string[]);
        }
      }

      // Delete the room
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', roomToDelete.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Room ${roomToDelete.unit_number || roomToDelete.name} deleted successfully`,
      });

      setDeleteDialogOpen(false);
      setRoomToDelete(null);
      fetchUnits();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete room',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Rooms" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SlideMenu userRole={userRole} />
              
              {/* Mobile back button - icon only */}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="md:hidden"
                size="icon"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              {/* Desktop back button with text */}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="hidden md:flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              
              <h1 className="text-2xl font-bold">Rooms Management</h1>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                {isBulkEdit ? (
                  <>
                    <Button onClick={handleSaveBulkEdit} variant="default">
                      <Save className="h-4 w-4 mr-2" />
                      Save All
                    </Button>
                    <Button onClick={handleCancelBulkEdit} variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleBulkEdit} variant="outline">
                      <Pencil className="h-4 w-4 mr-2" />
                      Bulk Edit
                    </Button>
                    <Button onClick={() => setAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Room
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isBulkEdit && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium">
              💡 Bulk Edit Mode: The table can be scrolled horizontally to see all fields. All changes will be saved when you click "Save All".
            </p>
          </div>
        )}
        <div className="rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
          <div className="overflow-auto h-full">
            <table className="w-full caption-bottom text-sm">
              <thead className="sticky top-0 z-20 bg-muted/50 shadow-[0_1px_0_hsl(var(--border))] [&_tr]:border-b">
                <tr className="border-b hover:bg-transparent">
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground sticky left-0 z-10 bg-muted/50 w-10">#</th>
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground sticky left-[40px] z-10 bg-muted/50">Room Name</th>
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground sticky left-[200px] z-10 bg-muted/50 border-r cursor-pointer hover:text-foreground" onClick={() => handleSort('unit_number')}>
                    <div className="flex items-center gap-1">
                      Room #
                      {sortField === 'unit_number' && (
                        <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('unit_type')}>
                    <div className="flex items-center gap-1">
                      Type
                      {sortField === 'unit_type' && (
                        <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('view')}>
                    <div className="flex items-center gap-1">
                      View
                      {sortField === 'view' && (
                        <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => handleSort('booking_com_name')}>
                    <div className="flex items-center gap-1">
                      Booking.com
                      {sortField === 'booking_com_name' && (
                        <ChevronDown className={`h-3 w-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </th>
                  <th className="h-9 px-3 py-2 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Size</th>
                  <th className="h-9 px-3 py-2 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Beds</th>
                  <th className="h-9 px-3 py-2 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Baths</th>
                  <th className="h-9 px-3 py-2 text-right align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Guests</th>
                  <th className="h-9 px-3 py-2 text-center align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Sofa</th>
                  <th className="h-9 px-3 py-2 text-center align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Photos</th>
                  <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  {isAdmin && !isBulkEdit && <th className="h-9 px-3 py-2 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <TableBody>
              {sortedUnits.map((unit, index) => {
                const isEditing = isBulkEdit || editingId === unit.id;
                const currentUnit = isBulkEdit ? bulkEditUnits[unit.id] : editedUnit;
                
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="min-w-[50px] text-muted-foreground font-medium sticky left-0 z-[5] bg-background">{index + 1}</TableCell>
                    <TableCell className="min-w-[200px] sticky left-[50px] z-[5] bg-background">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[180px]"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.booking_com_name || '') : (editedUnit.booking_com_name || '')}
                          onChange={(e) => 
                            isBulkEdit 
                              ? handleBulkEditChange(unit.id, 'booking_com_name', e.target.value)
                              : setEditedUnit({ ...editedUnit, booking_com_name: e.target.value })
                          }
                        />
                      ) : (
                        unit.booking_com_name || unit.name
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px] sticky left-[250px] z-[5] bg-background border-r">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[80px]"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_number || '') : (editedUnit.unit_number || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'unit_number', e.target.value)
                              : setEditedUnit({ ...editedUnit, unit_number: e.target.value })
                          }
                        />
                      ) : (
                        unit.unit_number || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[120px]"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_type || '') : (editedUnit.unit_type || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'unit_type', e.target.value)
                              : setEditedUnit({ ...editedUnit, unit_type: e.target.value })
                          }
                        />
                      ) : (
                        unit.unit_type || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            <span className="text-xs">{unit.view || 'Select'}</span>
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={async () => {
                            const { error } = await supabase
                              .from('units')
                              .update({ view: 'Main street' })
                              .eq('id', unit.id);
                            
                            if (error) {
                              toast({
                                variant: 'destructive',
                                title: 'Error',
                                description: 'Failed to update room view',
                              });
                            } else {
                              fetchUnits();
                              toast({
                                title: 'Success',
                                description: 'Room view updated',
                              });
                            }
                          }}>
                            Main street
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={async () => {
                            const { error } = await supabase
                              .from('units')
                              .update({ view: 'Courtyard' })
                              .eq('id', unit.id);
                            
                            if (error) {
                              toast({
                                variant: 'destructive',
                                title: 'Error',
                                description: 'Failed to update room view',
                              });
                            } else {
                              fetchUnits();
                              toast({
                                title: 'Success',
                                description: 'Room view updated',
                              });
                            }
                          }}>
                            Courtyard
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[140px]"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.booking_com_name || '') : (editedUnit.booking_com_name || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'booking_com_name', e.target.value)
                              : setEditedUnit({ ...editedUnit, booking_com_name: e.target.value })
                          }
                          placeholder="Enter Booking.com Name"
                        />
                      ) : (
                        <span className="text-sm">{unit.booking_com_name || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[100px]"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_size || '') : (editedUnit.unit_size || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'unit_size', e.target.value)
                              : setEditedUnit({ ...editedUnit, unit_size: e.target.value })
                          }
                        />
                      ) : (
                        unit.unit_size || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[80px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[60px]"
                          type="number"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.beds ?? '') : (editedUnit.beds ?? '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'beds', e.target.value ? parseInt(e.target.value) : null)
                              : setEditedUnit({ ...editedUnit, beds: e.target.value ? parseInt(e.target.value) : null })
                          }
                          placeholder="Beds"
                        />
                      ) : (
                        unit.beds || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[80px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[60px]"
                          type="number"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.baths ?? '') : (editedUnit.baths ?? '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'baths', e.target.value ? parseInt(e.target.value) : null)
                              : setEditedUnit({ ...editedUnit, baths: e.target.value ? parseInt(e.target.value) : null })
                          }
                          placeholder="Baths"
                        />
                      ) : (
                        unit.baths || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[80px]"
                          type="number"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.max_guests ?? '') : (editedUnit.max_guests ?? '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'max_guests', e.target.value ? parseInt(e.target.value) : null)
                              : setEditedUnit({ ...editedUnit, max_guests: e.target.value ? parseInt(e.target.value) : null })
                          }
                          placeholder="Max"
                        />
                      ) : (
                        unit.max_guests || '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {isEditing ? (
                        <Select
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.sofa_bed ? 'true' : 'false') : (editedUnit.sofa_bed ? 'true' : 'false')}
                          onValueChange={(value) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'sofa_bed', value === 'true')
                              : setEditedUnit({ ...editedUnit, sofa_bed: value === 'true' })
                          }
                        >
                          <SelectTrigger className="w-full min-w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        unit.sofa_bed ? 'Yes' : 'No'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      {isEditing ? (
                        <div className="text-muted-foreground text-sm whitespace-normal">Use upload button in Actions column</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{unit.photos?.length || 0} photo(s)</span>
                            <input
                              type="file"
                              id={`photo-upload-${unit.id}`}
                              multiple
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handlePhotoUpload(unit.id, e.target.files);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => document.getElementById(`photo-upload-${unit.id}`)?.click()}
                              disabled={uploadingPhotos === unit.id}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              {uploadingPhotos === unit.id ? 'Uploading...' : 'Upload'}
                            </Button>
                          </div>
                          {uploadingPhotos === unit.id && uploadProgress[unit.id] !== undefined && (
                            <div className="space-y-1">
                              <Progress value={uploadProgress[unit.id]} className="h-2 [&>div]:bg-blue-500" />
                              <p className="text-xs text-muted-foreground text-center">{uploadProgress[unit.id]}%</p>
                            </div>
                          )}
                          {unit.photos && unit.photos.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCurrentUnitPhotos({ id: unit.id, photos: unit.photos || [] });
                                setPhotoGalleryOpen(true);
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View ({unit.photos.length})
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {isEditing ? (
                        <Select
                          value={isBulkEdit ? bulkEditUnits[unit.id]?.status : editedUnit.status}
                          onValueChange={(value) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'status', value)
                              : setEditedUnit({ ...editedUnit, status: value })
                          }
                        >
                          <SelectTrigger className="w-full min-w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="capitalize">{unit.status}</span>
                      )}
                    </TableCell>
                    {isAdmin && !isBulkEdit && (
                      <TableCell>
                        {editingId === unit.id ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(unit)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => navigate(`/property-media/${unit.id}`)}
                              title="Manage photos"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleCloneClick(unit)}
                              title="Clone this room"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleDeleteClick(unit)}
                              title="Delete room"
                              className="hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
          </div>
        </div>
      </main>

      {/* Clone Confirmation Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Room</DialogTitle>
            <DialogDescription>
              Create a copy of this room with all its specifications.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2 text-sm bg-muted p-4 rounded-lg">
              <p><strong>Room Name:</strong> {roomToClone?.name}</p>
              <p><strong>Current Room #:</strong> {roomToClone?.unit_number || 'N/A'}</p>
              <p><strong>Type:</strong> {roomToClone?.unit_type || 'N/A'}</p>
              <p><strong>Price:</strong> ${roomToClone?.price_per_night || 'N/A'}/night</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloneRoomNumber">
                New Room Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cloneRoomNumber"
                value={cloneRoomNumber}
                onChange={(e) => setCloneRoomNumber(e.target.value)}
                placeholder="Enter room number (e.g., 509)"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCloneDialogOpen(false);
                setRoomToClone(null);
                setCloneRoomNumber('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmClone}
            >
              Clone Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this room? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2 text-sm">
              <p><strong>Room Name:</strong> {roomToDelete?.name}</p>
              <p><strong>Room Number:</strong> {roomToDelete?.unit_number || 'N/A'}</p>
              <p><strong>Type:</strong> {roomToDelete?.unit_type || 'N/A'}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setRoomToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Room Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open);
        if (!open) {
          setNewUnit({
            name: '', unit_number: '', unit_type: '', unit_size: '', status: 'available',
            booking_com_id: '', booking_com_name: '', comments: '', beds: null, baths: null,
            max_guests: null, sofa_bed: false, price_per_night: null, weekend_rate: null,
            tax_percentage: 14.00, photos: [], view: null, count_of_rooms: 1, default_occupancy: 2,
          });
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
            <DialogDescription>Fill in the room details below. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-name">Room Name <span className="text-destructive">*</span></Label>
              <Input id="add-name" value={newUnit.name} onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })} placeholder="e.g. Deluxe Suite" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-number">Room #</Label>
              <Input id="add-number" value={newUnit.unit_number || ''} onChange={(e) => setNewUnit({ ...newUnit, unit_number: e.target.value })} placeholder="e.g. 101" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-type">Type</Label>
              <Input id="add-type" value={newUnit.unit_type || ''} onChange={(e) => setNewUnit({ ...newUnit, unit_type: e.target.value })} placeholder="e.g. Studio, 1BR" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-bcom-name">Booking.com Name</Label>
              <Input id="add-bcom-name" value={newUnit.booking_com_name || ''} onChange={(e) => setNewUnit({ ...newUnit, booking_com_name: e.target.value })} placeholder="Booking.com display name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-view">Room View</Label>
              <Input id="add-view" value={newUnit.view || ''} onChange={(e) => setNewUnit({ ...newUnit, view: e.target.value })} placeholder="e.g. City View, Pool View" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-size">Size</Label>
              <Input id="add-size" value={newUnit.unit_size || ''} onChange={(e) => setNewUnit({ ...newUnit, unit_size: e.target.value })} placeholder="e.g. 45 sqm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-beds">Beds</Label>
              <Input id="add-beds" type="number" value={newUnit.beds || ''} onChange={(e) => setNewUnit({ ...newUnit, beds: e.target.value ? parseInt(e.target.value) : null })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-baths">Baths</Label>
              <Input id="add-baths" type="number" value={newUnit.baths || ''} onChange={(e) => setNewUnit({ ...newUnit, baths: e.target.value ? parseInt(e.target.value) : null })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-guests">Max Guests</Label>
              <Input id="add-guests" type="number" value={newUnit.max_guests || ''} onChange={(e) => setNewUnit({ ...newUnit, max_guests: e.target.value ? parseInt(e.target.value) : null })} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-count">Count</Label>
              <Input id="add-count" type="number" min="1" value={newUnit.count_of_rooms ?? 1} onChange={(e) => setNewUnit({ ...newUnit, count_of_rooms: e.target.value ? parseInt(e.target.value) : 1 })} placeholder="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-occupancy">Default Occupancy</Label>
              <Input id="add-occupancy" type="number" min="1" value={newUnit.default_occupancy ?? 2} onChange={(e) => setNewUnit({ ...newUnit, default_occupancy: e.target.value ? parseInt(e.target.value) : 2 })} placeholder="2" />
            </div>
            <div className="space-y-2">
              <Label>Sofa Bed</Label>
              <Select value={newUnit.sofa_bed ? 'true' : 'false'} onValueChange={(v) => setNewUnit({ ...newUnit, sofa_bed: v === 'true' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newUnit.status} onValueChange={(v) => setNewUnit({ ...newUnit, status: v })}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="add-comments">Comments</Label>
              <Textarea id="add-comments" value={newUnit.comments || ''} onChange={(e) => setNewUnit({ ...newUnit, comments: e.target.value })} placeholder="Any additional notes..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRoom}><Plus className="h-4 w-4 mr-2" />Add Room</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={photoGalleryOpen} onOpenChange={setPhotoGalleryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Photos</DialogTitle>
            <DialogDescription>
              Drag and drop to reorder photos. The first photo will be the main image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {currentUnitPhotos && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentUnitPhotos.photos}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {currentUnitPhotos.photos.map((photoUrl, index) => (
                      <SortablePhotoItem
                        key={photoUrl}
                        id={photoUrl}
                        photoUrl={photoUrl}
                        index={index}
                        onDelete={() => {
                          handleDeletePhoto(currentUnitPhotos.id, photoUrl);
                          setCurrentUnitPhotos({
                            ...currentUnitPhotos,
                            photos: currentUnitPhotos.photos.filter(p => p !== photoUrl)
                          });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface SortablePhotoItemProps {
  id: string;
  photoUrl: string;
  index: number;
  onDelete: () => void;
}

function SortablePhotoItem({ id, photoUrl, index, onDelete }: SortablePhotoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-muted rounded-lg border"
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-shrink-0">
        {index === 0 && (
          <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded mb-1 inline-block">
            Main Photo
          </span>
        )}
        <img
          src={photoUrl}
          alt={`Photo ${index + 1}`}
          className="w-24 h-24 object-cover rounded"
        />
      </div>
      <span className="text-sm text-muted-foreground flex-1">Photo {index + 1}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default Rooms;

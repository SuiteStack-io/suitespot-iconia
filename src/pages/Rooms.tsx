import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Plus, Pencil, X, Upload, Trash2, Eye, ChevronDown, Copy } from 'lucide-react';
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

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  unit_type: string | null;
  unit_size: string | null;
  status: string;
  booking_com_id: string | null;
  booking_com_name: string | null;
  comments: string | null;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  sofa_bed: boolean | null;
  price_per_night: number | null;
  tax_percentage: number | null;
  photos: string[] | null;
  view: string | null;
}

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
  const navigate = useNavigate();
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedUnit, setEditedUnit] = useState<Partial<Unit>>({});
  const [isAdding, setIsAdding] = useState(false);
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
    tax_percentage: 14.00,
    photos: [],
    view: null,
  });
  const [uploadingPhotos, setUploadingPhotos] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [roomToClone, setRoomToClone] = useState<Unit | null>(null);
  const [cloneRoomNumber, setCloneRoomNumber] = useState<string>('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Unit | null>(null);

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
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

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
    const { data, error } = await supabase
      .from('reservations')
      .select('id, unit_id, check_in_date, check_out_date, status')
      .gte('check_in_date', today)
      .order('check_in_date');

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

  const getNextReservation = (unitId: string): string | null => {
    const unitReservations = reservations.filter(
      (res) => res.unit_id === unitId
    );
    
    if (unitReservations.length === 0) return null;
    
    const nextRes = unitReservations[0];
    return format(new Date(nextRes.check_in_date), 'MMM dd, yyyy');
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
          comments,
          beds,
          baths,
          max_guests,
          sofa_bed,
          price_per_night,
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
            comments,
            beds,
            baths,
            max_guests,
            sofa_bed,
            price_per_night,
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
      comments: newUnit.comments || null,
      beds: newUnit.beds || null,
      baths: newUnit.baths || null,
      max_guests: newUnit.max_guests || null,
      sofa_bed: newUnit.sofa_bed || false,
      price_per_night: newUnit.price_per_night || null,
      tax_percentage: newUnit.tax_percentage || 14.00,
    }]);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add room',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Room added successfully',
    });

    setIsAdding(false);
    setNewUnit({
      name: '',
      unit_number: '',
      unit_type: '',
      unit_size: '',
      status: 'available',
      booking_com_id: '',
      comments: '',
      beds: null,
      baths: null,
      max_guests: null,
      sofa_bed: false,
      price_per_night: null,
      tax_percentage: 14.00,
      photos: [],
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
        status: 'available', // New cloned rooms are available by default
        booking_com_id: null, // Don't clone booking.com ID
        comments: roomToClone.comments,
        beds: roomToClone.beds,
        baths: roomToClone.baths,
        max_guests: roomToClone.max_guests,
        sofa_bed: roomToClone.sofa_bed,
        price_per_night: roomToClone.price_per_night,
        tax_percentage: roomToClone.tax_percentage,
        photos: roomToClone.photos || [],
        view: roomToClone.view,
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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
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
                    <Button onClick={() => setIsAdding(true)} disabled={isAdding}>
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
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[1800px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Suite Name</TableHead>
                <TableHead className="min-w-[100px]">Room #</TableHead>
                <TableHead className="min-w-[140px]">Type</TableHead>
                <TableHead className="min-w-[160px]">Booking.com Name</TableHead>
                <TableHead className="min-w-[120px]">Size</TableHead>
                <TableHead className="min-w-[80px]">Beds</TableHead>
                <TableHead className="min-w-[80px]">Baths</TableHead>
                <TableHead className="min-w-[100px]">Max Guests</TableHead>
                <TableHead className="min-w-[100px]">Sofa Bed</TableHead>
                <TableHead className="min-w-[110px]">Price/Night</TableHead>
                <TableHead className="min-w-[80px]">Tax %</TableHead>
                <TableHead className="min-w-[160px]">Photos</TableHead>
                <TableHead className="min-w-[120px]">Status</TableHead>
                <TableHead className="min-w-[140px]">Booking.com ID</TableHead>
                <TableHead className="min-w-[130px]">Next Reservation</TableHead>
                <TableHead className="min-w-[140px]">View</TableHead>
                {isAdmin && !isBulkEdit && <TableHead className="min-w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding && (
                <TableRow className="bg-muted/50">
                  <TableCell>
                    <Input
                      value={newUnit.name}
                      onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
                      placeholder="Room name"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.unit_number || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, unit_number: e.target.value })}
                      placeholder="Unit #"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.unit_type || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, unit_type: e.target.value })}
                      placeholder="Type"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.booking_com_name || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, booking_com_name: e.target.value })}
                      placeholder="Booking.com Name"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.unit_size || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, unit_size: e.target.value })}
                      placeholder="Size"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newUnit.beds || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, beds: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Beds"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newUnit.baths || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, baths: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Baths"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newUnit.max_guests || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, max_guests: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Max"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={newUnit.sofa_bed ? 'true' : 'false'}
                      onValueChange={(value) => setNewUnit({ ...newUnit, sofa_bed: value === 'true' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={newUnit.price_per_night || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, price_per_night: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Price"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newUnit.tax_percentage ?? ''}
                      onChange={(e) => setNewUnit({ ...newUnit, tax_percentage: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="14"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground text-sm">Add room first, then upload photos</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={newUnit.status}
                      onValueChange={(value) => setNewUnit({ ...newUnit, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newUnit.booking_com_id || ''}
                      onChange={(e) => setNewUnit({ ...newUnit, booking_com_id: e.target.value })}
                      placeholder="Booking.com ID"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddRoom}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAdding(false);
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
                            tax_percentage: 14.00,
                            photos: [],
                          });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {units.map((unit) => {
                const isEditing = isBulkEdit || editingId === unit.id;
                const currentUnit = isBulkEdit ? bulkEditUnits[unit.id] : editedUnit;
                
                return (
                  <TableRow key={unit.id}>
                    <TableCell className="min-w-[200px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[180px]"
                          value={isBulkEdit ? bulkEditUnits[unit.id]?.name : editedUnit.name}
                          onChange={(e) => 
                            isBulkEdit 
                              ? handleBulkEditChange(unit.id, 'name', e.target.value)
                              : setEditedUnit({ ...editedUnit, name: e.target.value })
                          }
                        />
                      ) : (
                        unit.name
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
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
                    <TableCell className="min-w-[110px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[90px]"
                          type="number"
                          step="0.01"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.price_per_night ?? '') : (editedUnit.price_per_night ?? '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'price_per_night', e.target.value ? parseFloat(e.target.value) : null)
                              : setEditedUnit({ ...editedUnit, price_per_night: e.target.value ? parseFloat(e.target.value) : null })
                          }
                          placeholder="Price"
                        />
                      ) : (
                        unit.price_per_night ? `$${unit.price_per_night}` : '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[80px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[60px]"
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.tax_percentage ?? '') : (editedUnit.tax_percentage ?? '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'tax_percentage', e.target.value ? parseFloat(e.target.value) : null)
                              : setEditedUnit({ ...editedUnit, tax_percentage: e.target.value ? parseFloat(e.target.value) : null })
                          }
                          placeholder="14"
                        />
                      ) : (
                        unit.tax_percentage ? `${unit.tax_percentage}%` : '14%'
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
                            <div className="flex flex-wrap gap-1">
                              {unit.photos.map((photo, idx) => (
                                <div key={idx} className="relative group w-12 h-12 rounded overflow-hidden border">
                                  <img src={photo} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                                  <button
                                    onClick={() => handleDeletePhoto(unit.id, photo)}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                  >
                                    <Trash2 className="h-3 w-3 text-white" />
                                  </button>
                                </div>
                              ))}
                            </div>
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
                    <TableCell className="min-w-[140px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[120px]"
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.booking_com_id || '') : (editedUnit.booking_com_id || '')}
                          onChange={(e) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'booking_com_id', e.target.value)
                              : setEditedUnit({ ...editedUnit, booking_com_id: e.target.value })
                          }
                          placeholder="Enter Booking.com ID"
                        />
                      ) : (
                        <span className="font-mono text-sm">{unit.booking_com_id || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[130px]">
                      <span className="text-sm">
                        {getNextReservation(unit.id) || '-'}
                      </span>
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
          </Table>
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
              <p><strong>Suite Name:</strong> {roomToClone?.name}</p>
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
              <p><strong>Suite Name:</strong> {roomToDelete?.name}</p>
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
    </div>
  );
};

export default Rooms;

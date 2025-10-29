import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Plus, Pencil, X, Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  comments: string | null;
  beds: number | null;
  baths: number | null;
  max_guests: number | null;
  sofa_bed: boolean | null;
  photos: string[] | null;
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
    comments: '',
    beds: null,
    baths: null,
    max_guests: null,
    sofa_bed: false,
    photos: [],
  });
  const [uploadingPhotos, setUploadingPhotos] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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

    try {
      const uploadedUrls: string[] = [];

      for (const file of validFiles) {
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
    const updates = Object.values(bulkEditUnits).map((unit) => 
      supabase
        .from('units')
        .update(unit)
        .eq('id', unit.id!)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((result) => result.error);

    if (hasError) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update some rooms',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'All rooms updated successfully',
    });

    setIsBulkEdit(false);
    setBulkEditUnits({});
    fetchUnits();
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
      photos: [],
    });
    fetchUnits();
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
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room ID</TableHead>
                <TableHead>Unit Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Beds</TableHead>
                <TableHead>Baths</TableHead>
                <TableHead>Max Guests</TableHead>
                <TableHead>Sofa Bed</TableHead>
                <TableHead>Photos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booking.com ID</TableHead>
                <TableHead>Next Reservation</TableHead>
                {isAdmin && !isBulkEdit && <TableHead>Actions</TableHead>}
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
                            comments: '',
                            beds: null,
                            baths: null,
                            max_guests: null,
                            sofa_bed: false,
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={isBulkEdit ? (bulkEditUnits[unit.id]?.sofa_bed ? 'true' : 'false') : (editedUnit.sofa_bed ? 'true' : 'false')}
                          onValueChange={(value) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'sofa_bed', value === 'true')
                              : setEditedUnit({ ...editedUnit, sofa_bed: value === 'true' })
                          }
                        >
                          <SelectTrigger>
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
                    <TableCell>
                      {isEditing ? (
                        <div className="text-muted-foreground text-sm">Use upload button in Actions column</div>
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
                    <TableCell>
                      {isEditing ? (
                        <Select
                          value={isBulkEdit ? bulkEditUnits[unit.id]?.status : editedUnit.status}
                          onValueChange={(value) =>
                            isBulkEdit
                              ? handleBulkEditChange(unit.id, 'status', value)
                              : setEditedUnit({ ...editedUnit, status: value })
                          }
                        >
                          <SelectTrigger>
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
                    <TableCell>
                      {isEditing ? (
                        <Input
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
                    <TableCell>
                      <span className="text-sm">
                        {getNextReservation(unit.id) || '-'}
                      </span>
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
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(unit)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
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
    </div>
  );
};

export default Rooms;

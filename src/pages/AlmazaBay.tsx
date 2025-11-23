import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Plus, Pencil, X, Upload, Trash2, Eye, ChevronDown, Copy, Image as ImageIcon } from 'lucide-react';
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

interface Property {
  id: string;
  name: string;
  unit_number: string | null;
  unit_type: string | null;
  unit_size: string | null;
  status: string;
  address: string | null;
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

const AlmazaBay = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedProperty, setEditedProperty] = useState<Partial<Property>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newProperty, setNewProperty] = useState<Partial<Property>>({
    name: '',
    unit_number: '',
    unit_type: '',
    unit_size: '',
    status: 'available',
    address: '',
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && user && userRole && userRole !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Only administrators can access property management',
      });
      navigate('/admin');
    }
  }, [user, loading, userRole, navigate, toast]);

  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchReservations();
    }

    const propertiesChannel = supabase
      .channel('almaza-properties-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
        },
        () => {
          fetchProperties();
        }
      )
      .subscribe();

    const reservationsChannel = supabase
      .channel('almaza-reservations-changes')
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
      supabase.removeChannel(propertiesChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [user]);

  const fetchProperties = async () => {
    // Show all properties in admin view - they're already hidden from public pages
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .order('name');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch properties',
      });
      return;
    }

    setProperties(data || []);
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

  const handlePhotoUpload = async (propertyId: string, files: FileList) => {
    const MAX_FILE_SIZE = 3 * 1024 * 1024;
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

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

    if (validFiles.length === 0) return;

    setUploadingPhotos(propertyId);
    setUploadProgress({ [propertyId]: 0 });

    try {
      const uploadedUrls: string[] = [];
      const totalFiles = validFiles.length;

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${propertyId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
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
        
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress({ [propertyId]: progress });
      }

      const { data: currentProperty } = await supabase
        .from('units')
        .select('photos')
        .eq('id', propertyId)
        .single();

      const currentPhotos = currentProperty?.photos || [];
      const updatedPhotos = [...currentPhotos, ...uploadedUrls];

      const { error: updateError } = await supabase
        .from('units')
        .update({ photos: updatedPhotos })
        .eq('id', propertyId);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: `${validFiles.length} photo(s) uploaded successfully`,
      });

      fetchProperties();
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

  const handleDeletePhoto = async (propertyId: string, photoUrl: string) => {
    try {
      const { data: currentProperty } = await supabase
        .from('units')
        .select('photos')
        .eq('id', propertyId)
        .single();

      const currentPhotos = currentProperty?.photos || [];
      const updatedPhotos = currentPhotos.filter((url: string) => url !== photoUrl);

      const { error: updateError } = await supabase
        .from('units')
        .update({ photos: updatedPhotos })
        .eq('id', propertyId);

      if (updateError) throw updateError;

      const fileName = photoUrl.split('/assets/')[1];
      if (fileName) {
        await supabase.storage.from('assets').remove([fileName]);
      }

      toast({
        title: 'Success',
        description: 'Photo deleted successfully',
      });

      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getNextReservation = (propertyId: string): string | null => {
    const propertyReservations = reservations.filter(
      (res) => res.unit_id === propertyId
    );
    
    if (propertyReservations.length === 0) return null;
    
    const nextRes = propertyReservations[0];
    return format(new Date(nextRes.check_in_date), 'MMM dd, yyyy');
  };

  const handleEdit = (property: Property) => {
    setEditingId(property.id);
    setEditedProperty(property);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedProperty({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const { error } = await supabase
      .from('units')
      .update(editedProperty)
      .eq('id', editingId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update property',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Property updated successfully',
    });

    setEditingId(null);
    setEditedProperty({});
    fetchProperties();
  };

  const handleAddProperty = async () => {
    if (!newProperty.name) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Property name is required',
      });
      return;
    }

    const { error } = await supabase.from('units').insert([{
      name: newProperty.name,
      unit_number: newProperty.unit_number || null,
      unit_type: newProperty.unit_type || null,
      unit_size: newProperty.unit_size || null,
      status: newProperty.status || 'available',
      address: newProperty.address || null,
      comments: newProperty.comments || null,
      beds: newProperty.beds || null,
      baths: newProperty.baths || null,
      max_guests: newProperty.max_guests || null,
      sofa_bed: newProperty.sofa_bed || false,
      price_per_night: newProperty.price_per_night || null,
      tax_percentage: newProperty.tax_percentage || 14.00,
    }]);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add property',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Property added successfully',
    });

    setIsAdding(false);
    setNewProperty({
      name: '',
      unit_number: '',
      unit_type: '',
      unit_size: '',
      status: 'available',
      address: '',
      comments: '',
      beds: null,
      baths: null,
      max_guests: null,
      sofa_bed: false,
      price_per_night: null,
      tax_percentage: 14.00,
      photos: [],
    });
    fetchProperties();
  };

  const handleDeleteClick = (property: Property) => {
    setPropertyToDelete(property);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!propertyToDelete) return;

    try {
      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('id')
        .eq('unit_id', propertyToDelete.id)
        .limit(1);

      if (resError) throw resError;

      if (reservations && reservations.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Cannot Delete',
          description: 'This property has existing reservations and cannot be deleted.',
        });
        setDeleteDialogOpen(false);
        setPropertyToDelete(null);
        return;
      }

      if (propertyToDelete.photos && propertyToDelete.photos.length > 0) {
        const photoFilenames = propertyToDelete.photos.map(url => {
          const parts = url.split('/assets/');
          return parts.length > 1 ? parts[1] : null;
        }).filter(Boolean);

        if (photoFilenames.length > 0) {
          await supabase.storage.from('assets').remove(photoFilenames as string[]);
        }
      }

      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', propertyToDelete.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Property ${propertyToDelete.unit_number || propertyToDelete.name} deleted successfully`,
      });

      setDeleteDialogOpen(false);
      setPropertyToDelete(null);
      fetchProperties();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete property',
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
    <div className="min-h-screen bg-background font-['Playfair_Display']">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-5xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                  Almaza Bay Properties
                </h1>
                <p className="text-xl text-muted-foreground mt-2 font-normal">
                  Exclusive vacation homes by the sea
                </p>
              </div>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button onClick={() => setIsAdding(true)} disabled={isAdding} className="font-medium">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[1600px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px] text-base font-medium">Property Name</TableHead>
                <TableHead className="min-w-[100px] text-base font-medium">Unit #</TableHead>
                <TableHead className="min-w-[140px] text-base font-medium">Type</TableHead>
                <TableHead className="min-w-[200px] text-base font-medium">Address</TableHead>
                <TableHead className="min-w-[120px] text-base font-medium">Size</TableHead>
                <TableHead className="min-w-[80px] text-base font-medium">Beds</TableHead>
                <TableHead className="min-w-[80px] text-base font-medium">Baths</TableHead>
                <TableHead className="min-w-[100px] text-base font-medium">Max Guests</TableHead>
                <TableHead className="min-w-[100px] text-base font-medium">Sofa Bed</TableHead>
                <TableHead className="min-w-[110px] text-base font-medium">Price/Night</TableHead>
                <TableHead className="min-w-[80px] text-base font-medium">Tax %</TableHead>
                <TableHead className="min-w-[160px] text-base font-medium">Photos</TableHead>
                <TableHead className="min-w-[120px] text-base font-medium">Status</TableHead>
                <TableHead className="min-w-[130px] text-base font-medium">Next Reservation</TableHead>
                <TableHead className="min-w-[140px] text-base font-medium">View</TableHead>
                {isAdmin && <TableHead className="min-w-[100px] text-base font-medium">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding && (
                <TableRow className="bg-muted/50">
                  <TableCell>
                    <Input
                      value={newProperty.name}
                      onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                      placeholder="Property name"
                      className="font-['Playfair_Display']"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newProperty.unit_number || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, unit_number: e.target.value })}
                      placeholder="Unit #"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newProperty.unit_type || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, unit_type: e.target.value })}
                      placeholder="Type"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newProperty.address || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, address: e.target.value })}
                      placeholder="Address"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newProperty.unit_size || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, unit_size: e.target.value })}
                      placeholder="Size"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newProperty.beds || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, beds: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Beds"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newProperty.baths || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, baths: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Baths"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newProperty.max_guests || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, max_guests: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Max"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={newProperty.sofa_bed ? 'true' : 'false'}
                      onValueChange={(value) => setNewProperty({ ...newProperty, sofa_bed: value === 'true' })}
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
                      value={newProperty.price_per_night || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, price_per_night: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Price"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newProperty.tax_percentage ?? ''}
                      onChange={(e) => setNewProperty({ ...newProperty, tax_percentage: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="14"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-muted-foreground text-sm">Add property first, then upload photos</div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={newProperty.status}
                      onValueChange={(value) => setNewProperty({ ...newProperty, status: value })}
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
                    <span className="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddProperty}>
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAdding(false);
                          setNewProperty({
                            name: '',
                            unit_number: '',
                            unit_type: '',
                            unit_size: '',
                            status: 'available',
                            address: '',
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
              {properties.map((property) => {
                const isEditing = editingId === property.id;
                
                return (
                  <TableRow key={property.id}>
                    <TableCell className="min-w-[200px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[180px]"
                          value={editedProperty.name}
                          onChange={(e) => setEditedProperty({ ...editedProperty, name: e.target.value })}
                        />
                      ) : (
                        <span className="font-medium">{property.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {isEditing ? (
                        <Input
                          className="w-full min-w-[80px]"
                          value={editedProperty.unit_number || ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, unit_number: e.target.value })}
                        />
                      ) : (
                        property.unit_number
                      )}
                    </TableCell>
                    <TableCell className="min-w-[140px]">
                      {isEditing ? (
                        <Input
                          value={editedProperty.unit_type || ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, unit_type: e.target.value })}
                        />
                      ) : (
                        property.unit_type
                      )}
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      {isEditing ? (
                        <Input
                          value={editedProperty.address || ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, address: e.target.value })}
                        />
                      ) : (
                        property.address
                      )}
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {isEditing ? (
                        <Input
                          value={editedProperty.unit_size || ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, unit_size: e.target.value })}
                        />
                      ) : (
                        property.unit_size
                      )}
                    </TableCell>
                    <TableCell>{property.beds}</TableCell>
                    <TableCell>{property.baths}</TableCell>
                    <TableCell>{property.max_guests}</TableCell>
                    <TableCell>{property.sofa_bed ? 'Yes' : 'No'}</TableCell>
                    <TableCell>${property.price_per_night?.toFixed(2)}</TableCell>
                    <TableCell>{property.tax_percentage}%</TableCell>
                    <TableCell className="min-w-[160px]">
                      <div className="flex flex-col gap-2">
                        {uploadingPhotos === property.id && (
                          <Progress value={uploadProgress[property.id] || 0} className="h-1" />
                        )}
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            id={`photo-upload-${property.id}`}
                            onChange={(e) => {
                              if (e.target.files) handlePhotoUpload(property.id, e.target.files);
                            }}
                            disabled={uploadingPhotos === property.id}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => document.getElementById(`photo-upload-${property.id}`)?.click()}
                            disabled={uploadingPhotos === property.id}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload
                          </Button>
                          {property.photos && property.photos.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline">
                                  <Eye className="h-4 w-4 mr-2" />
                                  View ({property.photos.length})
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-96 max-h-96 overflow-y-auto">
                                {property.photos.map((photoUrl, idx) => (
                                  <div key={idx} className="flex items-center gap-2 p-2">
                                    <img src={photoUrl} alt={`Photo ${idx + 1}`} className="w-20 h-20 object-cover rounded" />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeletePhoto(property.id, photoUrl)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[120px]">
                      {isEditing ? (
                        <Select
                          value={editedProperty.status}
                          onValueChange={(value) => setEditedProperty({ ...editedProperty, status: value })}
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                          ${property.status === 'available' ? 'bg-green-100 text-green-800' : ''}
                          ${property.status === 'occupied' ? 'bg-blue-100 text-blue-800' : ''}
                          ${property.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${property.status === 'reserved' ? 'bg-purple-100 text-purple-800' : ''}
                        `}>
                          {property.status}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getNextReservation(property.id) || 'None'}</TableCell>
                    <TableCell>{property.view || '-'}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        {isEditing ? (
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
                            <Button size="sm" variant="outline" onClick={() => handleEdit(property)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(property)}>
                              <Trash2 className="h-4 w-4" />
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="font-['Playfair_Display']">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {propertyToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlmazaBay;

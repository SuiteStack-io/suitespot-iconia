import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Plus, Pencil, X, Upload, Trash2, Eye, ChevronDown, Copy, Image as ImageIcon, Lock, Globe, GripVertical, FileText, List, Download, FileUp, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { PROPERTY_FEATURES } from '@/constants/propertyFeatures';
import { z } from 'zod';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import * as XLSX from 'xlsx';
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
  is_private: boolean | null;
  location: string | null;
  features: string[] | null;
  min_stay: number | null;
  payment_terms: string | null;
}

interface Reservation {
  id: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

const STATUS_OPTIONS = ['available', 'occupied', 'maintenance', 'reserved'];

// Property import validation schema
const propertyImportSchema = z.object({
  'Property Name': z.string()
    .trim()
    .min(1, 'Property name is required')
    .max(200, 'Property name must be less than 200 characters'),
  'Unit Number': z.string().trim().max(50).optional().nullable(),
  'Type': z.string().trim().max(100).optional().nullable(),
  'Address': z.string().trim().max(500).optional().nullable(),
  'Size': z.string().trim().max(50).optional().nullable(),
  'Beds': z.union([
    z.string().regex(/^\d+$/, 'Beds must be a number').transform(Number),
    z.number().int().min(0).max(20),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Baths': z.union([
    z.string().regex(/^\d+$/, 'Baths must be a number').transform(Number),
    z.number().int().min(0).max(20),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Max Guests': z.union([
    z.string().regex(/^\d+$/, 'Max guests must be a number').transform(Number),
    z.number().int().min(0).max(50),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Sofa Bed': z.union([
    z.enum(['Yes', 'No', 'yes', 'no', 'true', 'false', 'TRUE', 'FALSE']),
    z.boolean(),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Price Per Night': z.union([
    z.string().regex(/^\d+\.?\d*$/, 'Price must be a valid number').transform(Number),
    z.number().min(0, 'Price cannot be negative'),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Min Stay': z.union([
    z.string().regex(/^\d+$/, 'Min stay must be a number').transform(Number),
    z.number().int().min(0).max(365),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Payment Terms': z.string().trim().max(500).optional().nullable(),
  'Tax %': z.union([
    z.string().regex(/^\d+\.?\d*$/, 'Tax must be a valid number').transform(Number),
    z.number().min(0).max(100),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
  'Features': z.string().max(2000).optional().nullable(),
  'Status': z.enum(['available', 'occupied', 'maintenance', 'reserved'])
    .or(z.string().transform(val => {
      const lower = val.toLowerCase();
      if (['available', 'occupied', 'maintenance', 'reserved'].includes(lower)) {
        return lower as 'available' | 'occupied' | 'maintenance' | 'reserved';
      }
      throw new Error('Invalid status');
    }))
    .optional()
    .default('available'),
  'View': z.string().trim().max(200).optional().nullable(),
  'Is Private': z.union([
    z.enum(['Yes', 'No', 'yes', 'no', 'true', 'false', 'TRUE', 'FALSE']),
    z.boolean(),
    z.null(),
    z.literal('')
  ]).optional().nullable(),
});

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
    is_private: true,
    location: 'Almaza Bay',
    features: [],
    min_stay: null,
    payment_terms: null,
  });
  const [uploadingPhotos, setUploadingPhotos] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [currentPropertyPhotos, setCurrentPropertyPhotos] = useState<{ id: string; photos: string[] } | null>(null);
  const [showKYCModal, setShowKYCModal] = useState(false);
  const [kycLink, setKycLink] = useState('');
  const [kycGuestName, setKycGuestName] = useState('');
  const [kycGuestContact, setKycGuestContact] = useState('');
  const [showKYCInputModal, setShowKYCInputModal] = useState(false);
  const [selectedPropertyForKYC, setSelectedPropertyForKYC] = useState<string | null>(null);
  const [featuresDialogOpen, setFeaturesDialogOpen] = useState(false);
  const [currentPropertyFeatures, setCurrentPropertyFeatures] = useState<{ id: string; features: string[] } | null>(null);
  const [customFeature, setCustomFeature] = useState('');
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [bulkFeaturesDialogOpen, setBulkFeaturesDialogOpen] = useState(false);
  const [selectedPropertiesForBulk, setSelectedPropertiesForBulk] = useState<string[]>([]);
  const [bulkFeaturesToApply, setBulkFeaturesToApply] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importValidationErrors, setImportValidationErrors] = useState<{ row: number; errors: string[] }[]>([]);
  
  // Bulk edit mode state
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditedProperties, setBulkEditedProperties] = useState<{ [key: string]: Partial<Property> }>({});
  
  // TODO: Remove after development - Simulation dialog state
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
  const [selectedPropertiesForSimulation, setSelectedPropertiesForSimulation] = useState<string[]>([]);
  const [simulationTimer, setSimulationTimer] = useState<number | null>(null);
  const [simulationLink, setSimulationLink] = useState<string>('');
  const [simulationCredentials, setSimulationCredentials] = useState<{ username: string; password: string } | null>(null);
  const [generatingSimulation, setGeneratingSimulation] = useState(false);
  const [simulationSessionId, setSimulationSessionId] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // TODO: Remove after development - Timer countdown effect
  useEffect(() => {
    if (simulationTimer === null || simulationTimer <= 0) return;

    const interval = setInterval(() => {
      setSimulationTimer(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simulationTimer]);

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('location', 'Almaza Bay')
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

  const handleTogglePrivate = async (propertyId: string, currentValue: boolean | null) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ is_private: !currentValue })
        .eq('id', propertyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Property ${!currentValue ? 'marked as private' : 'made public'}`,
      });

      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleReorderPhotos = async (propertyId: string, newPhotosOrder: string[]) => {
    try {
      const { error } = await supabase
        .from('units')
        .update({ photos: newPhotosOrder })
        .eq('id', propertyId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Photo order updated',
      });

      fetchProperties();
      if (currentPropertyPhotos?.id === propertyId) {
        setCurrentPropertyPhotos({ id: propertyId, photos: newPhotosOrder });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleFeature = async (featureName: string) => {
    if (!currentPropertyFeatures) return;
    
    try {
      const currentFeatures = currentPropertyFeatures.features || [];
      const isSelected = currentFeatures.includes(featureName);
      
      const updatedFeatures = isSelected
        ? currentFeatures.filter(f => f !== featureName)
        : [...currentFeatures, featureName];
      
      const { error } = await supabase
        .from('units')
        .update({ features: updatedFeatures })
        .eq('id', currentPropertyFeatures.id);

      if (error) throw error;

      setCurrentPropertyFeatures({ ...currentPropertyFeatures, features: updatedFeatures });
      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAddCustomFeature = async () => {
    if (!customFeature.trim() || !currentPropertyFeatures) return;
    
    try {
      const updatedFeatures = [...(currentPropertyFeatures.features || []), customFeature.trim()];
      
      const { error } = await supabase
        .from('units')
        .update({ features: updatedFeatures })
        .eq('id', currentPropertyFeatures.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Custom feature added successfully',
      });

      setCurrentPropertyFeatures({ ...currentPropertyFeatures, features: updatedFeatures });
      setCustomFeature('');
      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRemoveCustomFeature = async (featureName: string) => {
    if (!currentPropertyFeatures) return;
    
    try {
      const updatedFeatures = currentPropertyFeatures.features.filter(f => f !== featureName);
      
      const { error } = await supabase
        .from('units')
        .update({ features: updatedFeatures })
        .eq('id', currentPropertyFeatures.id);

      if (error) throw error;

      setCurrentPropertyFeatures({ ...currentPropertyFeatures, features: updatedFeatures });
      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleTogglePropertyForBulk = (propertyId: string) => {
    setSelectedPropertiesForBulk(prev => 
      prev.includes(propertyId) 
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const handleToggleBulkFeature = (featureName: string) => {
    setBulkFeaturesToApply(prev =>
      prev.includes(featureName)
        ? prev.filter(f => f !== featureName)
        : [...prev, featureName]
    );
  };

  const handleApplyBulkFeatures = async () => {
    if (selectedPropertiesForBulk.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one property',
        variant: 'destructive',
      });
      return;
    }

    if (bulkFeaturesToApply.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one feature to apply',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Apply features to all selected properties
      for (const propertyId of selectedPropertiesForBulk) {
        const property = properties.find(p => p.id === propertyId);
        if (!property) continue;

        const currentFeatures = property.features || [];
        const updatedFeatures = Array.from(new Set([...currentFeatures, ...bulkFeaturesToApply]));

        const { error } = await supabase
          .from('units')
          .update({ features: updatedFeatures })
          .eq('id', propertyId);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Features applied to ${selectedPropertiesForBulk.length} ${selectedPropertiesForBulk.length === 1 ? 'property' : 'properties'}`,
      });

      setBulkFeaturesDialogOpen(false);
      setSelectedPropertiesForBulk([]);
      setBulkFeaturesToApply([]);
      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleExportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = properties.map(property => ({
        'Property Name': property.name,
        'Unit Number': property.unit_number || '',
        'Type': property.unit_type || '',
        'Address': property.address || '',
        'Size': property.unit_size || '',
        'Beds': property.beds || '',
        'Baths': property.baths || '',
        'Max Guests': property.max_guests || '',
        'Sofa Bed': property.sofa_bed ? 'Yes' : 'No',
        'Price Per Night': property.price_per_night || '',
        'Min Stay': property.min_stay || '',
        'Payment Terms': property.payment_terms || '',
        'Tax %': property.tax_percentage || '',
        'Features': (property.features || []).join(', '),
        'Status': property.status,
        'View': property.view || '',
        'Is Private': property.is_private ? 'Yes' : 'No',
        'Location': property.location || 'Almaza Bay',
      }));

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Create workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties');

      // Generate filename with timestamp
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
      const filename = `almaza-bay-properties_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'Success',
        description: 'Properties exported successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportValidationErrors([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Validate data
        const errors: { row: number; errors: string[] }[] = [];
        const validatedData: any[] = [];

        jsonData.forEach((row: any, index: number) => {
          try {
            const validatedRow = propertyImportSchema.parse(row);
            validatedData.push(validatedRow);
          } catch (error: any) {
            if (error instanceof z.ZodError) {
              const rowErrors = error.errors.map(err => 
                `${err.path.join('.')}: ${err.message}`
              );
              errors.push({ row: index + 2, errors: rowErrors }); // +2 for header row and 0-based index
            }
          }
        });

        setImportPreview(validatedData);
        setImportValidationErrors(errors);

        if (errors.length > 0) {
          toast({
            title: 'Validation Errors Found',
            description: `${errors.length} ${errors.length === 1 ? 'row has' : 'rows have'} validation errors. Please review before importing.`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'File validated',
            description: `Ready to import ${validatedData.length} ${validatedData.length === 1 ? 'property' : 'properties'}`,
          });
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: 'Failed to parse file: ' + error.message,
          variant: 'destructive',
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportProperties = async () => {
    if (importPreview.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid data to import',
        variant: 'destructive',
      });
      return;
    }

    if (importValidationErrors.length > 0) {
      toast({
        title: 'Validation Errors',
        description: `Please fix ${importValidationErrors.length} validation ${importValidationErrors.length === 1 ? 'error' : 'errors'} before importing`,
        variant: 'destructive',
      });
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const row of importPreview) {
        try {
          // Map validated columns to database fields
          const propertyData: any = {
            name: row['Property Name'],
            unit_number: row['Unit Number'] || null,
            unit_type: row['Type'] || null,
            address: row['Address'] || null,
            unit_size: row['Size'] || null,
            beds: row['Beds'] || null,
            baths: row['Baths'] || null,
            max_guests: row['Max Guests'] || null,
            sofa_bed: ['Yes', 'yes', 'true', 'TRUE', true].includes(row['Sofa Bed']),
            price_per_night: row['Price Per Night'] || null,
            min_stay: row['Min Stay'] || null,
            payment_terms: row['Payment Terms'] || null,
            tax_percentage: row['Tax %'] || 14.00,
            features: row['Features'] 
              ? String(row['Features']).split(',').map((f: string) => f.trim()).filter(Boolean) 
              : [],
            status: row['Status'] || 'available',
            view: row['View'] || null,
            is_private: ['Yes', 'yes', 'true', 'TRUE', true].includes(row['Is Private']),
            location: 'Almaza Bay',
            photos: [],
          };

          // Check if property already exists by name and unit number
          const { data: existing } = await supabase
            .from('units')
            .select('id')
            .eq('name', propertyData.name)
            .eq('location', 'Almaza Bay')
            .maybeSingle();

          if (existing) {
            // Update existing property
            const { error } = await supabase
              .from('units')
              .update(propertyData)
              .eq('id', existing.id);

            if (error) throw error;
          } else {
            // Insert new property
            const { error } = await supabase
              .from('units')
              .insert(propertyData);

            if (error) throw error;
          }

          successCount++;
        } catch (error: any) {
          console.error('Error importing row:', row, error);
          errorCount++;
          errors.push(`${row['Property Name']}: ${error.message}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${successCount} ${successCount === 1 ? 'property' : 'properties'}${errorCount > 0 ? `. ${errorCount} failed.` : ''}`,
        });

        if (errorCount === 0) {
          setImportDialogOpen(false);
          setImportFile(null);
          setImportPreview([]);
          setImportValidationErrors([]);
        }
      } else {
        toast({
          title: 'Import Failed',
          description: errors.length > 0 ? errors[0] : 'All imports failed',
          variant: 'destructive',
        });
      }

      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleKYCClick = (propertyId: string) => {
    setSelectedPropertyForKYC(propertyId);
    setKycGuestName('');
    setKycGuestContact('');
    setShowKYCInputModal(true);
  };

  const handleGenerateKYC = async () => {
    if (!kycGuestName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter guest name',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      const uniqueToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const { error } = await supabase
        .from('kyc_links')
        .insert({
          unit_id: selectedPropertyForKYC,
          guest_name: kycGuestName,
          guest_contact: kycGuestContact || null,
          token: uniqueToken,
          status: 'pending',
          created_by: authUser?.id
        });

      if (error) throw error;

      const link = `${window.location.origin}/kyc/${uniqueToken}`;
      setKycLink(link);
      setShowKYCInputModal(false);
      setShowKYCModal(true);
      toast({
        title: 'Success',
        description: 'KYC link generated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate KYC link',
        variant: 'destructive',
      });
    }
  };

  // TODO: Remove after development - Simulation dialog handlers
  const toggleSimulationProperty = (propertyId: string) => {
    setSelectedPropertiesForSimulation(prev => 
      prev.includes(propertyId)
        ? prev.filter(id => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const selectAllSimulationProperties = () => {
    setSelectedPropertiesForSimulation(properties.map(p => p.id));
  };

  const clearAllSimulationProperties = () => {
    setSelectedPropertiesForSimulation([]);
  };

  const handleGenerateSimulationLink = async () => {
    if (selectedPropertiesForSimulation.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one property',
        variant: 'destructive',
      });
      return;
    }

    setGeneratingSimulation(true);

    try {
      // Create a temporary KYC link for simulation
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const uniqueToken = 'sim_' + Math.random().toString(36).substring(2, 15);
      
      const { data: kycData, error: kycError } = await supabase
        .from('kyc_links')
        .insert({
          guest_name: 'Simulation Test',
          guest_contact: 'simulation@test.com',
          token: uniqueToken,
          status: 'completed',
          outcome: 'accepted',
          created_by: authUser?.id
        })
        .select()
        .single();

      if (kycError) throw kycError;

      // Generate credentials via edge function
      const { data: credentialsData, error: credError } = await supabase.functions.invoke(
        'generate-selection-credentials',
        {
          body: {
            kycLinkId: kycData.id,
            guestName: 'Simulation Test',
            selectedUnitIds: selectedPropertiesForSimulation
          }
        }
      );

      if (credError) throw credError;

      const link = `${window.location.origin}/selection/${credentialsData.token}`;
      
      // Fetch the selection_accounts record to get the session ID
      const { data: sessionData, error: sessionError } = await supabase
        .from('selection_accounts')
        .select('id')
        .eq('landing_page_token', credentialsData.token)
        .single();

      if (sessionError) throw sessionError;
      
      setSimulationSessionId(sessionData.id);
      setSimulationLink(link);
      setSimulationCredentials({
        username: credentialsData.username,
        password: credentialsData.password
      });
      setSimulationTimer(15 * 60); // 15 minutes in seconds

      toast({
        title: 'Success',
        description: 'Simulation session created successfully!',
      });
    } catch (error: any) {
      console.error('Error generating simulation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate simulation session',
        variant: 'destructive',
      });
    } finally {
      setGeneratingSimulation(false);
    }
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copySimulationLink = () => {
    navigator.clipboard.writeText(simulationLink);
    toast({
      title: 'Copied!',
      description: 'Link copied to clipboard',
    });
  };

  const copySimulationCredentials = () => {
    if (!simulationCredentials) return;
    const text = `Username: ${simulationCredentials.username}\nPassword: ${simulationCredentials.password}`;
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: 'Credentials copied to clipboard',
    });
  };

  const extendSimulationSession = async () => {
    if (!simulationSessionId) return;

    try {
      const newExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('selection_accounts')
        .update({ session_expires_at: newExpiresAt })
        .eq('id', simulationSessionId);

      if (error) throw error;

      setSimulationTimer(15 * 60); // Reset to 15 minutes
      
      toast({
        title: 'Session Extended',
        description: 'Added 15 more minutes to the session',
      });
    } catch (error: any) {
      console.error('Error extending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to extend session',
        variant: 'destructive',
      });
    }
  };

  const revokeSimulationSession = async () => {
    if (!simulationSessionId) return;

    try {
      const { error } = await supabase
        .from('selection_accounts')
        .update({ 
          session_expires_at: new Date().toISOString(),
          is_active: false 
        })
        .eq('id', simulationSessionId);

      if (error) throw error;

      setSimulationTimer(0);
      setShowRevokeConfirm(false);
      
      toast({
        title: 'Session Revoked',
        description: 'The simulation session has been terminated',
      });
    } catch (error: any) {
      console.error('Error revoking session:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    }
  };

  const getSessionStatus = () => {
    if (simulationTimer === null) return null;
    if (simulationTimer === 0) return 'expired';
    if (simulationTimer < 120) return 'expiring';
    return 'active';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !currentPropertyPhotos) return;

    if (active.id !== over.id) {
      const oldIndex = currentPropertyPhotos.photos.indexOf(active.id as string);
      const newIndex = currentPropertyPhotos.photos.indexOf(over.id as string);

      const newOrder = arrayMove(currentPropertyPhotos.photos, oldIndex, newIndex);
      setCurrentPropertyPhotos({ ...currentPropertyPhotos, photos: newOrder });
      handleReorderPhotos(currentPropertyPhotos.id, newOrder);
    }
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
      is_private: newProperty.is_private ?? true,
      location: 'Almaza Bay',
      min_stay: newProperty.min_stay || null,
      payment_terms: newProperty.payment_terms || null,
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
      is_private: true,
      location: 'Almaza Bay',
      features: [],
      min_stay: null,
      payment_terms: null,
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

  const handleBulkEditChange = (propertyId: string, field: keyof Property, value: any) => {
    setBulkEditedProperties(prev => ({
      ...prev,
      [propertyId]: {
        ...prev[propertyId],
        [field]: value
      }
    }));
  };

  const handleSaveAllBulkEdits = async () => {
    try {
      const updates = Object.entries(bulkEditedProperties).map(([id, changes]) => 
        supabase.from('units').update(changes).eq('id', id)
      );

      await Promise.all(updates);

      toast({
        title: 'Success',
        description: 'All changes saved successfully',
      });

      setBulkEditedProperties({});
      setBulkEditMode(false);
      fetchProperties();
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleBulkEditMode = () => {
    if (bulkEditMode) {
      // Cancel bulk edit
      setBulkEditedProperties({});
    }
    setBulkEditMode(!bulkEditMode);
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
                {/* TODO: Remove after development - Simulation button */}
                <Button 
                  variant="outline"
                  onClick={() => setSimulationDialogOpen(true)}
                  className="font-medium"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Unit Selection
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => navigate('/kyc-management')}
                  className="font-medium"
                >
                  <List className="h-4 w-4 mr-2" />
                  View KYC Links
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleExportToExcel}
                  className="font-medium"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setImportDialogOpen(true)}
                  className="font-medium"
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setBulkFeaturesDialogOpen(true)}
                  className="font-medium"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Bulk Features
                </Button>
                {bulkEditMode ? (
                  <>
                    <Button 
                      onClick={handleSaveAllBulkEdits}
                      disabled={Object.keys(bulkEditedProperties).length === 0}
                      className="font-medium"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={toggleBulkEditMode}
                      className="font-medium"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline"
                      onClick={toggleBulkEditMode}
                      className="font-medium"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Bulk Edit
                    </Button>
                    <Button onClick={() => setIsAdding(true)} disabled={isAdding} className="font-medium">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Property
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {bulkEditMode && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-900">
              <strong>Bulk Edit Mode:</strong> The table can be scrolled horizontally to see all fields. All changes will be saved when you click "Save All".
            </p>
          </div>
        )}
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
                <TableHead className="min-w-[100px] text-base font-medium">Min Stay</TableHead>
                <TableHead className="min-w-[200px] text-base font-medium">Payment Terms</TableHead>
                <TableHead className="min-w-[80px] text-base font-medium">Tax %</TableHead>
                <TableHead className="min-w-[160px] text-base font-medium">Photos</TableHead>
                <TableHead className="min-w-[160px] text-base font-medium">Features</TableHead>
                <TableHead className="min-w-[120px] text-base font-medium">Status</TableHead>
                <TableHead className="min-w-[130px] text-base font-medium">Next Reservation</TableHead>
                <TableHead className="min-w-[140px] text-base font-medium">View</TableHead>
                <TableHead className="min-w-[120px] text-base font-medium">Visibility</TableHead>
                {isAdmin && !bulkEditMode && <TableHead className="min-w-[100px] text-base font-medium">Actions</TableHead>}
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
                      placeholder="Size (sqm)"
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
                      value={newProperty.min_stay || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, min_stay: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Min nights"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newProperty.payment_terms || ''}
                      onChange={(e) => setNewProperty({ ...newProperty, payment_terms: e.target.value })}
                      placeholder="Payment terms"
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
                    <div className="text-muted-foreground text-sm">Add property first</div>
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
                    <div className="flex items-center gap-2">
                      <Switch checked={true} disabled />
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Private
                      </span>
                    </div>
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
                            is_private: true,
                            location: 'Almaza Bay',
                            features: [],
                            min_stay: null,
                            payment_terms: null,
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
                          placeholder="Size (sqm)"
                        />
                      ) : (
                        property.unit_size ? `${property.unit_size} sqm` : '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[80px]">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedProperty.beds ?? ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, beds: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Beds"
                        />
                      ) : (
                        property.beds ?? '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[80px]">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedProperty.baths ?? ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, baths: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Baths"
                        />
                      ) : (
                        property.baths ?? '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {bulkEditMode || isEditing ? (
                        <Input
                          type="number"
                          value={bulkEditMode 
                            ? (bulkEditedProperties[property.id]?.max_guests ?? property.max_guests ?? '')
                            : (editedProperty.max_guests ?? '')}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : null;
                            if (bulkEditMode) {
                              handleBulkEditChange(property.id, 'max_guests', value);
                            } else {
                              setEditedProperty({ ...editedProperty, max_guests: value });
                            }
                          }}
                          placeholder="Max guests"
                        />
                      ) : (
                        property.max_guests ?? '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[100px]">
                      {bulkEditMode || isEditing ? (
                        <Select
                          value={bulkEditMode
                            ? String(bulkEditedProperties[property.id]?.sofa_bed ?? property.sofa_bed ?? false)
                            : String(editedProperty.sofa_bed ?? false)}
                          onValueChange={(value) => {
                            const boolValue = value === 'true';
                            if (bulkEditMode) {
                              handleBulkEditChange(property.id, 'sofa_bed', boolValue);
                            } else {
                              setEditedProperty({ ...editedProperty, sofa_bed: boolValue });
                            }
                          }}
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
                        property.sofa_bed ? 'Yes' : 'No'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[110px]">
                      {bulkEditMode || isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={bulkEditMode 
                            ? (bulkEditedProperties[property.id]?.price_per_night ?? property.price_per_night ?? '')
                            : (editedProperty.price_per_night ?? '')}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : null;
                            if (bulkEditMode) {
                              handleBulkEditChange(property.id, 'price_per_night', value);
                            } else {
                              setEditedProperty({ ...editedProperty, price_per_night: value });
                            }
                          }}
                          placeholder="Price"
                        />
                      ) : (
                        `$${property.price_per_night?.toFixed(2) ?? '-'}`
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedProperty.min_stay || ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, min_stay: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Min nights"
                        />
                      ) : (
                        property.min_stay ? `${property.min_stay} nights` : '-'
                      )}
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                      {isEditing ? (
                        <Input
                          value={editedProperty.payment_terms || ''}
                          onChange={(e) => setEditedProperty({ ...editedProperty, payment_terms: e.target.value })}
                          placeholder="Payment terms"
                        />
                      ) : (
                        property.payment_terms || '-'
                      )}
                    </TableCell>
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
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setCurrentPropertyPhotos({ id: property.id, photos: property.photos || [] });
                                setPhotoGalleryOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View ({property.photos.length})
                            </Button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCurrentPropertyFeatures({ id: property.id, features: property.features || [] });
                          setFeaturesDialogOpen(true);
                        }}
                      >
                        <List className="h-4 w-4 mr-2" />
                        Manage ({(property.features || []).length})
                      </Button>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={property.is_private ?? false}
                          onCheckedChange={() => handleTogglePrivate(property.id, property.is_private)}
                        />
                        <span className="text-sm font-medium flex items-center gap-1">
                          {property.is_private ? (
                            <>
                              <Lock className="h-3 w-3" />
                              Private
                            </>
                          ) : (
                            <>
                              <Globe className="h-3 w-3" />
                              Public
                            </>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    {isAdmin && !bulkEditMode && (
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
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleKYCClick(property.id)}
                              title="Generate KYC Link"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
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

      <Dialog open={photoGalleryOpen} onOpenChange={setPhotoGalleryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Photos</DialogTitle>
            <DialogDescription>
              Drag and drop to reorder photos. The first photo will be the main image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {currentPropertyPhotos && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentPropertyPhotos.photos}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {currentPropertyPhotos.photos.map((photoUrl, index) => (
                      <SortablePhotoItem
                        key={photoUrl}
                        id={photoUrl}
                        photoUrl={photoUrl}
                        index={index}
                        onDelete={() => {
                          handleDeletePhoto(currentPropertyPhotos.id, photoUrl);
                          setCurrentPropertyPhotos({
                            ...currentPropertyPhotos,
                            photos: currentPropertyPhotos.photos.filter(p => p !== photoUrl)
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

      {/* Features Management Dialog */}
      <Dialog open={featuresDialogOpen} onOpenChange={setFeaturesDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-['Playfair_Display'] text-2xl font-semibold">Manage Features & Amenities</DialogTitle>
            <DialogDescription>
              Select features from predefined categories or add custom features for this property
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Predefined Features by Category */}
            {PROPERTY_FEATURES.map((category) => (
              <Collapsible
                key={category.name}
                open={openCategories.includes(category.name)}
                onOpenChange={(isOpen) => {
                  setOpenCategories(prev =>
                    isOpen
                      ? [...prev, category.name]
                      : prev.filter(c => c !== category.name)
                  );
                }}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <span className="font-medium text-base">{category.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({currentPropertyFeatures?.features.filter(f => category.features.includes(f)).length || 0}/{category.features.length})
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${openCategories.includes(category.name) ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-2 gap-3 pl-12 pr-2">
                    {category.features.map((feature) => {
                      const isSelected = currentPropertyFeatures?.features.includes(feature) || false;
                      return (
                        <div key={feature} className="flex items-center space-x-2">
                          <Checkbox
                            id={`feature-${feature}`}
                            checked={isSelected}
                            onCheckedChange={() => handleToggleFeature(feature)}
                          />
                          <label
                            htmlFor={`feature-${feature}`}
                            className="text-sm cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {feature}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}

            {/* Custom Features Section */}
            <div className="border-t pt-6">
              <h3 className="font-medium text-base mb-3 flex items-center gap-2">
                <span>✨</span>
                Custom Features
              </h3>
              
              {/* Add custom feature */}
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Add a custom feature..."
                  value={customFeature}
                  onChange={(e) => setCustomFeature(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomFeature();
                    }
                  }}
                  autoComplete="off"
                />
                <Button onClick={handleAddCustomFeature} disabled={!customFeature.trim()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {/* Display custom features (features not in predefined list) */}
              {currentPropertyFeatures && (() => {
                const allPredefinedFeatures = PROPERTY_FEATURES.flatMap(cat => cat.features);
                const customFeatures = currentPropertyFeatures.features.filter(
                  f => !allPredefinedFeatures.includes(f)
                );
                
                return customFeatures.length > 0 ? (
                  <div className="space-y-2">
                    {customFeatures.map((feature) => (
                      <div key={feature} className="flex items-center justify-between p-2 hover:bg-muted rounded-lg">
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-primary">✓</span>
                          {feature}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveCustomFeature(feature)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    No custom features added. Add unique features specific to this property.
                  </p>
                );
              })()}
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Total selected: {currentPropertyFeatures?.features.length || 0} features</span>
              <Button variant="outline" onClick={() => setFeaturesDialogOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Feature Management Dialog */}
      <Dialog open={bulkFeaturesDialogOpen} onOpenChange={setBulkFeaturesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">Bulk Feature Management</DialogTitle>
            <DialogDescription>
              Select properties and features to apply in bulk
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Property Selection Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-base">Select Properties</h3>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedPropertiesForBulk(properties.map(p => p.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedPropertiesForBulk([])}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto border rounded-lg p-3">
                {properties.map((property) => (
                  <div key={property.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded">
                    <Checkbox
                      checked={selectedPropertiesForBulk.includes(property.id)}
                      onCheckedChange={() => handleTogglePropertyForBulk(property.id)}
                    />
                    <label className="text-sm cursor-pointer flex-1" onClick={() => handleTogglePropertyForBulk(property.id)}>
                      {property.name} {property.unit_number && `(${property.unit_number})`}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Selected: {selectedPropertiesForBulk.length} {selectedPropertiesForBulk.length === 1 ? 'property' : 'properties'}
              </p>
            </div>

            {/* Features Selection Section */}
            <div className="space-y-3 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-base">Select Features to Apply</h3>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      const allFeatures = PROPERTY_FEATURES.flatMap(cat => cat.features);
                      setBulkFeaturesToApply(allFeatures);
                    }}
                  >
                    Select All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setBulkFeaturesToApply([])}
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              <div className="space-y-3">
                {PROPERTY_FEATURES.map((category) => (
                  <Collapsible
                    key={category.name}
                    open={openCategories.includes(category.name)}
                    onOpenChange={(isOpen) => {
                      setOpenCategories(prev =>
                        isOpen
                          ? [...prev, category.name]
                          : prev.filter(c => c !== category.name)
                      );
                    }}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{category.icon}</span>
                        <span className="font-medium">{category.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({category.features.filter(f => bulkFeaturesToApply.includes(f)).length}/{category.features.length})
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openCategories.includes(category.name) ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-1">
                      {category.features.map((feature) => (
                        <div
                          key={feature}
                          className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                          onClick={() => handleToggleBulkFeature(feature)}
                        >
                          <Checkbox
                            checked={bulkFeaturesToApply.includes(feature)}
                            onCheckedChange={() => handleToggleBulkFeature(feature)}
                          />
                          <label className="text-sm cursor-pointer flex-1">
                            {feature}
                          </label>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
              
              <p className="text-sm text-muted-foreground">
                Selected: {bulkFeaturesToApply.length} {bulkFeaturesToApply.length === 1 ? 'feature' : 'features'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBulkFeaturesDialogOpen(false);
              setSelectedPropertiesForBulk([]);
              setBulkFeaturesToApply([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplyBulkFeatures}
              disabled={selectedPropertiesForBulk.length === 0 || bulkFeaturesToApply.length === 0}
            >
              Apply to {selectedPropertiesForBulk.length} {selectedPropertiesForBulk.length === 1 ? 'Property' : 'Properties'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Properties Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">Import Properties</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import property data. All fields will be automatically filled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* File Upload Section */}
            <div className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="import-file-upload"
                />
                <label
                  htmlFor="import-file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <FileUp className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Click to upload CSV or Excel file</p>
                    <p className="text-sm text-muted-foreground">Supports .csv, .xlsx, .xls formats</p>
                  </div>
                  {importFile && (
                    <p className="text-sm text-primary mt-2">
                      Selected: {importFile.name}
                    </p>
                  )}
                </label>
              </div>

              {/* Expected Columns Info */}
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Expected Columns:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>• Property Name</span>
                  <span>• Unit Number</span>
                  <span>• Type</span>
                  <span>• Address</span>
                  <span>• Size</span>
                  <span>• Beds</span>
                  <span>• Baths</span>
                  <span>• Max Guests</span>
                  <span>• Sofa Bed (Yes/No)</span>
                  <span>• Price Per Night</span>
                  <span>• Min Stay</span>
                  <span>• Payment Terms</span>
                  <span>• Tax %</span>
                  <span>• Features (comma-separated)</span>
                  <span>• Status</span>
                  <span>• View</span>
                  <span>• Is Private (Yes/No)</span>
                </div>
              </div>

              {/* Download Template Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const template = [{
                    'Property Name': 'Sample Property',
                    'Unit Number': '101',
                    'Type': 'Chalet',
                    'Address': 'Sample Address',
                    'Size': '200',
                    'Beds': '3',
                    'Baths': '2',
                    'Max Guests': '6',
                    'Sofa Bed': 'Yes',
                    'Price Per Night': '500',
                    'Min Stay': '3',
                    'Payment Terms': '50% upfront, 50% on arrival',
                    'Tax %': '14',
                    'Features': 'Private Pool, WiFi, Air Conditioning',
                    'Status': 'available',
                    'View': 'Sea View',
                    'Is Private': 'Yes',
                  }];
                  const ws = XLSX.utils.json_to_sheet(template);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Template');
                  XLSX.writeFile(wb, 'almaza-bay-import-template.xlsx');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            {/* Validation Errors Section */}
            {importValidationErrors.length > 0 && (
              <div className="space-y-3 border-t pt-6">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <h3 className="font-medium text-base text-destructive flex items-center gap-2 mb-3">
                    <AlertCircle className="h-5 w-5" />
                    Validation Errors ({importValidationErrors.length} {importValidationErrors.length === 1 ? 'row' : 'rows'})
                  </h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {importValidationErrors.map((error, index) => (
                      <div key={index} className="bg-background rounded p-3 space-y-1">
                        <p className="font-medium text-sm">Row {error.row}:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                          {error.errors.map((err, errIndex) => (
                            <li key={errIndex}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    Please fix these errors in your file and upload again.
                  </p>
                </div>
              </div>
            )}

            {/* Preview Section */}
            {importPreview.length > 0 && (
              <div className="space-y-3 border-t pt-6">
                <h3 className="font-medium text-base">
                  Preview ({importPreview.length} {importPreview.length === 1 ? 'property' : 'properties'})
                </h3>
                <div className="max-h-[300px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property Name</TableHead>
                        <TableHead>Unit #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Beds</TableHead>
                        <TableHead>Baths</TableHead>
                        <TableHead>Features</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importPreview.slice(0, 10).map((row: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{row['Property Name']}</TableCell>
                          <TableCell>{row['Unit Number']}</TableCell>
                          <TableCell>{row['Type']}</TableCell>
                          <TableCell>{row['Beds']}</TableCell>
                          <TableCell>{row['Baths']}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {String(row['Features'] || '').substring(0, 50)}
                            {String(row['Features'] || '').length > 50 ? '...' : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {importPreview.length > 10 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      And {importPreview.length - 10} more...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              setImportFile(null);
              setImportPreview([]);
              setImportValidationErrors([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleImportProperties}
              disabled={importPreview.length === 0 || importValidationErrors.length > 0}
            >
              Import {importPreview.length} {importPreview.length === 1 ? 'Property' : 'Properties'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KYC Input Modal */}
      <Dialog open={showKYCInputModal} onOpenChange={setShowKYCInputModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">Generate KYC Link</DialogTitle>
            <DialogDescription>
              Enter guest details to generate a personalized KYC link
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="font-playfair">Guest Name *</Label>
              <Input
                placeholder="Enter guest name"
                value={kycGuestName}
                onChange={(e) => setKycGuestName(e.target.value)}
                className="font-playfair mt-2"
              />
            </div>
            <div>
              <Label className="font-playfair">Contact (Phone/Email)</Label>
              <Input
                placeholder="Optional contact information"
                value={kycGuestContact}
                onChange={(e) => setKycGuestContact(e.target.value)}
                className="font-playfair mt-2"
              />
            </div>
            <Button
              className="w-full font-playfair"
              onClick={handleGenerateKYC}
            >
              Generate Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* KYC Modal */}
      <Dialog open={showKYCModal} onOpenChange={setShowKYCModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-playfair text-2xl">KYC Link Generated</DialogTitle>
            <DialogDescription>
              Share this unique link with your guest to collect their information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Input 
                value={kycLink} 
                readOnly 
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(kycLink);
                  toast({
                    title: 'Copied!',
                    description: 'Link copied to clipboard',
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const message = `Welcome to SuiteSpot Almaza!
We're excited to guide you through the next step.
Please fill out the short form below so we can tailor the perfect home options for your stay:
${kycLink}`;
                navigator.clipboard.writeText(message);
                toast({
                  title: 'Copied to clipboard!',
                  description: 'WhatsApp message ready to paste',
                });
              }}
            >
              Copy to WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* TODO: Remove after development - Simulation Dialog */}
      <Dialog open={simulationDialogOpen} onOpenChange={(open) => {
        setSimulationDialogOpen(open);
        if (!open) {
          // Reset simulation state when dialog closes
          setSelectedPropertiesForSimulation([]);
          setSimulationTimer(null);
          setSimulationLink('');
          setSimulationCredentials(null);
          setSimulationSessionId(null);
          setShowRevokeConfirm(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Unit Selection Simulation
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Select properties and generate a test selection landing page with live timer
            </DialogDescription>
          </DialogHeader>

          {!simulationLink ? (
            <div className="space-y-6 py-4">
              {/* Property Selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Select Properties</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllSimulationProperties}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllSimulationProperties}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {properties.map((property) => (
                    <div
                      key={property.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPropertiesForSimulation.includes(property.id)
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => toggleSimulationProperty(property.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedPropertiesForSimulation.includes(property.id)}
                          onCheckedChange={() => toggleSimulationProperty(property.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          {property.photos && property.photos.length > 0 && (
                            <img
                              src={property.photos[0]}
                              alt={property.name}
                              className="w-full h-32 object-cover rounded mb-2"
                            />
                          )}
                          <h4 className="font-semibold truncate">{property.name}</h4>
                          <div className="text-sm text-muted-foreground space-y-1 mt-2">
                            {property.beds && <p>Beds: {property.beds}</p>}
                            {property.baths && <p>Baths: {property.baths}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {selectedPropertiesForSimulation.length} {selectedPropertiesForSimulation.length === 1 ? 'property' : 'properties'} selected
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Session Status & Timer Display */}
              <div className={`rounded-lg p-6 text-center border-2 ${
                getSessionStatus() === 'expired' 
                  ? 'bg-destructive/10 border-destructive' 
                  : getSessionStatus() === 'expiring'
                  ? 'bg-amber-500/10 border-amber-500'
                  : 'bg-primary/5 border-primary/20'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className={`w-3 h-3 rounded-full ${
                    getSessionStatus() === 'expired' 
                      ? 'bg-destructive animate-pulse' 
                      : getSessionStatus() === 'expiring'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-green-500 animate-pulse'
                  }`} />
                  <h3 className="text-lg font-medium">
                    {getSessionStatus() === 'expired' 
                      ? 'Session Expired' 
                      : getSessionStatus() === 'expiring'
                      ? 'Session Expiring Soon'
                      : 'Session Active'}
                  </h3>
                </div>
                <div className={`text-5xl font-bold tracking-tight ${
                  getSessionStatus() === 'expired' 
                    ? 'text-destructive' 
                    : getSessionStatus() === 'expiring'
                    ? 'text-amber-600'
                    : 'text-primary'
                }`}>
                  {simulationTimer !== null ? formatTimer(simulationTimer) : '15:00'}
                </div>
                {simulationTimer !== null && simulationTimer > 0 && (
                  <div className="flex gap-2 justify-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={extendSimulationSession}
                      disabled={getSessionStatus() === 'expired'}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Extend +15min
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowRevokeConfirm(true)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Revoke Session
                    </Button>
                  </div>
                )}
                {simulationTimer === 0 && (
                  <p className="text-sm text-destructive mt-2 font-medium">
                    This session has been terminated and can no longer be accessed
                  </p>
                )}
              </div>

              {/* Generated Link */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Generated Selection Link</h3>
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={simulationLink}
                      readOnly
                      className="flex-1 font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copySimulationLink}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => window.open(simulationLink, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                </div>
              </div>

              {/* Credentials */}
              {simulationCredentials && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Login Credentials</h3>
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">Username</Label>
                        <p className="font-mono font-medium">{simulationCredentials.username}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Password</Label>
                        <p className="font-mono font-medium">{simulationCredentials.password}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={copySimulationCredentials}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Credentials
                    </Button>
                  </div>
                </div>
              )}

              {/* Selected Properties */}
              <div className="space-y-3">
                <h3 className="text-lg font-medium">Selected Properties ({selectedPropertiesForSimulation.length})</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <ul className="space-y-1 text-sm">
                    {selectedPropertiesForSimulation.map(id => {
                      const property = properties.find(p => p.id === id);
                      return property ? <li key={id}>• {property.name}</li> : null;
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!simulationLink ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setSimulationDialogOpen(false)}
                  disabled={generatingSimulation}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateSimulationLink}
                  disabled={generatingSimulation || selectedPropertiesForSimulation.length === 0}
                >
                  {generatingSimulation ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Link'
                  )}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setSimulationDialogOpen(false)}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Simulation Session?</DialogTitle>
            <DialogDescription>
              This will immediately terminate the session and prevent any further access to the selection landing page. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevokeConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={revokeSimulationSession}
            >
              Revoke Session
            </Button>
          </DialogFooter>
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

export default AlmazaBay;

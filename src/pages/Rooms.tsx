import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useProperty } from '@/lib/propertyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Plus, Pencil, X, Upload, Trash2, Eye, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp, Copy, Image as ImageIcon, GripVertical, ArrowLeft, BedDouble, MoreVertical, Wand2, Loader2, CloudUpload, Camera, Share2 } from 'lucide-react';
import PhotoUploadModal from '@/components/PhotoUploadModal';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { format, addDays } from 'date-fns';
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

interface PhotoRecord {
  id: string;
  photo_url: string;
  display_order: number;
}

interface RoomTypePhotoRecord extends PhotoRecord {
  room_type_name: string;
  property_id: string;
}

interface UnitPhotoRecord extends PhotoRecord {
  unit_id: string;
}

interface Reservation {
  id: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
}

interface PendingAvailabilitySync {
  id: string;
  bookingComName: string;
  unitId: string; // any unit ID with that booking_com_name for channex mapping
  newCount: number;
}

const STATUS_OPTIONS = ['available', 'occupied', 'maintenance', 'reserved'];


const Rooms = () => {
  const { user, loading, userRole, hasPermission } = useAuth();
  const propertyId = usePropertyId();
  const { activeProperty } = useProperty();
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
  const [cloneCount, setCloneCount] = useState(1);
  const [cloneRoomNumbers, setCloneRoomNumbers] = useState<string[]>(['']);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Unit | null>(null);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [currentUnitPhotos, setCurrentUnitPhotos] = useState<{ id: string; photos: string[] } | null>(null);
  const [sortField, setSortField] = useState<'unit_number' | 'unit_type' | 'view' | 'booking_com_name' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [pendingAvailabilitySync, setPendingAvailabilitySync] = useState<PendingAvailabilitySync[]>([]);
  const [isSyncingAvailability, setIsSyncingAvailability] = useState(false);
  const [roomTypePhotos, setRoomTypePhotos] = useState<Record<string, RoomTypePhotoRecord[]>>({});
  const [unitPhotosMap, setUnitPhotosMap] = useState<Record<string, UnitPhotoRecord[]>>({});
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalTarget, setPhotoModalTarget] = useState<{ type: 'room_type'; roomTypeName: string } | { type: 'unit'; unitId: string; unitName: string } | null>(null);
  const [photoModalPhotos, setPhotoModalPhotos] = useState<PhotoRecord[]>([]);

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

  // Group units by booking_com_name (room type)
  const roomTypeGroups = useMemo(() => {
    const groups = new Map<string, { units: Unit[]; representative: Unit }>();
    sortedUnits.forEach((unit) => {
      const key = unit.booking_com_name || unit.name || 'Ungrouped';
      if (!groups.has(key)) {
        groups.set(key, { units: [], representative: unit });
      }
      groups.get(key)!.units.push(unit);
    });
    return groups;
  }, [sortedUnits]);

  // Initialize expanded types when groups change
  useEffect(() => {
    if (expandedTypes.size === 0 && roomTypeGroups.size > 0) {
      setExpandedTypes(new Set(roomTypeGroups.keys()));
    }
  }, [roomTypeGroups.size]);

  const toggleType = (key: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setAllExpanded = (expanded: boolean) => {
    if (expanded) {
      setExpandedTypes(new Set(roomTypeGroups.keys()));
    } else {
      setExpandedTypes(new Set());
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
    if (!loading && user && !hasPermission('can_manage_rooms')) {
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'You do not have permission to access room management',
      });
      navigate('/admin');
    }
  }, [user, loading, hasPermission, navigate, toast]);

  useEffect(() => {
    if (user) {
      fetchUnits();
      fetchReservations();
      fetchPhotos();
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
  }, [user, propertyId]);

  const fetchUnits = async () => {
    if (!propertyId) {
      setUnits([]);
      return;
    }
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
    if (!propertyId) {
      setReservations([]);
      return;
    }
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

  const fetchPhotos = async () => {
    if (!propertyId) return;

    const [rtRes, upRes] = await Promise.all([
      supabase.from('room_type_photos').select('*').eq('property_id', propertyId).order('display_order'),
      supabase.from('unit_photos').select('*').order('display_order'),
    ]);

    if (rtRes.data) {
      const grouped: Record<string, RoomTypePhotoRecord[]> = {};
      (rtRes.data as any[]).forEach((p: any) => {
        if (!grouped[p.room_type_name]) grouped[p.room_type_name] = [];
        grouped[p.room_type_name].push(p);
      });
      setRoomTypePhotos(grouped);
    }

    if (upRes.data) {
      const grouped: Record<string, UnitPhotoRecord[]> = {};
      (upRes.data as any[]).forEach((p: any) => {
        if (!grouped[p.unit_id]) grouped[p.unit_id] = [];
        grouped[p.unit_id].push(p);
      });
      setUnitPhotosMap(grouped);
    }
  };

  // Photo modal helpers
  const openRoomTypePhotoModal = (roomTypeName: string) => {
    const existing = roomTypePhotos[roomTypeName] || [];
    setPhotoModalTarget({ type: 'room_type', roomTypeName });
    setPhotoModalPhotos(existing.map(p => ({ id: p.id, photo_url: p.photo_url, display_order: p.display_order, is_cover: !!(p as any).is_cover })));
    setPhotoModalOpen(true);
  };

  const openUnitPhotoModal = (unitId: string, unitName: string) => {
    const existing = unitPhotosMap[unitId] || [];
    setPhotoModalTarget({ type: 'unit', unitId, unitName });
    setPhotoModalPhotos(existing.map(p => ({ id: p.id, photo_url: p.photo_url, display_order: p.display_order })));
    setPhotoModalOpen(true);
  };

  const handlePhotoModalSave = async (newPhotos: PhotoRecord[]) => {
    if (!photoModalTarget || !propertyId) return;

    if (photoModalTarget.type === 'room_type') {
      // Delete old records
      await supabase.from('room_type_photos').delete().eq('property_id', propertyId).eq('room_type_name', photoModalTarget.roomTypeName);
      // Insert new
      if (newPhotos.length > 0) {
        await supabase.from('room_type_photos').insert(
          newPhotos.map((p, i) => ({
            room_type_name: photoModalTarget.roomTypeName,
            property_id: propertyId,
            photo_url: p.photo_url,
            display_order: i,
            is_cover: !!(p as any).is_cover,
          }))
        );
      }
    } else {
      // Delete old records
      await supabase.from('unit_photos').delete().eq('unit_id', photoModalTarget.unitId);
      // Insert new
      if (newPhotos.length > 0) {
        await supabase.from('unit_photos').insert(
          newPhotos.map((p, i) => ({
            unit_id: photoModalTarget.unitId,
            photo_url: p.photo_url,
            display_order: i,
          }))
        );
      }
    }

    setPhotoModalPhotos(newPhotos);
    fetchPhotos();
  };

  const handlePhotoModalDelete = async (photoId: string, photoUrl: string) => {
    // Delete from storage
    const path = photoUrl.split('/property-photos/')[1];
    if (path) {
      await supabase.storage.from('property-photos').remove([path]);
    }
  };

  const handleClearUnitPhotos = async () => {
    if (!photoModalTarget || photoModalTarget.type !== 'unit') return;
    // Delete storage files
    for (const p of photoModalPhotos) {
      const path = p.photo_url.split('/property-photos/')[1];
      if (path) await supabase.storage.from('property-photos').remove([path]);
    }
    await supabase.from('unit_photos').delete().eq('unit_id', photoModalTarget.unitId);
    setPhotoModalPhotos([]);
    fetchPhotos();
  };

  const getEffectivePhotos = (unitId: string, roomTypeName: string) => {
    const unitP = unitPhotosMap[unitId];
    if (unitP && unitP.length > 0) return { count: unitP.length, source: 'unit' as const };
    const rtP = roomTypePhotos[roomTypeName];
    if (rtP && rtP.length > 0) return { count: rtP.length, source: 'shared' as const };
    return { count: 0, source: 'none' as const };
  };

  const getPhotoModeBadge = (roomTypeName: string, typeUnits: Unit[]) => {
    const hasTypePhotos = (roomTypePhotos[roomTypeName] || []).length > 0;
    const unitsWithPhotos = typeUnits.filter(u => (unitPhotosMap[u.id] || []).length > 0);
    
    if (hasTypePhotos && unitsWithPhotos.length === 0) return { label: '📷 Type photos (shared)', variant: 'secondary' as const };
    if (!hasTypePhotos && unitsWithPhotos.length > 0 && unitsWithPhotos.length === typeUnits.length) return { label: '📷 Per-unit photos', variant: 'outline' as const };
    if (hasTypePhotos && unitsWithPhotos.length > 0) return { label: '📷 Mixed', variant: 'outline' as const };
    if (!hasTypePhotos && unitsWithPhotos.length > 0) return { label: '📷 Per-unit photos', variant: 'outline' as const };
    return null;
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

    // Queue availability sync if room has a booking_com_name
    const addedBookingComName = newUnit.booking_com_name;

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
    await fetchUnits();

    if (addedBookingComName) {
      await addToPendingAvailabilitySync(addedBookingComName);
    }
  };

  const getNextAvailableNumbers = (startFrom: number, count: number, existingNumbers: number[]): string[] => {
    const suggestions: string[] = [];
    let current = startFrom;
    while (suggestions.length < count) {
      current++;
      if (!existingNumbers.includes(current)) {
        suggestions.push(String(current));
      }
    }
    return suggestions;
  };

  const getExistingUnitNumbers = (): number[] => {
    return units.map(u => parseInt(u.unit_number || '0')).filter(n => !isNaN(n));
  };

  const handleCloneClick = (unit: Unit) => {
    setRoomToClone(unit);
    const existingNumbers = getExistingUnitNumbers();
    const currentNum = parseInt(unit.unit_number || '0') || 0;
    const suggestions = getNextAvailableNumbers(currentNum, 1, existingNumbers);
    setCloneCount(1);
    setCloneRoomNumbers(suggestions);
    setCloneDialogOpen(true);
  };

  const handleCloneCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(50, newCount));
    setCloneCount(count);
    setCloneRoomNumbers(prev => {
      const existingNumbers = getExistingUnitNumbers();
      if (count > prev.length) {
        const lastNum = parseInt(prev[prev.length - 1]) || parseInt(roomToClone?.unit_number || '0') || 0;
        const allUsed = [...existingNumbers, ...prev.map(n => parseInt(n)).filter(n => !isNaN(n))];
        const additions = getNextAvailableNumbers(lastNum, count - prev.length, allUsed);
        return [...prev, ...additions];
      }
      return prev.slice(0, count);
    });
  };

  const handleAutoFillNumbers = () => {
    if (!roomToClone) return;
    const existingNumbers = getExistingUnitNumbers();
    const currentNum = parseInt(roomToClone.unit_number || '0') || 0;
    const suggestions = getNextAvailableNumbers(currentNum, cloneCount, existingNumbers);
    setCloneRoomNumbers(suggestions);
  };

  const handleConfirmClone = async () => {
    if (!roomToClone) return;

    const trimmed = cloneRoomNumbers.map(n => n.trim());

    // Validate all filled
    const emptyIdx = trimmed.findIndex(n => !n);
    if (emptyIdx !== -1) {
      toast({ variant: 'destructive', title: 'Error', description: `Room ${emptyIdx + 1} number is required` });
      return;
    }

    // Check duplicates within form
    const dupes = trimmed.filter((n, i) => trimmed.indexOf(n) !== i);
    if (dupes.length > 0) {
      toast({ variant: 'destructive', title: 'Error', description: `Duplicate room number: ${dupes[0]}` });
      return;
    }

    // Check against existing units
    const conflict = trimmed.find(n => units.some(u => u.unit_number === n));
    if (conflict) {
      toast({ variant: 'destructive', title: 'Error', description: `Room number ${conflict} already exists` });
      return;
    }

    try {
      const clonedUnits = trimmed.map(num => ({
        name: roomToClone.name,
        unit_number: num,
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
      }));

      const { error } = await supabase.from('units').insert(clonedUnits).select();
      if (error) throw error;

      const clonedBookingComName = roomToClone.booking_com_name;

      setCloneDialogOpen(false);
      setRoomToClone(null);

      toast({
        title: 'Success',
        description: `Created ${trimmed.length} room${trimmed.length > 1 ? 's' : ''} successfully`,
      });

      await fetchUnits();

      if (clonedBookingComName) {
        await addToPendingAvailabilitySync(clonedBookingComName);
      }
    } catch (error: any) {
      console.error('Failed to clone room:', error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to clone room' });
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
      // Check if room has any active reservations
      const { data: activeReservations, error: resError } = await supabase
        .from('reservations')
        .select('id, guest_names, check_in_date, check_out_date, booking_reference, status')
        .eq('unit_id', roomToDelete.id)
        .in('status', ['confirmed', 'checked-in'])
        .limit(5);

      if (resError) throw resError;

      if (activeReservations && activeReservations.length > 0) {
        const details = activeReservations.map(r => 
          `• ${r.guest_names?.[0] || 'Guest'} — ${r.check_in_date} to ${r.check_out_date} (Ref: ${r.booking_reference}, ${r.status})`
        ).join('\n');
        toast({
          variant: 'destructive',
          title: 'Cannot Delete — Active Reservations',
          description: `This room has ${activeReservations.length} active reservation(s):\n${details}`,
        });
        console.log('Blocking reservations:', activeReservations);
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

  // Helper: add/update pending availability sync for a booking_com_name
  const addToPendingAvailabilitySync = async (bookingComName: string) => {
    if (!propertyId) return;

    // Query DB directly for accurate count (units were just inserted, React state may be stale)
    const { data: matchingUnits } = await supabase
      .from('units')
      .select('id')
      .eq('property_id', propertyId)
      .eq('booking_com_name', bookingComName)
      .neq('status', 'maintenance');

    const newCount = matchingUnits?.length || 0;
    const anyUnitId = matchingUnits?.[0]?.id;

    if (anyUnitId) {
      setPendingAvailabilitySync(prev => {
        const filtered = prev.filter(p => p.bookingComName !== bookingComName);
        return [...filtered, {
          id: crypto.randomUUID(),
          bookingComName,
          unitId: anyUnitId,
          newCount,
        }];
      });
    }
  };

  // Warn on unsaved availability sync
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingAvailabilitySync.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved availability changes that will be lost.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingAvailabilitySync.length]);

  const handleSyncAvailability = async () => {
    if (pendingAvailabilitySync.length === 0 || !propertyId) return;
    setIsSyncingAvailability(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const futureDate = format(addDays(new Date(), 500), 'yyyy-MM-dd');

      const updates = pendingAvailabilitySync.map(p => ({
        property_id: propertyId,
        room_type_id: p.unitId,
        date_from: today,
        date_to: futureDate,
        availability: p.newCount,
      }));

      const { data, error } = await supabase.functions.invoke('channex-push-availability', {
        body: { updates },
      });

      if (error) throw error;

      if (data?.success === false) {
        toast({
          title: 'Sync Failed',
          description: data.error || data.message || 'Failed to push availability',
          variant: 'destructive',
        });
        return;
      }

      setPendingAvailabilitySync([]);
      toast({
        title: 'Success',
        description: `Availability synced to Channex (${updates.length} room type${updates.length > 1 ? 's' : ''})`,
      });
    } catch (err: any) {
      console.error('Error syncing availability:', err);
      let errorMessage = 'Failed to sync availability';
      if (err.context?.body) {
        try {
          const body = JSON.parse(err.context.body);
          if (body.error) errorMessage = body.error;
        } catch { /* ignore */ }
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSyncingAvailability(false);
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

  const canManageRooms = hasPermission('can_manage_rooms');

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { color: string; label: string }> = {
      available: { color: 'bg-[hsl(var(--success))]', label: 'Available' },
      maintenance: { color: 'bg-[hsl(var(--warning))]', label: 'Maintenance' },
      blocked: { color: 'bg-destructive', label: 'Blocked' },
      occupied: { color: 'bg-[hsl(var(--info))]', label: 'Occupied' },
      reserved: { color: 'bg-[hsl(var(--status-upcoming))]', label: 'Reserved' },
    };
    const c = config[status] || { color: 'bg-muted-foreground', label: status };
    return (
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${c.color}`} />
        <span className="text-sm capitalize">{c.label}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Rooms" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SlideMenu userRole={userRole} />
              <Button variant="ghost" onClick={() => navigate('/admin')} className="md:hidden" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Rooms Management</h1>
                <p className="text-sm text-muted-foreground">
                  {roomTypeGroups.size} room type{roomTypeGroups.size !== 1 ? 's' : ''} · {units.length} total unit{units.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            {canManageRooms && (
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
                    <Button onClick={handleBulkEdit} variant="outline" size="sm" className="hidden md:flex">
                      <Pencil className="h-4 w-4 mr-2" />
                      Bulk Edit
                    </Button>
                    <Button onClick={() => setAddDialogOpen(true)} size="sm">
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

      <main className="container mx-auto px-4 py-6">
        {/* Pending Availability Sync Card */}
        {pendingAvailabilitySync.length > 0 && (
          <Card className="mb-4 border-primary/30 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CloudUpload className="h-4 w-4" />
                  Pending Availability Sync
                  <Badge variant="secondary" className="text-xs">{pendingAvailabilitySync.length}</Badge>
                </CardTitle>
                <CardDescription>New room counts need to be synced to Channex</CardDescription>
              </div>
              <Button onClick={handleSyncAvailability} disabled={isSyncingAvailability} size="sm">
                {isSyncingAvailability ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes ({pendingAvailabilitySync.length})
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingAvailabilitySync.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{p.bookingComName}</div>
                    <Badge variant="secondary" className="text-xs">
                      Availability: {p.newCount} room{p.newCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingAvailabilitySync(prev => prev.filter(x => x.id !== p.id))}
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {isBulkEdit && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium">
              💡 Bulk Edit Mode: All changes will be saved when you click "Save All".
            </p>
          </div>
        )}

        {/* Expand/Collapse controls */}
        {roomTypeGroups.size > 0 && !isBulkEdit && (
          <div className="flex gap-2 mb-4">
            <Button variant="ghost" size="sm" onClick={() => setAllExpanded(true)}>
              <ChevronsDown className="h-4 w-4 mr-1" /> Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAllExpanded(false)}>
              <ChevronsUp className="h-4 w-4 mr-1" /> Collapse All
            </Button>
          </div>
        )}

        {/* Empty state */}
        {units.length === 0 && (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <BedDouble className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">No Room Types Yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first room type to start managing your inventory
                </p>
              </div>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Room
              </Button>
            </div>
          </Card>
        )}

        {/* Room Type Cards */}
        <div className="space-y-4">
          {Array.from(roomTypeGroups.entries()).map(([typeName, { units: typeUnits, representative }]) => {
            const isExpanded = expandedTypes.has(typeName);
            const photoBadge = getPhotoModeBadge(typeName, typeUnits);
            return (
              <Card key={typeName}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleType(typeName)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          <div>
                            <CardTitle className="text-lg">{typeName}</CardTitle>
                            <CardDescription className="text-sm mt-0.5">
                              {[
                                representative.unit_size ? `${representative.unit_size}` : null,
                                representative.beds ? `${representative.beds} bed${representative.beds > 1 ? 's' : ''}` : null,
                                representative.baths ? `${representative.baths} bath${representative.baths > 1 ? 's' : ''}` : null,
                                representative.max_guests ? `${representative.max_guests} guests max` : null,
                              ].filter(Boolean).join(' · ') || 'No details set'}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {photoBadge && <Badge variant={photoBadge.variant} className="text-xs">{photoBadge.label}</Badge>}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); openRoomTypePhotoModal(typeName); }}
                            title="Manage room type photos"
                          >
                            <Camera className="h-4 w-4" />
                          </Button>
                          <Badge variant="secondary">{typeUnits.length} unit{typeUnits.length !== 1 ? 's' : ''}</Badge>
                          {representative.unit_type && <Badge variant="outline">{representative.unit_type}</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      {/* Desktop table */}
                      <div className="hidden md:block rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-10 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">#</TableHead>
                              <TableHead className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Unit Name</TableHead>
                              <TableHead className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Room #</TableHead>
                              <TableHead className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">View</TableHead>
                              <TableHead className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground text-center">Photos</TableHead>
                              <TableHead className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</TableHead>
                              {canManageRooms && <TableHead className="w-28 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {typeUnits.map((unit, index) => {
                              const isEditing = isBulkEdit || editingId === unit.id;
                              return (
                                <TableRow key={unit.id} className="h-10 hover:bg-muted/50 even:bg-muted/20">
                                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">{index + 1}</TableCell>
                                  <TableCell className="px-3 py-2 text-sm font-medium">
                                    {isEditing ? (
                                      <Input
                                        className="w-full h-8 text-sm"
                                        value={isBulkEdit ? (bulkEditUnits[unit.id]?.name || '') : (editedUnit.name || '')}
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
                                  <TableCell className="px-3 py-2 text-sm">
                                    {isEditing ? (
                                      <Input
                                        className="w-full h-8 text-sm"
                                        value={isBulkEdit ? (bulkEditUnits[unit.id]?.unit_number || '') : (editedUnit.unit_number || '')}
                                        onChange={(e) =>
                                          isBulkEdit
                                            ? handleBulkEditChange(unit.id, 'unit_number', e.target.value)
                                            : setEditedUnit({ ...editedUnit, unit_number: e.target.value })
                                        }
                                      />
                                    ) : (
                                      unit.unit_number || '—'
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                                    {isEditing ? (
                                      <Input
                                        className="w-full h-8 text-sm"
                                        value={isBulkEdit ? (bulkEditUnits[unit.id]?.view || '') : (editedUnit.view || '')}
                                        onChange={(e) =>
                                          isBulkEdit
                                            ? handleBulkEditChange(unit.id, 'view', e.target.value)
                                            : setEditedUnit({ ...editedUnit, view: e.target.value })
                                        }
                                      />
                                    ) : (
                                      unit.view || '—'
                                    )}
                                  </TableCell>
                                  <TableCell className="px-3 py-2 text-center">
                                    {(() => {
                                      const ep = getEffectivePhotos(unit.id, typeName);
                                      return (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 gap-1 text-sm"
                                          onClick={() => openUnitPhotoModal(unit.id, unit.name)}
                                        >
                                          <Camera className="h-3.5 w-3.5" />
                                          <span className="tabular-nums">{ep.count}</span>
                                          {ep.source === 'shared' && (
                                            <Share2 className="h-3 w-3 text-muted-foreground" />
                                          )}
                                        </Button>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell className="px-3 py-2">
                                    {isEditing ? (
                                      <Select
                                        value={isBulkEdit ? bulkEditUnits[unit.id]?.status : editedUnit.status}
                                        onValueChange={(value) =>
                                          isBulkEdit
                                            ? handleBulkEditChange(unit.id, 'status', value)
                                            : setEditedUnit({ ...editedUnit, status: value })
                                        }
                                      >
                                        <SelectTrigger className="w-full h-8 text-sm">
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
                                      <StatusBadge status={unit.status} />
                                    )}
                                  </TableCell>
                                  {canManageRooms && (
                                    <TableCell className="px-3 py-2">
                                      {editingId === unit.id ? (
                                        <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
                                            <Save className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit}>
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          {!isBulkEdit && (
                                            <>
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(unit)}>
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/property-media/${unit.id}`)} title="Photos">
                                                <ImageIcon className="h-3.5 w-3.5" />
                                              </Button>
                                            </>
                                          )}
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCloneClick(unit)} title="Clone">
                                            <Copy className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(unit)} title="Delete">
                                            <Trash2 className="h-3.5 w-3.5" />
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

                      {/* Mobile card list */}
                      <div className="md:hidden space-y-2">
                        {typeUnits.map((unit) => (
                          <div key={unit.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div>
                              <div className="font-medium text-sm">{unit.name}</div>
                              <div className="text-xs text-muted-foreground">
                                #{unit.unit_number || '—'} · {unit.view || 'No view set'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={unit.status} />
                              {canManageRooms && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(unit)}>Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate(`/property-media/${unit.id}`)}>Photos</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCloneClick(unit)}>Clone</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClick(unit)}>Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Room type footer actions */}
                      {canManageRooms && (
                        <div className="flex gap-2 mt-4 pt-4 border-t">
                          <Button variant="outline" size="sm" onClick={() => {
                            handleCloneClick(representative);
                          }}>
                            <Plus className="h-4 w-4 mr-1" /> Add Unit
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </main>

      {/* Clone Confirmation Dialog */}
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Room</DialogTitle>
            <DialogDescription>
              Create copies of this room with all its specifications.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1 text-sm bg-muted p-4 rounded-lg">
              <p><span className="font-medium">Room Name:</span> {roomToClone?.name}</p>
              <p><span className="font-medium">Current Room #:</span> {roomToClone?.unit_number || 'N/A'}</p>
              <p><span className="font-medium">Type:</span> {roomToClone?.unit_type || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloneCount">
                Number of Rooms to Clone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cloneCount"
                type="number"
                min={1}
                max={50}
                value={cloneCount}
                onChange={(e) => handleCloneCountChange(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  New Room Numbers <span className="text-destructive">*</span>
                </Label>
                <Button variant="ghost" size="sm" onClick={handleAutoFillNumbers} className="text-xs h-7">
                  <Wand2 className="h-3 w-3 mr-1" /> Auto-Fill
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {cloneRoomNumbers.map((num, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Label className="w-16 text-sm text-muted-foreground shrink-0">
                      Room {index + 1}:
                    </Label>
                    <Input
                      type="text"
                      value={num}
                      onChange={(e) => {
                        const newNumbers = [...cloneRoomNumbers];
                        newNumbers[index] = e.target.value;
                        setCloneRoomNumbers(newNumbers);
                      }}
                      placeholder="e.g., 103"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCloneDialogOpen(false);
                setRoomToClone(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmClone}>
              Clone {cloneCount} Room{cloneCount > 1 ? 's' : ''}
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

      {/* Photo Upload Modal (room type or unit level) */}
      <PhotoUploadModal
        open={photoModalOpen}
        onOpenChange={(open) => { setPhotoModalOpen(open); if (!open) setPhotoModalTarget(null); }}
        title={
          photoModalTarget?.type === 'room_type'
            ? `Photos for ${photoModalTarget.roomTypeName}`
            : photoModalTarget?.type === 'unit'
            ? `Photos for ${photoModalTarget.unitName}`
            : 'Photos'
        }
        description={
          photoModalTarget?.type === 'room_type'
            ? 'These photos will be used for all units of this type unless a unit has its own photos.'
            : 'These photos override the room type photos for this unit only.'
        }
        photos={photoModalPhotos}
        storagePath={
          photoModalTarget?.type === 'room_type'
            ? `room-types/${propertyId}/${photoModalTarget.roomTypeName}`
            : photoModalTarget?.type === 'unit'
            ? `units/${photoModalTarget.unitId}`
            : ''
        }
        seoPrefix={activeProperty?.name?.toLowerCase().replace(/\s+/g, '-') || 'property'}
        seoSlug={
          photoModalTarget?.type === 'room_type'
            ? photoModalTarget.roomTypeName?.toLowerCase().replace(/\s+/g, '-')
            : photoModalTarget?.type === 'unit'
            ? photoModalTarget.unitName?.toLowerCase().replace(/\s+/g, '-')
            : undefined
        }
        onPhotosChange={(newPhotos) => {
          setPhotoModalPhotos(newPhotos);
          handlePhotoModalSave(newPhotos);
        }}
        onDeletePhoto={handlePhotoModalDelete}
        onClearAll={photoModalTarget?.type === 'unit' ? handleClearUnitPhotos : undefined}
        clearAllLabel="Clear unit photos (use type photos instead)"
      />
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

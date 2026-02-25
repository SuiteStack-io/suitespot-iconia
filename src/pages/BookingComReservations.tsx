import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, Loader2, CheckCircle, AlertTriangle, ArrowLeft, Download, Check, ArrowLeftRight, Plus, X, CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import suitespotLogo from '@/assets/suitespot-logo.png';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, differenceInCalendarDays, addDays, parseISO } from 'date-fns';

interface RoomInfo {
  roomName: string;
  price: number;
  unitId?: string;
  matchedUnitName?: string;
  status?: 'available' | 'reserved' | 'blocked' | 'no_match';
  warning?: string;
}

interface ParsedReservation {
  bookingReference: string;
  guestNames: string[];
  checkInDate: string;
  checkOutDate: string;
  roomName: string;
  rooms?: { roomName: string; price: number }[];
  matchedRooms?: RoomInfo[];
  isMultiRoom?: boolean;
  numberOfGuests: number;
  contactEmail?: string;
  contactPhone?: string;
  totalPrice?: number;
  currency?: string;
  adults?: number;
  children?: number;
  notes?: string;
  unitId?: string;
  nights?: number;
  commissionableAmount?: number;
  commissionAmount?: number;
  nationality?: string;
  preferredLanguage?: string;
  blockedUnitWarning?: string;
  isModification?: boolean;
  changeCount?: number;
}

interface RoomAssignment {
  roomIndex: number;
  roomName: string;
  price: number;
  unitId: string | null;
}

interface SplitStaySegment {
  id: string;
  startDate: Date;
  endDate: Date;
  unitId: string | null;
}

const BookingComReservations = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedReservation | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [creating, setCreating] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<{
    guestNames: string[];
    bookingReference: string;
    checkIn: string;
    checkOut: string;
    roomName: string;
    originalUnitType: string;
    roomIndex?: number;
  } | null>(null);
  const [sameTypeAlternatives, setSameTypeAlternatives] = useState<any[]>([]);
  const [otherAlternatives, setOtherAlternatives] = useState<any[]>([]);
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string>('');
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [unitsWithStatus, setUnitsWithStatus] = useState<{
    id: string;
    name: string;
    unit_number: string;
    unit_type: string;
    booking_com_name: string | null;
    status: 'available' | 'reserved' | 'blocked';
  }[]>([]);
  const [loadingUnitsStatus, setLoadingUnitsStatus] = useState(false);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [existingReservation, setExistingReservation] = useState<{
    id: string;
    guest_names: string[];
    check_in_date: string;
    check_out_date: string;
  } | null>(null);
  const reservationCardRef = useRef<HTMLDivElement>(null);
  
  // Multi-room state
  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([]);
  
  // Split-stay state
  const [isSplitStay, setIsSplitStay] = useState(false);
  const [splitSegments, setSplitSegments] = useState<SplitStaySegment[]>([]);
  const [segmentAvailability, setSegmentAvailability] = useState<Record<string, {
    id: string;
    name: string;
    unit_number: string;
    booking_com_name: string | null;
    status: 'available' | 'reserved' | 'blocked';
  }[]>>({});
  const [loadingSegmentAvailability, setLoadingSegmentAvailability] = useState<Record<string, boolean>>({});

  // Modification mode state
  const [isModificationMode, setIsModificationMode] = useState(false);
  const [existingReservationsToUpdate, setExistingReservationsToUpdate] = useState<any[]>([]);
  const [originalReservationData, setOriginalReservationData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('location', 'ICONIA')
      .order('name');
    
    if (error) {
      console.error('Error fetching units:', error);
    } else {
      setUnits(data || []);
    }
  };

  const fetchUnitsWithStatus = async (checkIn: string, checkOut: string, excludeReservationIds: string[] = []) => {
    setLoadingUnitsStatus(true);
    try {
      const { data: allUnits } = await supabase
        .from('units')
        .select('id, name, unit_number, unit_type, booking_com_name')
        .eq('location', 'ICONIA')
        .order('name');

      const unitsChecked = await Promise.all(
        (allUnits || []).map(async (unit) => {
          // Check for conflicts, excluding the reservation(s) being modified
          const { data: conflicts } = await supabase.rpc('check_reservation_overlap', {
            p_unit_id: unit.id,
            p_check_in_date: checkIn,
            p_check_out_date: checkOut,
            p_exclude_id: excludeReservationIds[0] || null
          });

          // Filter out any additional excluded reservation IDs (for multi-room modifications)
          const filteredConflicts = (conflicts || []).filter(
            (c: any) => !excludeReservationIds.includes(c.conflict_id)
          );

          // Check for blocked dates
          const { data: blockedDates } = await supabase
            .from('blocked_dates')
            .select('id')
            .eq('unit_id', unit.id)
            .gte('blocked_date', checkIn)
            .lt('blocked_date', checkOut);

          let status: 'available' | 'reserved' | 'blocked' = 'available';
          if (filteredConflicts.length > 0) status = 'reserved';
          else if (blockedDates && blockedDates.length > 0) status = 'blocked';

          return { ...unit, status };
        })
      );

      // Sort: available first, then reserved, then blocked
      unitsChecked.sort((a, b) => {
        const order = { available: 0, reserved: 1, blocked: 2 };
        return order[a.status] - order[b.status];
      });

      setUnitsWithStatus(unitsChecked);
    } catch (error) {
      console.error('Error fetching units with status:', error);
    } finally {
      setLoadingUnitsStatus(false);
    }
  };

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadComplete(false);
    setScreenshotFile(file);
    setRoomAssignments([]); // Reset room assignments

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setUploadProgress(30);
          const base64 = event.target?.result?.toString().split(',')[1];
          
          if (!base64) {
            throw new Error('Failed to read file');
          }

          setUploadProgress(50);
          
          // Call edge function to parse
          const { data, error } = await supabase.functions.invoke('parse-reservation-screenshot', {
            body: { imageBase64: base64 }
          });

          setUploadProgress(80);

          if (error) throw error;

          if (data.success) {
            setUploadProgress(100);
            setUploadComplete(true);
            
            // Check if booking already exists
            const { data: existing } = await supabase
              .from('reservations')
              .select('*')
              .eq('booking_reference', data.data.bookingReference)
              .neq('status', 'cancelled');

            // If exists and this is a modification screenshot
            if (existing && existing.length > 0 && data.data.isModification) {
              setIsModificationMode(true);
              setExistingReservationsToUpdate(existing);
              setOriginalReservationData(existing[0]); // For comparison display
              setExistingReservation(null); // Don't show the error alert
              
              // Clear the blockedUnitWarning since the edge function 
              // couldn't exclude the existing reservation during parsing.
              // The frontend's fetchUnitsWithStatus will correctly handle this.
              data.data.blockedUnitWarning = null;
              
              // For multi-room modifications, also clear individual room warnings
              if (data.data.matchedRooms) {
                data.data.matchedRooms = data.data.matchedRooms.map((room: RoomInfo, index: number) => ({
                  ...room,
                  warning: null,
                  // Pre-assign the existing unit for this room
                  unitId: existing[index]?.unit_id || room.unitId || null
                }));
              }
            } else {
              setExistingReservation(existing?.[0] || null);
              setIsModificationMode(false);
              setExistingReservationsToUpdate([]);
              setOriginalReservationData(null);
            }
            
            // Initialize room assignments from matched rooms
            if (data.data.matchedRooms && data.data.matchedRooms.length > 0) {
              const initialAssignments: RoomAssignment[] = data.data.matchedRooms.map((room: RoomInfo, index: number) => ({
                roomIndex: index,
                roomName: room.roomName,
                price: room.price,
                // In modification mode, use the existing reservation's unit
                unitId: (data.data.isModification && existing && existing[index]) 
                  ? existing[index].unit_id 
                  : (room.unitId || null)
              }));
              setRoomAssignments(initialAssignments);
            }
            
            setTimeout(() => {
              setParsedData(data.data);
              setShowPreview(true);
              setUploadComplete(false);
              setUploading(false);
              // Fetch units with status for manual room selection
              // In modification mode, exclude the existing reservations from conflict detection
              if (data.data?.checkInDate && data.data?.checkOutDate) {
                const excludeIds = (existing && existing.length > 0 && data.data.isModification)
                  ? existing.map((r: any) => r.id)
                  : [];
                fetchUnitsWithStatus(data.data.checkInDate, data.data.checkOutDate, excludeIds);
              }
            }, 1000);
          } else {
            throw new Error(data.error || 'Failed to parse reservation');
          }
        } catch (error: any) {
          console.error('Error parsing screenshot:', error);
          setUploadProgress(0);
          setUploadComplete(false);
          setUploading(false);
          toast({
            title: 'Error',
            description: error.message || 'Failed to parse reservation screenshot',
            variant: 'destructive',
          });
        }
      };

      reader.onerror = () => {
        setUploadProgress(0);
        setUploadComplete(false);
        setUploading(false);
        toast({
          title: 'Error',
          description: 'Failed to read file',
          variant: 'destructive',
        });
      };

      setUploadProgress(10);
      reader.readAsDataURL(file);

    } catch (error: any) {
      console.error('Error processing file:', error);
      setUploadProgress(0);
      setUploadComplete(false);
      setUploading(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to process file',
        variant: 'destructive',
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    
    await processFile(file);
  };

  const updateRoomAssignment = (roomIndex: number, unitId: string | null) => {
    setRoomAssignments(prev => 
      prev.map(r => r.roomIndex === roomIndex ? { ...r, unitId } : r)
    );
  };

  const getAssignedUnitIds = () => {
    return roomAssignments.filter(r => r.unitId).map(r => r.unitId!);
  };

  // Split-stay helper functions
  const fetchAvailabilityForSegment = async (segmentId: string, startDate: Date, endDate: Date, excludeReservationIds: string[] = []) => {
    setLoadingSegmentAvailability(prev => ({ ...prev, [segmentId]: true }));
    
    try {
      const checkIn = format(startDate, 'yyyy-MM-dd');
      const checkOut = format(endDate, 'yyyy-MM-dd');
      
      const { data: allUnits } = await supabase
        .from('units')
        .select('id, name, unit_number, unit_type, booking_com_name')
        .eq('location', 'ICONIA')
        .order('name');

      const unitsChecked = await Promise.all(
        (allUnits || []).map(async (unit) => {
          // Check for conflicts in this segment's date range, excluding reservations being modified
          const { data: conflicts } = await supabase.rpc('check_reservation_overlap', {
            p_unit_id: unit.id,
            p_check_in_date: checkIn,
            p_check_out_date: checkOut,
            p_exclude_id: excludeReservationIds[0] || null
          });

          // Filter out any additional excluded reservation IDs
          const filteredConflicts = (conflicts || []).filter(
            (c: any) => !excludeReservationIds.includes(c.conflict_id)
          );

          // Check for blocked dates in this segment's date range
          const { data: blockedDates } = await supabase
            .from('blocked_dates')
            .select('id')
            .eq('unit_id', unit.id)
            .gte('blocked_date', checkIn)
            .lt('blocked_date', checkOut);

          let status: 'available' | 'reserved' | 'blocked' = 'available';
          if (filteredConflicts.length > 0) status = 'reserved';
          else if (blockedDates && blockedDates.length > 0) status = 'blocked';

          return { ...unit, status };
        })
      );

      // Sort: available first, then reserved, then blocked
      unitsChecked.sort((a, b) => {
        const order = { available: 0, reserved: 1, blocked: 2 };
        return order[a.status] - order[b.status];
      });

      setSegmentAvailability(prev => ({ ...prev, [segmentId]: unitsChecked }));
    } catch (error) {
      console.error('Error fetching segment availability:', error);
    } finally {
      setLoadingSegmentAvailability(prev => ({ ...prev, [segmentId]: false }));
    }
  };

  const initializeSplitStay = () => {
    if (!parsedData) return;
    const segment = {
      id: crypto.randomUUID(),
      startDate: parseISO(parsedData.checkInDate),
      endDate: parseISO(parsedData.checkOutDate),
      unitId: roomAssignments[0]?.unitId || null
    };
    setSplitSegments([segment]);
    fetchAvailabilityForSegment(segment.id, segment.startDate, segment.endDate);
  };

  const addSegment = () => {
    if (!parsedData || splitSegments.length === 0) return;
    const lastSegment = splitSegments[splitSegments.length - 1];
    const daysInLastSegment = differenceInCalendarDays(lastSegment.endDate, lastSegment.startDate);
    const totalNightsUsed = getTotalSegmentNights();
    const totalNightsAvailable = parsedData?.nights || 0;
    
    // Cannot add if no nights remaining
    if (totalNightsUsed >= totalNightsAvailable) return;
    
    const checkoutDate = parseISO(parsedData.checkOutDate);
    
    if (daysInLastSegment >= 2) {
      // Split the last segment in half (existing behavior)
      const midpoint = addDays(lastSegment.startDate, Math.floor(daysInLastSegment / 2));
      
      const modifiedLastSegment = { ...lastSegment, endDate: midpoint };
      const newSegment = {
        id: crypto.randomUUID(),
        startDate: midpoint,
        endDate: lastSegment.endDate,
        unitId: null
      };
      
      setSplitSegments([
        ...splitSegments.slice(0, -1),
        modifiedLastSegment,
        newSegment
      ]);
      
      // Fetch availability for both affected segments
      fetchAvailabilityForSegment(modifiedLastSegment.id, modifiedLastSegment.startDate, modifiedLastSegment.endDate);
      fetchAvailabilityForSegment(newSegment.id, newSegment.startDate, newSegment.endDate);
    } else {
      // Last segment has 1 night - add a new segment for remaining nights
      const newSegment = {
        id: crypto.randomUUID(),
        startDate: lastSegment.endDate,
        endDate: checkoutDate,
        unitId: null
      };
      
      setSplitSegments([...splitSegments, newSegment]);
      fetchAvailabilityForSegment(newSegment.id, newSegment.startDate, newSegment.endDate);
    }
  };

  const removeSegment = (id: string) => {
    if (splitSegments.length <= 1) return;
    const index = splitSegments.findIndex(s => s.id === id);
    
    const newSegments = [...splitSegments];
    if (index > 0) {
      newSegments[index - 1].endDate = newSegments[index].endDate;
    } else if (newSegments.length > 1) {
      newSegments[1].startDate = newSegments[0].startDate;
    }
    newSegments.splice(index, 1);
    setSplitSegments(newSegments);
  };

  const updateSegmentDate = (id: string, field: 'startDate' | 'endDate', date: Date) => {
    setSplitSegments(segments => {
      const index = segments.findIndex(s => s.id === id);
      const updated = [...segments];
      updated[index] = { ...updated[index], [field]: date };
      
      // Ensure consecutive dates
      if (field === 'endDate' && index < segments.length - 1) {
        updated[index + 1].startDate = date;
        // Fetch availability for the adjacent segment too
        fetchAvailabilityForSegment(updated[index + 1].id, date, updated[index + 1].endDate);
      } else if (field === 'startDate' && index > 0) {
        updated[index - 1].endDate = date;
        // Fetch availability for the adjacent segment too
        fetchAvailabilityForSegment(updated[index - 1].id, updated[index - 1].startDate, date);
      }
      
      // Fetch availability for the current segment
      fetchAvailabilityForSegment(id, updated[index].startDate, updated[index].endDate);
      
      return updated;
    });
  };

  const updateSegmentRoom = (id: string, unitId: string) => {
    setSplitSegments(segments =>
      segments.map(s => s.id === id ? { ...s, unitId } : s)
    );
  };

  const getTotalSegmentNights = () => {
    return splitSegments.reduce((total, seg) => 
      total + differenceInCalendarDays(seg.endDate, seg.startDate), 0
    );
  };

  const validateSplitSegments = (): { valid: boolean; error?: string } => {
    if (splitSegments.length === 0) {
      return { valid: false, error: 'No segments defined' };
    }

    // Check all segments have rooms assigned
    const unassignedSegments = splitSegments.filter(s => !s.unitId);
    if (unassignedSegments.length > 0) {
      return { valid: false, error: `Please assign rooms to all ${unassignedSegments.length} unassigned segment(s)` };
    }

    // Check for invalid date ranges (end before or equal to start)
    for (let i = 0; i < splitSegments.length; i++) {
      const segment = splitSegments[i];
      const nights = differenceInCalendarDays(segment.endDate, segment.startDate);
      if (nights <= 0) {
        return { valid: false, error: `Segment ${i + 1} has invalid dates: end date must be after start date` };
      }
    }

    // Check for gaps or overlaps between consecutive segments
    for (let i = 0; i < splitSegments.length - 1; i++) {
      const current = splitSegments[i];
      const next = splitSegments[i + 1];
      const currentEndTime = current.endDate.getTime();
      const nextStartTime = next.startDate.getTime();

      if (currentEndTime !== nextStartTime) {
        if (currentEndTime > nextStartTime) {
          return { valid: false, error: `Segments ${i + 1} and ${i + 2} have overlapping dates` };
        } else {
          return { valid: false, error: `There is a gap between segments ${i + 1} and ${i + 2}` };
        }
      }
    }

    // Check total nights match booking
    const totalAllocated = getTotalSegmentNights();
    const totalRequired = parsedData?.nights || 0;
    if (totalAllocated !== totalRequired) {
      return { valid: false, error: `Total segment nights (${totalAllocated}) must equal booking nights (${totalRequired})` };
    }

    // Check first segment starts on check-in date
    if (parsedData) {
      const checkInDate = parseISO(parsedData.checkInDate);
      if (splitSegments[0].startDate.getTime() !== checkInDate.getTime()) {
        return { valid: false, error: 'First segment must start on the check-in date' };
      }

      // Check last segment ends on check-out date
      const checkOutDate = parseISO(parsedData.checkOutDate);
      const lastSegment = splitSegments[splitSegments.length - 1];
      if (lastSegment.endDate.getTime() !== checkOutDate.getTime()) {
        return { valid: false, error: 'Last segment must end on the check-out date' };
      }
    }

    return { valid: true };
  };

  const allSegmentsValid = () => {
    return splitSegments.length > 0 && 
      splitSegments.every(s => s.unitId) && 
      getTotalSegmentNights() === (parsedData?.nights || 0);
  };

  const createSingleReservation = async (
    roomAssignment: RoomAssignment,
    screenshotUrl: string | null,
    isPartOfMultiRoom: boolean = false
  ) => {
    if (!parsedData) return null;

    const unitId = roomAssignment.unitId!;
    
    // Check for blocked dates first
    const { data: blockedDates, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('id, blocked_date, reason')
      .eq('unit_id', unitId)
      .gte('blocked_date', parsedData.checkInDate)
      .lt('blocked_date', parsedData.checkOutDate);

    if (blockedError) {
      console.error('Error checking blocked dates:', blockedError);
    }

    // Check for overlapping reservations
    const { data: conflicts, error: conflictCheckError } = await supabase
      .rpc('check_reservation_overlap', {
        p_unit_id: unitId,
        p_check_in_date: parsedData.checkInDate,
        p_check_out_date: parsedData.checkOutDate
      });

    if (conflictCheckError) {
      console.error('Error checking for conflicts:', conflictCheckError);
      throw new Error('Failed to check for reservation conflicts');
    }

    const hasBlockedDates = blockedDates && blockedDates.length > 0;
    const hasConflicts = conflicts && conflicts.length > 0;

    if (hasBlockedDates || hasConflicts) {
      throw new Error(`Room ${getUnitName(unitId)} has conflicts or blocked dates`);
    }

    // Calculate price per night for this room
    const checkIn = new Date(parsedData.checkInDate);
    const checkOut = new Date(parsedData.checkOutDate);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const pricePerNight = roomAssignment.price && nights > 0 ? roomAssignment.price / nights : null;
    
    // For multi-room: split commission proportionally
    const totalPrice = parsedData.totalPrice || 0;
    const roomPriceRatio = totalPrice > 0 ? roomAssignment.price / totalPrice : 1;
    const roomCommissionAmount = parsedData.commissionAmount 
      ? parsedData.commissionAmount * roomPriceRatio 
      : null;
    const roomCommissionableAmount = parsedData.commissionableAmount 
      ? parsedData.commissionableAmount * roomPriceRatio 
      : null;
    
    // Calculate commission rate
    const commissionRate = roomCommissionAmount && roomAssignment.price 
      ? (roomCommissionAmount / roomAssignment.price) * 100 
      : null;

    // Create reservation
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        booking_reference: parsedData.bookingReference,
        guest_names: parsedData.guestNames || [],
        guest_nationality: parsedData.nationality || null,
        check_in_date: parsedData.checkInDate,
        check_out_date: parsedData.checkOutDate,
        unit_id: unitId,
        number_of_guests: isPartOfMultiRoom 
          ? Math.ceil(parsedData.numberOfGuests / roomAssignments.length) 
          : parsedData.numberOfGuests,
        contact_email: parsedData.contactEmail,
        contact_phone: parsedData.contactPhone,
        total_price: roomAssignment.price,
        price_per_night: pricePerNight,
        currency: parsedData.currency || 'USD',
        adults: parsedData.adults || parsedData.numberOfGuests,
        children: parsedData.children || 0,
        commission_rate: commissionRate,
        commission_amount: roomCommissionAmount,
        net_revenue: roomCommissionableAmount,
        notes: parsedData.notes,
        status: 'confirmed',
        source: 'booking.com',
        channel: 'Booking.com',
        preferred_language: parsedData.preferredLanguage || null,
        booking_screenshot_url: screenshotUrl
      })
      .select()
      .single();

    if (reservationError) throw reservationError;

    return reservation;
  };

  const createReservationWithUnit = async (unitId: string, unitName: string) => {
    if (!parsedData) return;

    try {
      // Check for blocked dates first
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('id, blocked_date, reason')
        .eq('unit_id', unitId)
        .gte('blocked_date', parsedData.checkInDate)
        .lt('blocked_date', parsedData.checkOutDate);

      if (blockedError) {
        console.error('Error checking blocked dates:', blockedError);
      }

      // Check for overlapping reservations using database function
      const { data: conflicts, error: conflictCheckError } = await supabase
        .rpc('check_reservation_overlap', {
          p_unit_id: unitId,
          p_check_in_date: parsedData.checkInDate,
          p_check_out_date: parsedData.checkOutDate
        });

      if (conflictCheckError) {
        console.error('Error checking for conflicts:', conflictCheckError);
        toast({
          title: "Error",
          description: "Failed to check for reservation conflicts",
          variant: "destructive",
        });
        setCreating(false);
        return;
      }

      const hasBlockedDates = blockedDates && blockedDates.length > 0;
      const hasConflicts = conflicts && conflicts.length > 0;

      if (hasBlockedDates || hasConflicts) {
        setCreating(false);
        
        // Get the original unit's type
        const originalUnit = units.find(u => u.id === unitId);
        const originalUnitType = originalUnit?.unit_type;
        
        // Fetch all units
        const { data: allUnits } = await supabase
          .from('units')
          .select('id, name, unit_number, unit_type')
          .eq('status', 'available')
          .neq('id', unitId)
          .order('unit_number');
        
        // Check availability for each unit on these specific dates (conflicts AND blocked dates)
        const availableUnitsChecked = await Promise.all(
          (allUnits || []).map(async (unit) => {
            // Check conflicts
            const { data: unitConflicts } = await supabase.rpc('check_reservation_overlap', {
              p_unit_id: unit.id,
              p_check_in_date: parsedData.checkInDate,
              p_check_out_date: parsedData.checkOutDate
            });
            
            // Check blocked dates
            const { data: unitBlockedDates } = await supabase
              .from('blocked_dates')
              .select('id')
              .eq('unit_id', unit.id)
              .gte('blocked_date', parsedData.checkInDate)
              .lt('blocked_date', parsedData.checkOutDate);
            
            return { 
              ...unit, 
              hasConflict: unitConflicts && unitConflicts.length > 0,
              hasBlockedDates: unitBlockedDates && unitBlockedDates.length > 0
            };
          })
        );
        
        // Filter to only units with NO conflicts AND NO blocked dates
        const availableUnits = availableUnitsChecked.filter(u => !u.hasConflict && !u.hasBlockedDates);
        
        // Split into same-type and other alternatives
        const sameType = availableUnits.filter(u => u.unit_type === originalUnitType);
        const others = availableUnits.filter(u => u.unit_type !== originalUnitType);
        
        // Store conflict information
        const issueType = hasBlockedDates ? 'blocked dates' : 'conflicting reservation';
        setConflictInfo({
          guestNames: hasConflicts && conflicts[0] ? conflicts[0].conflict_guest_names : ['N/A'],
          bookingReference: hasConflicts && conflicts[0] ? conflicts[0].conflict_reference : 'Blocked',
          checkIn: hasConflicts && conflicts[0] ? conflicts[0].conflict_check_in : parsedData.checkInDate,
          checkOut: hasConflicts && conflicts[0] ? conflicts[0].conflict_check_out : parsedData.checkOutDate,
          roomName: originalUnit?.name || 'Unknown room',
          originalUnitType: originalUnitType || 'Unknown type'
        });
        setSameTypeAlternatives(sameType);
        setOtherAlternatives(others);
        setSelectedAlternativeId(sameType.length > 0 ? sameType[0].id : '');
        setShowConflictDialog(true);
        
        // Log the conflict for admin review
        await supabase.from('notifications').insert([{
          type: 'error',
          title: hasBlockedDates ? 'Blocked Unit Assignment Prevented' : 'Double Booking Detected',
          message: `Room ${getUnitName(unitId)} has ${issueType} for ${parsedData.checkInDate} to ${parsedData.checkOutDate}. New booking: ${parsedData.guestNames.join(', ')} (${parsedData.bookingReference}). ${availableUnits.length} alternative rooms available.`,
          metadata: {
            event_type: hasBlockedDates ? 'blocked_unit_prevented' : 'double_booking_detected',
            conflicts: conflicts,
            blocked_dates: blockedDates
          } as any
        }]);
        
        return;
      }
      // Upload screenshot to storage first
      let screenshotUrl: string | null = null;
      if (screenshotFile) {
        const fileExt = screenshotFile.name.split('.').pop();
        const fileName = `${parsedData.bookingReference}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('booking-screenshots')
          .upload(filePath, screenshotFile);

        if (uploadError) {
          console.error('Error uploading screenshot:', uploadError);
          // Continue anyway, screenshot is not critical
        } else {
          // Store just the file path, not the public URL (bucket is private)
          screenshotUrl = filePath;
        }
      }

      // Calculate price per night
      const checkIn = new Date(parsedData.checkInDate);
      const checkOut = new Date(parsedData.checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const pricePerNight = parsedData.totalPrice && nights > 0 ? parsedData.totalPrice / nights : null;
      
      // Calculate commission rate
      const commissionRate = parsedData.commissionAmount && parsedData.totalPrice 
        ? (parsedData.commissionAmount / parsedData.totalPrice) * 100 
        : null;

      // Create reservation (nights will be calculated automatically by database)
      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert({
          booking_reference: parsedData.bookingReference,
          guest_names: parsedData.guestNames || [],
          guest_nationality: parsedData.nationality || null,
          check_in_date: parsedData.checkInDate,
          check_out_date: parsedData.checkOutDate,
          unit_id: parsedData.unitId,
          number_of_guests: parsedData.numberOfGuests,
          contact_email: parsedData.contactEmail,
          contact_phone: parsedData.contactPhone,
          total_price: parsedData.totalPrice,
          price_per_night: pricePerNight,
          currency: parsedData.currency || 'USD',
          adults: parsedData.adults || parsedData.numberOfGuests,
          children: parsedData.children || 0,
          commission_rate: commissionRate,
          commission_amount: parsedData.commissionAmount,
          net_revenue: parsedData.commissionableAmount,
          notes: parsedData.notes,
          status: 'confirmed',
          source: 'booking.com',
          channel: 'Booking.com',
          preferred_language: parsedData.preferredLanguage || null,
          booking_screenshot_url: screenshotUrl
        })
        .select()
        .single();

      if (reservationError) throw reservationError;

      // Send confirmation email if email is available
      if (parsedData.contactEmail && reservation) {
        try {
          await supabase.functions.invoke('send-reservation-notification', {
            body: {
              reservationId: parsedData.bookingReference,
              guestNames: parsedData.guestNames || [],
              checkIn: parsedData.checkInDate,
              checkOut: parsedData.checkOutDate,
              unitName: parsedData.roomName,
              unitId: unitId,
              unitType: '',
              totalPrice: parsedData.totalPrice || 0,
              numberOfGuests: parsedData.numberOfGuests,
              adults: parsedData.adults || parsedData.numberOfGuests,
              children: parsedData.children || 0,
              source: 'Booking.com',
              notes: parsedData.notes || null,
              guestNationality: parsedData.nationality || null,
              customerEmail: parsedData.contactEmail,
              customerPhone: parsedData.contactPhone || null,
            }
          });
        } catch (emailError) {
          console.error('Error sending email:', emailError);
        }
      }

      const unit = units.find(u => u.id === unitId);
      const roomNumber = unit?.unit_number || 'N/A';
      
      toast({
        title: 'Success',
        description: `Reservation created successfully for ${unitName} - Room # ${roomNumber}`,
      });

      setShowPreview(false);
      setParsedData(null);
      setScreenshotFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create reservation',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmReservation = async () => {
    if (!parsedData) return;
    setCreating(true);
    
    // Handle Split-Stay mode
    if (isSplitStay && splitSegments.length > 1) {
      // Validate split segments before proceeding
      const validation = validateSplitSegments();
      if (!validation.valid) {
        toast({
          title: 'Invalid Split Stay Configuration',
          description: validation.error,
          variant: 'destructive',
        });
        setCreating(false);
        return;
      }

      try {
        const groupId = crypto.randomUUID();
        const baseReference = parsedData.bookingReference;
        const totalNights = parsedData.nights || 1;
        const totalPrice = parsedData.totalPrice || 0;
        const pricePerNight = totalPrice / totalNights;
        
        // Upload screenshot once
        let screenshotUrl: string | null = null;
        if (screenshotFile) {
          const fileExt = screenshotFile.name.split('.').pop();
          const fileName = `${baseReference}-${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('booking-screenshots')
            .upload(fileName, screenshotFile);
          if (!uploadError) screenshotUrl = fileName;
        }
        
        // Create reservation for each segment
        const createdReservations: any[] = [];
        const suffixes = ['A', 'B', 'C', 'D', 'E'];
        
        for (let i = 0; i < splitSegments.length; i++) {
          const segment = splitSegments[i];
          const segmentNights = differenceInCalendarDays(segment.endDate, segment.startDate);
          const segmentPrice = pricePerNight * segmentNights;
          
          // Proportionally split commission
          const priceRatio = segmentPrice / totalPrice;
          const segmentCommission = (parsedData.commissionAmount || 0) * priceRatio;
          const segmentNetRevenue = (parsedData.commissionableAmount || 0) * priceRatio;
          const commissionRate = segmentCommission && segmentPrice 
            ? (segmentCommission / segmentPrice) * 100 
            : null;
          
          const { data: reservation, error } = await supabase
            .from('reservations')
            .insert({
              booking_reference: splitSegments.length > 1 
                ? `${baseReference}-${suffixes[i]}` 
                : baseReference,
              guest_names: parsedData.guestNames || [],
              guest_nationality: parsedData.nationality || null,
              check_in_date: format(segment.startDate, 'yyyy-MM-dd'),
              check_out_date: format(segment.endDate, 'yyyy-MM-dd'),
              unit_id: segment.unitId,
              number_of_guests: parsedData.numberOfGuests,
              contact_email: parsedData.contactEmail,
              contact_phone: parsedData.contactPhone,
              total_price: segmentPrice,
              price_per_night: pricePerNight,
              currency: parsedData.currency || 'USD',
              adults: parsedData.adults || parsedData.numberOfGuests,
              children: parsedData.children || 0,
              commission_rate: commissionRate,
              commission_amount: segmentCommission,
              net_revenue: segmentNetRevenue,
              notes: `Split-stay segment ${i + 1} of ${splitSegments.length}. ${parsedData.notes || ''}`.trim(),
              status: 'confirmed',
              source: 'booking.com',
              channel: 'Booking.com',
              preferred_language: parsedData.preferredLanguage || null,
              booking_screenshot_url: screenshotUrl,
              group_id: groupId,
            })
            .select()
            .single();
          
          if (error) throw error;
          if (reservation) createdReservations.push(reservation);
        }
        
        // Send notification with split-stay segment details
        if (parsedData.contactEmail && createdReservations.length > 0) {
          const pricePerNight = (parsedData.totalPrice || 0) / (parsedData.nights || 1);
          
          const splitStaySegmentsData = splitSegments.map((seg) => {
            const unit = units.find(u => u.id === seg.unitId);
            const segNights = differenceInCalendarDays(seg.endDate, seg.startDate);
            const segmentPrice = pricePerNight * segNights;
            
            return {
              roomName: unit?.name || 'Unknown',
              roomNumber: unit?.unit_number || 'N/A',
              checkIn: format(seg.startDate, 'yyyy-MM-dd'),
              checkOut: format(seg.endDate, 'yyyy-MM-dd'),
              nights: segNights,
              price: segmentPrice,
            };
          });
          
          const roomNames = splitStaySegmentsData.map(s => s.roomName).join(' → ');
          
          try {
            await supabase.functions.invoke('send-reservation-notification', {
              body: {
                reservationId: baseReference,
                guestNames: parsedData.guestNames || [],
                checkIn: parsedData.checkInDate,
                checkOut: parsedData.checkOutDate,
                unitName: roomNames,
                totalPrice: parsedData.totalPrice || 0,
                numberOfGuests: parsedData.numberOfGuests,
                adults: parsedData.adults || parsedData.numberOfGuests,
                children: parsedData.children || 0,
                source: 'Booking.com',
                guestNationality: parsedData.nationality || null,
                notes: parsedData.notes || null,
                customerEmail: parsedData.contactEmail,
                customerPhone: parsedData.contactPhone,
                isSplitStay: true,
                splitStaySegments: splitStaySegmentsData,
              }
            });
          } catch (emailError) {
            console.error('Error sending email:', emailError);
          }
        }
        
        toast({
          title: 'Success',
          description: `Created ${createdReservations.length} split-stay reservation(s)`,
        });
        
        // Reset state
        setShowPreview(false);
        setParsedData(null);
        setScreenshotFile(null);
        setRoomAssignments([]);
        setSplitSegments([]);
        setIsSplitStay(false);
        
        const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
      } catch (error: any) {
        console.error('Error creating split-stay reservation:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to create split-stay reservations',
          variant: 'destructive',
        });
      } finally {
        setCreating(false);
      }
      return;
    }
    
    const isMultiRoom = parsedData.isMultiRoom && roomAssignments.length > 1;
    
    if (isMultiRoom) {
      // Multi-room reservation
      try {
        // Validate all rooms are assigned
        const unassignedRooms = roomAssignments.filter(r => !r.unitId);
        if (unassignedRooms.length > 0) {
          toast({
            title: 'Error',
            description: `Please assign rooms to all ${unassignedRooms.length} unassigned room(s)`,
            variant: 'destructive',
          });
          setCreating(false);
          return;
        }

        // Check for duplicate assignments
        const assignedIds = getAssignedUnitIds();
        const uniqueIds = [...new Set(assignedIds)];
        if (assignedIds.length !== uniqueIds.length) {
          toast({
            title: 'Error',
            description: 'Cannot assign the same room to multiple bookings',
            variant: 'destructive',
          });
          setCreating(false);
          return;
        }

        // Upload screenshot once
        let screenshotUrl: string | null = null;
        if (screenshotFile) {
          const fileExt = screenshotFile.name.split('.').pop();
          const fileName = `${parsedData.bookingReference}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('booking-screenshots')
            .upload(filePath, screenshotFile);

          if (!uploadError) {
            screenshotUrl = filePath;
          }
        }

        // Create reservations for each room
        const createdReservations: any[] = [];
        const errors: string[] = [];

        for (const roomAssignment of roomAssignments) {
          try {
            const reservation = await createSingleReservation(roomAssignment, screenshotUrl, true);
            if (reservation) {
              createdReservations.push(reservation);
            }
          } catch (error: any) {
            errors.push(`Room ${roomAssignment.roomIndex + 1}: ${error.message}`);
          }
        }

        if (createdReservations.length > 0) {
          // Send single notification for multi-room booking
          if (parsedData.contactEmail) {
            try {
              // Build rooms array with full details for multi-room booking
              const roomsData = roomAssignments.map(r => {
                const unit = units.find(u => u.id === r.unitId);
                return {
                  roomName: unit?.name || r.roomName,
                  roomNumber: unit?.unit_number || '',
                  price: r.price || 0
                };
              });

              const roomNames = roomsData.map(r => r.roomName).join(', ');

              await supabase.functions.invoke('send-reservation-notification', {
                body: {
                  reservationId: parsedData.bookingReference,
                  guestNames: parsedData.guestNames || [],
                  checkIn: parsedData.checkInDate,
                  checkOut: parsedData.checkOutDate,
                  unitName: roomNames,
                  unitId: roomAssignments[0].unitId,
                  unitType: '',
                  totalPrice: parsedData.totalPrice || 0,
                  numberOfGuests: parsedData.numberOfGuests,
                  adults: parsedData.adults || parsedData.numberOfGuests,
                  children: parsedData.children || 0,
                  source: 'Booking.com',
                  notes: parsedData.notes || null,
                  guestNationality: parsedData.nationality || null,
                  customerEmail: parsedData.contactEmail,
                  customerPhone: parsedData.contactPhone || null,
                  isMultiRoom: true,
                  rooms: roomsData,
                }
              });
            } catch (emailError) {
              console.error('Error sending email:', emailError);
            }
          }

          toast({
            title: 'Success',
            description: `Created ${createdReservations.length} reservation(s) for ${parsedData.bookingReference}`,
          });
        }

        if (errors.length > 0) {
          toast({
            title: 'Warning',
            description: errors.join('. '),
            variant: 'destructive',
          });
        }

        setShowPreview(false);
        setParsedData(null);
        setScreenshotFile(null);
        setRoomAssignments([]);
        
        const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

      } catch (error: any) {
        console.error('Error creating multi-room reservation:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to create reservations',
          variant: 'destructive',
        });
      } finally {
        setCreating(false);
      }
    } else {
      // Single room reservation - use existing logic
      const unitId = roomAssignments.length > 0 ? roomAssignments[0].unitId : parsedData.unitId;
      if (!unitId) {
        toast({
          title: 'Error',
          description: 'Please select a room',
          variant: 'destructive',
        });
        setCreating(false);
        return;
      }
      const unitName = getUnitName(unitId);
      await createReservationWithUnit(unitId, unitName);
    }
  };

  const handleAssignToAlternative = async () => {
    if (!selectedAlternativeId || !parsedData) return;
    
    setShowConflictDialog(false);
    setShowPreview(false);
    setCreating(true);
    
    // Get the selected unit name
    const selectedUnit = [...sameTypeAlternatives, ...otherAlternatives]
      .find(u => u.id === selectedAlternativeId);
    
    // Update parsed data with new unit ID
    const updatedParsedData = {
      ...parsedData,
      unitId: selectedAlternativeId
    };
    setParsedData(updatedParsedData);
    
    // Create reservation with the alternative unit
    await createReservationWithUnit(selectedAlternativeId, selectedUnit?.name || 'Unknown room');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getUnitName = (unitId?: string) => {
    if (!unitId) return 'No room matched';
    const unit = units.find(u => u.id === unitId);
    return unit ? unit.name : 'Unknown room';
  };

  const handleDownloadReservation = async () => {
    if (!reservationCardRef.current || !parsedData) return;

    setDownloadingImage(true);
    try {
      const dataUrl = await toPng(reservationCardRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `reservation-${parsedData.bookingReference}.png`;
      link.href = dataUrl;
      link.click();

      toast({
        title: 'Success',
        description: 'Reservation image downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading reservation:', error);
      toast({
        title: 'Error',
        description: 'Failed to download reservation image',
        variant: 'destructive',
      });
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleUpdateReservation = async () => {
    if (!parsedData || existingReservationsToUpdate.length === 0) return;
    setCreating(true);
    
    try {
      // Handle multi-room bookings (update all linked reservations)
      for (const reservation of existingReservationsToUpdate) {
        const updateData: any = {
          check_in_date: parsedData.checkInDate,
          check_out_date: parsedData.checkOutDate,
          total_price: parsedData.totalPrice,
          number_of_guests: parsedData.numberOfGuests,
          adults: parsedData.adults,
          children: parsedData.children,
          notes: `Updated from Booking.com modification. ${parsedData.notes || ''}`.trim(),
          updated_at: new Date().toISOString(),
        };
        
        // Recalculate derived fields
        // Note: nights is a generated column - don't include in update payload
        const nights = differenceInCalendarDays(
          parseISO(parsedData.checkOutDate), 
          parseISO(parsedData.checkInDate)
        );
        updateData.price_per_night = parsedData.totalPrice && nights > 0 
          ? parsedData.totalPrice / nights 
          : null;
        
        // Update commission if provided
        if (parsedData.commissionAmount) {
          updateData.commission_amount = parsedData.commissionAmount;
          updateData.commission_rate = parsedData.totalPrice 
            ? (parsedData.commissionAmount / parsedData.totalPrice) * 100 
            : null;
        }
        if (parsedData.commissionableAmount) {
          updateData.net_revenue = parsedData.commissionableAmount;
        }
        
        const { error } = await supabase
          .from('reservations')
          .update(updateData)
          .eq('id', reservation.id);
        
        if (error) throw error;
      }
      
      toast({
        title: 'Success',
        description: `Updated ${existingReservationsToUpdate.length} reservation(s)`,
      });

      // Send modification notification email
      try {
        const firstReservation = existingReservationsToUpdate[0];
        
        // Fetch unit details including booking_com_name
        const { data: unitData } = await supabase
          .from('units')
          .select('name, unit_number, booking_com_name')
          .eq('id', firstReservation.unit_id)
          .single();
        
        await supabase.functions.invoke('send-modification-notification', {
          body: {
            booking_reference: parsedData.bookingReference,
            guest_names: parsedData.guestNames || firstReservation.guest_names,
            room_name: unitData?.booking_com_name || unitData?.name || 'Unknown',
            room_number: unitData?.unit_number || 'N/A',
            old_check_in: originalReservationData.check_in_date,
            old_check_out: originalReservationData.check_out_date,
            new_check_in: parsedData.checkInDate,
            new_check_out: parsedData.checkOutDate,
            old_total_price: originalReservationData.total_price || 0,
            new_total_price: parsedData.totalPrice || 0,
            currency: parsedData.currency || 'USD',
            channel: firstReservation.channel,
            source: firstReservation.source,
          }
        });
        console.log('Modification notification sent');
      } catch (notifyError) {
        console.error('Failed to send modification notification:', notifyError);
        // Don't fail the update if notification fails
      }
      
      // Reset state
      setShowPreview(false);
      setParsedData(null);
      setIsModificationMode(false);
      setExistingReservationsToUpdate([]);
      setOriginalReservationData(null);
      setScreenshotFile(null);
      
      const fileInput = document.getElementById('screenshot-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update reservation',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const allRoomsAssigned = roomAssignments.length > 0 && roomAssignments.every(r => r.unitId);
  const hasNoDuplicateAssignments = () => {
    const ids = getAssignedUnitIds();
    return ids.length === [...new Set(ids)].length;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Booking.com" />
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
          
          <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Booking.com Reservations</h1>
            <p className="text-sm text-muted-foreground">Upload and import reservations from screenshots</p>
          </div>
        </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Upload Reservation Screenshot</CardTitle>
            <CardDescription>
              Upload a screenshot from Booking.com and we'll automatically extract the reservation details. Supports single and multi-room bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('screenshot-upload')?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Drop your screenshot here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports: PNG, JPG, JPEG
                  </p>
                </div>
                <Input
                  id="screenshot-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </div>

              {uploading && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-3 bg-secondary" />
                    <p className="text-xs text-center text-muted-foreground font-medium">{uploadProgress}%</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    {uploadComplete ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">Upload complete! Processing reservation...</span>
                      </>
                    ) : (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading and analyzing screenshot...</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Take a screenshot of the reservation details from Booking.com</li>
                <li>Upload the screenshot using the form above</li>
                <li>Our AI will automatically extract all reservation details (including multi-room bookings)</li>
                <li>Review and assign rooms to each booking</li>
                <li>The reservations will be created and emails sent to the guest</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Double Booking Detected
            </DialogTitle>
            <DialogDescription>
              This room is already booked for the selected dates
            </DialogDescription>
          </DialogHeader>

          {conflictInfo && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">{conflictInfo.roomName}</p>
                    <p className="text-sm">Already booked by: {conflictInfo.guestNames.join(', ')}</p>
                    <p className="text-sm">Reference: {conflictInfo.bookingReference}</p>
                    <p className="text-sm">
                      Dates: {new Date(conflictInfo.checkIn).toLocaleDateString()} - {new Date(conflictInfo.checkOut).toLocaleDateString()}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {sameTypeAlternatives.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">Select an alternative room (same type)</h4>
                    <p className="text-sm text-muted-foreground">
                      {sameTypeAlternatives.length} available room(s) of type: {conflictInfo.originalUnitType}
                    </p>
                  </div>
                  <RadioGroup value={selectedAlternativeId} onValueChange={setSelectedAlternativeId}>
                    <div className="space-y-2">
                      {sameTypeAlternatives.map((unit) => (
                        <div key={unit.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                          <RadioGroupItem value={unit.id} id={unit.id} />
                          <Label htmlFor={unit.id} className="flex-1 cursor-pointer">
                            <div>
                              <p className="font-medium">{unit.name}</p>
                              <p className="text-sm text-muted-foreground">Unit {unit.unit_number}</p>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No rooms of the same type available. Please manually select from other available rooms.
                    </AlertDescription>
                  </Alert>

                  {otherAlternatives.length > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor="manual-select">Select an available room</Label>
                      <Select value={selectedAlternativeId} onValueChange={setSelectedAlternativeId}>
                        <SelectTrigger id="manual-select">
                          <SelectValue placeholder="Select a room..." />
                        </SelectTrigger>
                        <SelectContent>
                          {otherAlternatives.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name} (Unit {unit.unit_number}) - {unit.unit_type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Alert variant="destructive">
                      <AlertDescription>
                        No alternative rooms available for these dates. Please check availability or modify the booking dates.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConflictDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignToAlternative} 
              disabled={!selectedAlternativeId || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Selected Room'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm Reservation Details</DialogTitle>
            <DialogDescription>
              {parsedData?.isMultiRoom 
                ? `Multi-room booking detected (${roomAssignments.length} rooms). Please assign rooms to each booking.`
                : 'Please review the extracted information before creating the reservation'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Show modification comparison when updating existing reservation */}
          {isModificationMode && existingReservationsToUpdate.length > 0 && originalReservationData && (
            <Alert className="border-blue-200 bg-blue-50">
              <ArrowLeftRight className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Reservation Modification Detected</AlertTitle>
              <AlertDescription className="text-blue-700">
                <div className="mt-2 space-y-2">
                  <p className="font-medium">Changes detected for booking {parsedData?.bookingReference}:</p>
                  
                  {/* Date Change Comparison */}
                  {parsedData && (originalReservationData?.check_in_date !== parsedData?.checkInDate ||
                    originalReservationData?.check_out_date !== parsedData?.checkOutDate) && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-muted-foreground line-through">
                        {format(parseISO(originalReservationData.check_in_date), 'MMM d')} - {format(parseISO(originalReservationData.check_out_date), 'MMM d, yyyy')}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-blue-800">
                        {format(parseISO(parsedData.checkInDate), 'MMM d')} - {format(parseISO(parsedData.checkOutDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  
                  {/* Price Change Comparison */}
                  {parsedData && originalReservationData?.total_price !== parsedData?.totalPrice && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {parsedData?.currency} {originalReservationData.total_price}
                      </span>
                      <span>→</span>
                      <span className="font-medium text-blue-800">
                        {parsedData?.currency} {parsedData?.totalPrice}
                      </span>
                    </div>
                  )}

                  {/* Guest Count Change Comparison */}
                  {parsedData && originalReservationData?.number_of_guests !== parsedData?.numberOfGuests && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground line-through">
                        {originalReservationData.number_of_guests} guests
                      </span>
                      <span>→</span>
                      <span className="font-medium text-blue-800">
                        {parsedData?.numberOfGuests} guests
                      </span>
                    </div>
                  )}
                  
                  <p className="text-xs mt-2">
                    This will update {existingReservationsToUpdate.length} existing reservation(s).
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Keep existing error for non-modification duplicates */}
          {existingReservation && !isModificationMode && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Reservation Already Exists</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>This booking reference has already been imported.</span>
                <Button 
                  variant="link" 
                  className="p-0 h-auto justify-start text-destructive-foreground hover:text-destructive-foreground/80"
                  onClick={() => navigate(`/reservations/${existingReservation.id}`)}
                >
                  View existing reservation →
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {parsedData && (
            <div ref={reservationCardRef} className="space-y-4 bg-background p-6 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Booking Reference</Label>
                  <p className="font-medium">{parsedData.bookingReference}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Check-in / Check-out</Label>
                  <p className="font-medium">
                    {new Date(parsedData.checkInDate).toLocaleDateString()} - {new Date(parsedData.checkOutDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Guest Names</Label>
                <p className="font-medium">{parsedData.guestNames.join(', ')}</p>
              </div>

              {/* Multi-room assignment section */}
              {parsedData.isMultiRoom && roomAssignments.length > 1 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Room Assignments</Label>
                    <Badge variant="secondary">{roomAssignments.length} rooms</Badge>
                  </div>
                  
                  {roomAssignments.map((room, index) => {
                    const assignedUnit = room.unitId ? units.find(u => u.id === room.unitId) : null;
                    const otherAssignedIds = roomAssignments
                      .filter(r => r.roomIndex !== room.roomIndex && r.unitId)
                      .map(r => r.unitId!);
                    
                    return (
                      <Card key={room.roomIndex} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">Room {index + 1}</Badge>
                                {room.unitId && (
                                  <Check className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                              <p className="font-medium">{room.roomName}</p>
                              <p className="text-sm text-muted-foreground">
                                {parsedData.currency} {room.price.toFixed(2)}
                              </p>
                            </div>
                            
                            <div className="w-full md:w-64">
                              {loadingUnitsStatus ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading...
                                </div>
                              ) : (
                                <Select 
                                  value={room.unitId || ''} 
                                  onValueChange={(value) => updateRoomAssignment(room.roomIndex, value)}
                                >
                                  <SelectTrigger className={cn(
                                    "bg-background",
                                    !room.unitId && "border-orange-300"
                                  )}>
                                    <SelectValue placeholder="Select a room..." />
                                  </SelectTrigger>
                                  <SelectContent className="bg-background">
                                    {unitsWithStatus.map((unit) => {
                                      const isAssignedElsewhere = otherAssignedIds.includes(unit.id);
                                      const isDisabled = unit.status !== 'available' || isAssignedElsewhere;
                                      
                                      return (
                                        <SelectItem 
                                          key={unit.id} 
                                          value={unit.id}
                                          disabled={isDisabled}
                                          className="flex items-center justify-between"
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <span>{unit.booking_com_name || unit.name} (#{unit.unit_number})</span>
                                            {isAssignedElsewhere && (
                                              <Badge 
                                                variant="outline"
                                                className="ml-auto pointer-events-none text-xs bg-blue-50 text-blue-600 border-blue-200"
                                              >
                                                Assigned
                                              </Badge>
                                            )}
                                            {!isAssignedElsewhere && unit.status !== 'available' && (
                                              <Badge 
                                                variant="outline"
                                                className={cn(
                                                  "ml-auto pointer-events-none text-xs",
                                                  unit.status === 'reserved' && "bg-orange-50 text-orange-600 border-orange-200",
                                                  unit.status === 'blocked' && "bg-red-50 text-red-600 border-red-200"
                                                )}
                                              >
                                                {unit.status === 'reserved' ? 'Reserved' : 'Blocked'}
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {!allRoomsAssigned && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Please assign rooms to all bookings before confirming.
                      </AlertDescription>
                    </Alert>
                  )}

                  {allRoomsAssigned && !hasNoDuplicateAssignments() && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Cannot assign the same room to multiple bookings.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                /* Single room assignment */
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Room</Label>
                    <p className="font-medium">{parsedData.roomName}</p>
                    {roomAssignments.length > 0 && roomAssignments[0].unitId && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-green-600">
                          ✓ Matched: {getUnitName(roomAssignments[0].unitId)} (#{units.find(u => u.id === roomAssignments[0].unitId)?.unit_number || 'N/A'})
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-primary hover:text-primary/80"
                          onClick={() => setShowRoomSelector(!showRoomSelector)}
                        >
                          {showRoomSelector ? 'Cancel' : 'Change Room'}
                        </Button>
                      </div>
                    )}
                    {roomAssignments.length > 0 && !roomAssignments[0].unitId && parsedData.blockedUnitWarning && (
                      <p className="text-sm text-orange-600">⚠ {parsedData.blockedUnitWarning}</p>
                    )}
                  </div>

                  {/* Room Selection Dropdown */}
                  {(roomAssignments.length === 0 || !roomAssignments[0].unitId || showRoomSelector) && (
                    <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
                      <Label className="text-sm font-medium">
                        {roomAssignments[0]?.unitId ? 'Change Room Assignment' : 'Select Room Manually'}
                      </Label>
                      {loadingUnitsStatus ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading available rooms...
                        </div>
                      ) : (
                        <Select 
                          value={roomAssignments[0]?.unitId || ''} 
                          onValueChange={(value) => {
                            if (roomAssignments.length > 0) {
                              updateRoomAssignment(0, value);
                            } else {
                              setRoomAssignments([{
                                roomIndex: 0,
                                roomName: parsedData.roomName,
                                price: parsedData.totalPrice || 0,
                                unitId: value
                              }]);
                            }
                            setShowRoomSelector(false);
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select a room..." />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {unitsWithStatus.map((unit) => (
                              <SelectItem 
                                key={unit.id} 
                                value={unit.id}
                                disabled={unit.status !== 'available'}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <span>{unit.booking_com_name || unit.name} (#{unit.unit_number})</span>
                                  {unit.status !== 'available' && (
                                    <Badge 
                                      variant="outline"
                                      className={cn(
                                        "ml-auto pointer-events-none text-xs",
                                        unit.status === 'reserved' && "bg-orange-50 text-orange-600 border-orange-200",
                                        unit.status === 'blocked' && "bg-red-50 text-red-600 border-red-200"
                                      )}
                                    >
                                      {unit.status === 'reserved' ? 'Reserved' : 'Blocked'}
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {(!roomAssignments[0]?.unitId) && (
                        <p className="text-xs text-yellow-600">
                          ⚠ No room has been selected. Please choose a room above.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Split-Stay Toggle - only show for single room bookings */}
              {!parsedData.isMultiRoom && (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 mt-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                      <Label className="font-medium">Room Transfer / Split Stay</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Guest will change rooms during their stay
                    </p>
                  </div>
                  <Switch 
                    checked={isSplitStay} 
                    onCheckedChange={(checked) => {
                      setIsSplitStay(checked);
                      if (checked) {
                        initializeSplitStay();
                      } else {
                        setSplitSegments([]);
                      }
                    }}
                  />
                </div>
              )}

              {/* Split-Stay Segment Editor */}
              {isSplitStay && splitSegments.length > 0 && (
                <div className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Stay Segments</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addSegment}
                      disabled={
                        splitSegments.length >= 5 || 
                        (splitSegments.length > 0 && !splitSegments[splitSegments.length - 1].unitId) ||
                        getTotalSegmentNights() >= (parsedData?.nights || 0)
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Segment
                    </Button>
                  </div>
                  
                  {splitSegments.map((segment, index) => {
                    const segmentNights = differenceInCalendarDays(segment.endDate, segment.startDate);
                    const otherAssignedIds = splitSegments
                      .filter(s => s.id !== segment.id && s.unitId)
                      .map(s => s.unitId!);
                    const pricePerNight = (parsedData.totalPrice || 0) / (parsedData.nights || 1);
                    const segmentPrice = pricePerNight * segmentNights;
                    
                    return (
                      <Card key={segment.id} className="border-l-4 border-l-primary">
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Segment {index + 1}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {segmentNights} night{segmentNights !== 1 ? 's' : ''} — {parsedData.currency} {segmentPrice.toFixed(2)}
                              </span>
                            </div>
                            {splitSegments.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSegment(segment.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          {/* Date Range */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Check-in</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(segment.startDate, 'MMM d, yyyy')}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-background">
                                  <Calendar
                                    mode="single"
                                    selected={segment.startDate}
                                    onSelect={(date) => date && updateSegmentDate(segment.id, 'startDate', date)}
                                    disabled={(date) => {
                                      const checkIn = new Date(parsedData.checkInDate);
                                      return date < checkIn || date >= segment.endDate;
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Check-out</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {format(segment.endDate, 'MMM d, yyyy')}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-background">
                                  <Calendar
                                    mode="single"
                                    selected={segment.endDate}
                                    onSelect={(date) => date && updateSegmentDate(segment.id, 'endDate', date)}
                                    disabled={(date) => {
                                      const checkOut = new Date(parsedData.checkOutDate);
                                      return date <= segment.startDate || date > checkOut;
                                    }}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          
                          {/* Room Selection */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Room</Label>
                            {loadingSegmentAvailability[segment.id] ? (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Checking availability...
                              </div>
                            ) : (
                              <Select 
                                value={segment.unitId || ''} 
                                onValueChange={(value) => updateSegmentRoom(segment.id, value)}
                              >
                                <SelectTrigger className={cn("bg-background", !segment.unitId && "border-orange-300")}>
                                  <SelectValue placeholder="Select a room..." />
                                </SelectTrigger>
                                <SelectContent className="bg-background">
                                  {(segmentAvailability[segment.id] || []).map((unit) => {
                                    const isAssignedElsewhere = otherAssignedIds.includes(unit.id);
                                    return (
                                      <SelectItem 
                                        key={unit.id} 
                                        value={unit.id}
                                        disabled={unit.status !== 'available' || isAssignedElsewhere}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span>{unit.booking_com_name || unit.name} (#{unit.unit_number})</span>
                                          {isAssignedElsewhere && (
                                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                                              Used in another segment
                                            </Badge>
                                          )}
                                          {!isAssignedElsewhere && unit.status !== 'available' && (
                                            <Badge 
                                              variant="outline"
                                              className={cn(
                                                "text-xs",
                                                unit.status === 'reserved' && "bg-orange-50 text-orange-600 border-orange-200",
                                                unit.status === 'blocked' && "bg-red-50 text-red-600 border-red-200"
                                              )}
                                            >
                                              {unit.status === 'reserved' ? 'Reserved' : 'Blocked'}
                                            </Badge>
                                          )}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {/* Validation Messages */}
                  {getTotalSegmentNights() !== parsedData.nights && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Segment nights ({getTotalSegmentNights()}) don't match total stay ({parsedData.nights} nights)
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {splitSegments.some(s => !s.unitId) && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Please assign a room to all segments
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Split Summary */}
                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="font-medium text-sm">Split-Stay Summary</p>
                    {splitSegments.map((seg, idx) => {
                      const unit = units.find(u => u.id === seg.unitId);
                      const nights = differenceInCalendarDays(seg.endDate, seg.startDate);
                      const pricePerNightCalc = (parsedData.totalPrice || 0) / (parsedData.nights || 1);
                      const segmentPriceCalc = pricePerNightCalc * nights;
                      
                      return (
                        <div key={seg.id} className="text-sm border-l-2 border-primary pl-3">
                          <p className="font-medium">
                            Segment {idx + 1}: {unit?.name || 'Not selected'} 
                            {unit?.unit_number && ` (#${unit.unit_number})`}
                          </p>
                          <p className="text-muted-foreground">
                            {format(seg.startDate, 'MMM d')} → {format(seg.endDate, 'MMM d')} 
                            ({nights} night{nights !== 1 ? 's' : ''}) — {parsedData.currency} {segmentPriceCalc.toFixed(2)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Number of Guests</Label>
                  <p className="font-medium">{parsedData.numberOfGuests}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nights</Label>
                  <p className="font-medium">{parsedData.nights}</p>
                </div>
              </div>

              {parsedData.nationality && (
                <div>
                  <Label className="text-xs text-muted-foreground">Nationality</Label>
                  <p className="font-medium">{parsedData.nationality}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  {parsedData.preferredLanguage && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Preferred Language</Label>
                      <p className="font-medium">{parsedData.preferredLanguage}</p>
                    </div>
                  )}

                  {parsedData.contactEmail && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <p className="font-medium">{parsedData.contactEmail}</p>
                    </div>
                  )}

                  {parsedData.contactPhone && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <p className="font-medium">{parsedData.contactPhone}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {parsedData.totalPrice && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Total Price (All Rooms)</Label>
                      <p className="font-medium">
                        {parsedData.currency} {parsedData.totalPrice}
                      </p>
                    </div>
                  )}

                  {parsedData.commissionableAmount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Net Revenue (Commissionable Amount)</Label>
                      <p className="font-medium">
                        {parsedData.currency} {parsedData.commissionableAmount}
                      </p>
                    </div>
                  )}

                  {parsedData.commissionAmount && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Commission & Charges</Label>
                      <p className="font-medium">
                        {parsedData.currency} {parsedData.commissionAmount}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {parsedData.notes && (
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm">{parsedData.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleDownloadReservation} 
              disabled={creating || downloadingImage}
              className="w-full sm:w-auto"
            >
              {downloadingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Image
                </>
              )}
            </Button>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => { setShowPreview(false); setExistingReservation(null); setRoomAssignments([]); setSplitSegments([]); setIsSplitStay(false); setSegmentAvailability({}); setLoadingSegmentAvailability({}); setIsModificationMode(false); setExistingReservationsToUpdate([]); setOriginalReservationData(null); }} disabled={creating} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button 
                onClick={isModificationMode ? handleUpdateReservation : handleConfirmReservation} 
                disabled={
                  creating || 
                  (existingReservation !== null && !isModificationMode) || 
                  (!isModificationMode && (isSplitStay 
                    ? !allSegmentsValid()
                    : (!allRoomsAssigned || !hasNoDuplicateAssignments())
                  ))
                } 
                className="flex-1 sm:flex-none"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isModificationMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  isModificationMode
                    ? `Update ${existingReservationsToUpdate.length} Reservation(s)`
                    : isSplitStay && splitSegments.length > 1
                      ? `Create ${splitSegments.length} Reservations`
                      : parsedData?.isMultiRoom && roomAssignments.length > 1 
                        ? `Create ${roomAssignments.length} Reservations`
                        : 'Confirm & Create'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingComReservations;

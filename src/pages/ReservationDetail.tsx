import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Edit2, X, CalendarIcon, Trash2, FileText, Download, Check, ChevronsUpDown, ArrowLeft, Clock, Plus, Link2, AlertTriangle, Loader2, MessageCircle, Mail, Upload, ArrowLeftRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import { CreateGuestAccountDialog } from '@/components/CreateGuestAccountDialog';
import { SlideMenu } from '@/components/SlideMenu';
import { RoomTransferDialog } from '@/components/RoomTransferDialog';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const NATIONALITIES = [
  "Afghanistan", "Albania", "Algeria", "United States", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Brazil", "United Kingdom", "Brunei", "Bulgaria", "Burkina Faso",
  "Myanmar", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China",
  "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti",
  "Dominican Republic", "Netherlands", "East Timor", "Ecuador", "Egypt", "United Arab Emirates", "Equatorial Guinea", "Eritrea", "Estonia", "Ethiopia",
  "Fiji", "Philippines", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece",
  "Grenada", "Guatemala", "Guinea-Bissau", "Guinea", "Guyana", "Haiti", "Honduras", "Hungary", "Kiribati",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica",
  "Japan", "Jordan", "Kazakhstan", "Kenya", "Saint Kitts and Nevis", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "North Macedonia", "Madagascar", "Malawi", "Malaysia", "Maldives",
  "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia",
  "Morocco", "Lesotho", "Mozambique", "Namibia", "Nauru", "Nepal", "New Zealand", "Nicaragua", "Nigeria",
  "Niger", "North Korea", "Northern Ireland", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay",
  "Peru", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Lucia", "El Salvador", "Samoa",
  "San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Scotland", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan", "Suriname", "Eswatini",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Tuvalu", "Uganda", "Ukraine", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Wales",
  "Yemen", "Zambia", "Zimbabwe"
];

interface Reservation {
  id: string;
  booking_reference: string;
  channel: string;
  source: string;
  unit_id: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  adults: number | null;
  children: number | null;
  guest_names: string[];
  guest_types: string[] | null;
  guest_genders: string[] | null;
  guest_nationality: string | null;
  guest_ages: number[];
  contact_email: string | null;
  contact_phone: string | null;
  price_per_night: number | null;
  total_price: number;
  commission_rate: number | null;
  commission_amount: number | null;
  net_revenue: number | null;
  currency: string;
  payment_method: string | null;
  notes: string | null;
  status: string;
  marriage_certificate_url: string | null;
  id_passport_url: string | null;
  id_passport_url_back: string | null;
  booking_screenshot_url: string | null;
  created_at: string;
  updated_at: string;
  group_id: string | null;
  units: { name: string; unit_number: string | null; booking_com_name: string | null; tax_percentage: number | null } | null;
  vat_exempt: boolean | null;
  channex_booking_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  unit_type: string | null;
  status: string;
}

interface UnitAvailability extends Unit {
  hasConflict: boolean;
  hasBlockedDates: boolean;
  isAvailable: boolean;
}

interface LinkedCharge {
  id: string;
  booking_reference: string;
  type: 'late_checkout' | 'extension';
  total_price: number;
  source: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  created_at: string;
}

const statusColors = {
  confirmed: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'checked-in': 'bg-green-100 text-green-800 hover:bg-green-100',
  'checked-out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  completed: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const statusLabels = {
  confirmed: 'Confirmed',
  'checked-in': 'Checked-In',
  'checked-out': 'Checked-Out',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ReservationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const propertyId = usePropertyId();
  const { userRole } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitAvailability, setUnitAvailability] = useState<UnitAvailability[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);
  const [downloading, setDownloading] = useState<{
    id_passport_url?: boolean;
    id_passport_url_back?: boolean;
    marriage_certificate_url?: boolean;
    booking_screenshot_url?: boolean;
  }>({});
  const [linkedCharges, setLinkedCharges] = useState<LinkedCharge[]>([]);
  const [showDeleteChargeDialog, setShowDeleteChargeDialog] = useState(false);
  const [chargeToDelete, setChargeToDelete] = useState<LinkedCharge | null>(null);
  const [deletingCharge, setDeletingCharge] = useState(false);
  const [downloadingConfirmation, setDownloadingConfirmation] = useState(false);
  const [showRoomTransferDialog, setShowRoomTransferDialog] = useState(false);
  const confirmationRef = useRef<HTMLDivElement>(null);
  
  // Document upload states
  const [idPassportUrl, setIdPassportUrl] = useState<string | null>(null);
  const [idPassportUrlBack, setIdPassportUrlBack] = useState<string | null>(null);
  const [marriageCertUrl, setMarriageCertUrl] = useState<string | null>(null);
  const [isIdUploading, setIsIdUploading] = useState(false);
  const [idUploadProgress, setIdUploadProgress] = useState(0);
  const [isIdUploadingBack, setIsIdUploadingBack] = useState(false);
  const [idUploadProgressBack, setIdUploadProgressBack] = useState(0);
  const [isMarriageUploading, setIsMarriageUploading] = useState(false);
  const [marriageUploadProgress, setMarriageUploadProgress] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    unit_id: '',
    check_in_date: new Date(),
    check_out_date: new Date(),
    number_of_guests: 1,
    guest_names: [''],
    guest_genders: [] as string[],
    guest_nationality: '',
    contact_email: '',
    contact_phone: '',
    price_per_night: 0,
    total_price: 0,
    commission_rate: 10,
    commission_amount: 0,
    net_revenue: 0,
    source: '',
    status: '',
    notes: '',
    channel: '',
    currency: 'USD',
    payment_method: '',
    arrival_time: '',
  });

  const canEdit = userRole === 'admin';

  useEffect(() => {
    fetchReservation();
    fetchUnits();
  }, [id]);

  // Initialize document URLs when reservation loads
  useEffect(() => {
    if (reservation) {
      setIdPassportUrl(reservation.id_passport_url);
      setIdPassportUrlBack(reservation.id_passport_url_back);
      setMarriageCertUrl(reservation.marriage_certificate_url);
    }
  }, [reservation]);

  const fetchLinkedCharges = async (groupId: string, currentId: string) => {
    const { data } = await supabase
      .from('reservations')
      .select('id, booking_reference, total_price, source, check_in_date, check_out_date, nights, created_at')
      .eq('group_id', groupId)
      .neq('id', currentId)
      .order('created_at', { ascending: true });

    if (data) {
      const charges: LinkedCharge[] = data.map(r => ({
        ...r,
        type: r.booking_reference?.endsWith('-LC') ? 'late_checkout' : 'extension',
      }));
      setLinkedCharges(charges);
    }
  };

  const fetchReservation = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('*, units!unit_id(name, unit_number, booking_com_name, tax_percentage)')
      .eq('id', id)
      .single();

    if (!error && data) {
      setReservation(data as any as Reservation);
      // Fetch linked charges if group_id exists
      if (data.group_id) {
        fetchLinkedCharges(data.group_id, data.id);
      } else {
        setLinkedCharges([]);
      }
      // Initialize form data
      setFormData({
        unit_id: data.unit_id || '',
        check_in_date: new Date(data.check_in_date),
        check_out_date: new Date(data.check_out_date),
        number_of_guests: data.number_of_guests,
        guest_names: data.guest_names,
        guest_genders: data.guest_genders || [],
        guest_nationality: data.guest_nationality || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        price_per_night: data.price_per_night || 0,
        total_price: data.total_price,
        commission_rate: data.commission_rate || 10,
        commission_amount: data.commission_amount || 0,
        net_revenue: data.net_revenue || 0,
        notes: data.notes || '',
        status: data.status,
        channel: data.channel,
        source: data.source,
        currency: data.currency || 'USD',
        payment_method: data.payment_method || '',
        arrival_time: (data as any).arrival_time || '',
      });
    }
  };

  const fetchUnits = async () => {
    const { data } = await withPropertyFilter(supabase
      .from('units')
      .select('id, name, unit_number, unit_type, status'), propertyId)
      .order('name');
    
    if (data) {
      setUnits(data);
    }
  };

  const checkUnitAvailability = async () => {
    if (!reservation || units.length === 0) return;
    
    setCheckingAvailability(true);
    
    try {
      const checkInDate = format(formData.check_in_date, 'yyyy-MM-dd');
      const checkOutDate = format(formData.check_out_date, 'yyyy-MM-dd');
      
      // Check availability for each unit
      const availabilityChecks = await Promise.all(
        units.map(async (unit) => {
          // Check for conflicting reservations (excluding current reservation)
          const { data: conflicts } = await supabase.rpc('check_reservation_overlap', {
            p_unit_id: unit.id,
            p_check_in_date: checkInDate,
            p_check_out_date: checkOutDate,
            p_exclude_id: reservation.id
          });
          
          // Check for blocked dates
          const { data: blockedDates } = await supabase
            .from('blocked_dates')
            .select('id')
            .eq('unit_id', unit.id)
            .gte('blocked_date', checkInDate)
            .lt('blocked_date', checkOutDate);
          
          const hasConflict = conflicts && conflicts.length > 0;
          const hasBlockedDates = blockedDates && blockedDates.length > 0;
          
          return {
            ...unit,
            hasConflict,
            hasBlockedDates,
            isAvailable: !hasConflict && !hasBlockedDates && unit.status === 'available'
          };
        })
      );
      
      setUnitAvailability(availabilityChecks);
    } catch (error) {
      console.error('Error checking unit availability:', error);
      toast.error('Failed to check unit availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Check availability when entering edit mode or when dates change
  useEffect(() => {
    if (isEditMode && reservation && units.length > 0) {
      checkUnitAvailability();
    }
  }, [isEditMode, formData.check_in_date, formData.check_out_date, units.length]);

  const calculateNights = () => {
    const diff = formData.check_out_date.getTime() - formData.check_in_date.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const calculateTotals = () => {
    const nights = calculateNights();
    const total = formData.price_per_night * nights;
    const commission = (total * formData.commission_rate) / 100;
    const net = total - commission;
    
    setFormData(prev => ({
      ...prev,
      total_price: total,
      commission_amount: commission,
      net_revenue: net,
    }));
  };

  const calculatePricePerNight = () => {
    const nights = calculateNights();
    if (nights > 0 && formData.total_price > 0) {
      const pricePerNight = formData.total_price / nights;
      setFormData(prev => ({
        ...prev,
        price_per_night: pricePerNight,
      }));
    }
  };

  const calculateCommissionFromRate = () => {
    const commission = (formData.total_price * formData.commission_rate) / 100;
    const net = formData.total_price - commission;
    setFormData(prev => ({
      ...prev,
      commission_amount: commission,
      net_revenue: net,
    }));
  };

  const calculateRateFromCommission = () => {
    if (formData.total_price > 0) {
      const rate = (formData.commission_amount / formData.total_price) * 100;
      const net = formData.total_price - formData.commission_amount;
      setFormData(prev => ({
        ...prev,
        commission_rate: rate,
        net_revenue: net,
      }));
    }
  };

  useEffect(() => {
    if (isEditMode) {
      calculateTotals();
    }
  }, [formData.price_per_night, formData.check_in_date, formData.check_out_date]);

  // Auto-calculate price per night when total price changes
  useEffect(() => {
    if (isEditMode && formData.total_price > 0) {
      const nights = calculateNights();
      if (nights > 0) {
        const pricePerNight = formData.total_price / nights;
        if (Math.abs(formData.price_per_night - pricePerNight) > 0.01) {
          setFormData(prev => ({
            ...prev,
            price_per_night: pricePerNight,
          }));
        }
      }
    }
  }, [formData.total_price, formData.check_in_date, formData.check_out_date]);

  // Auto-set commission rate based on source
  useEffect(() => {
    if (formData.source.toLowerCase().includes('booking')) {
      setFormData(prev => ({
        ...prev,
        commission_rate: 17.4,
      }));
    }
  }, [formData.source]);

  // Handle document upload to Supabase Storage
  const handleDocumentUpload = async (
    file: File, 
    type: 'id_front' | 'id_back' | 'marriage'
  ) => {
    const bucket = type === 'marriage' ? 'marriage-certificates' : 'id-passports';
    const setUploading = type === 'id_front' ? setIsIdUploading : 
                         type === 'id_back' ? setIsIdUploadingBack : setIsMarriageUploading;
    const setProgress = type === 'id_front' ? setIdUploadProgress : 
                        type === 'id_back' ? setIdUploadProgressBack : setMarriageUploadProgress;
    const setUrl = type === 'id_front' ? setIdPassportUrl : 
                   type === 'id_back' ? setIdPassportUrlBack : setMarriageCertUrl;

    setUploading(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${reservation?.id || 'unknown'}-${type}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      setUrl(publicUrl);
      setProgress(100);
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setProgress(0);
    }
  };

  // Auto-sync number of guests with guest names count on initial load
  useEffect(() => {
    const validGuestCount = formData.guest_names.filter(name => name.trim() !== '').length;
    if (validGuestCount > 0 && validGuestCount !== formData.number_of_guests) {
      setFormData(prev => ({
        ...prev,
        number_of_guests: validGuestCount,
      }));
    }
  }, [formData.guest_names]);

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to edit reservations');
      return;
    }

    // Check if the selected unit is available (if unit changed)
    if (formData.unit_id !== reservation?.unit_id) {
      const selectedUnit = unitAvailability.find(u => u.id === formData.unit_id);
      if (selectedUnit && !selectedUnit.isAvailable) {
        if (selectedUnit.hasBlockedDates) {
          toast.error('Cannot assign to this unit - it has blocked dates during this period');
          return;
        }
        if (selectedUnit.hasConflict) {
          toast.error('Cannot assign to this unit - it has a conflicting reservation');
          return;
        }
      }
    }

    setSaving(true);
    
    const nights = calculateNights();
    const total = formData.price_per_night * nights;
    const commission = (total * formData.commission_rate) / 100;
    const net = total - commission;

    // Check if status is changing to cancelled
    const isBeingCancelled = formData.status === 'cancelled' && reservation?.status !== 'cancelled';

    const { error } = await supabase
      .from('reservations')
      .update({
        unit_id: formData.unit_id,
        check_in_date: format(formData.check_in_date, 'yyyy-MM-dd'),
        check_out_date: format(formData.check_out_date, 'yyyy-MM-dd'),
        number_of_guests: formData.number_of_guests,
        guest_names: formData.guest_names,
        guest_nationality: formData.guest_nationality,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        price_per_night: formData.price_per_night,
        total_price: total,
        commission_rate: formData.commission_rate,
        commission_amount: commission,
        net_revenue: net,
        source: formData.source,
        status: formData.status,
        notes: formData.notes,
        currency: formData.currency,
        payment_method: formData.payment_method || null,
        id_passport_url: idPassportUrl,
        id_passport_url_back: idPassportUrlBack,
        marriage_certificate_url: marriageCertUrl,
        arrival_time: formData.arrival_time || null,
      } as any)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update reservation');
    } else {
      toast.success('Reservation updated successfully');
      
      // Send cancellation notification if status changed to cancelled
      if (isBeingCancelled) {
        try {
          const { error: notifyError } = await supabase.functions.invoke('send-cancellation-notification', {
            body: {
              reservation_id: id,
              booking_reference: reservation?.booking_reference,
              guest_names: formData.guest_names,
              check_in_date: format(formData.check_in_date, 'yyyy-MM-dd'),
              check_out_date: format(formData.check_out_date, 'yyyy-MM-dd'),
              nights: nights,
              total_price: total,
              currency: reservation?.currency || 'USD',
              channel: reservation?.channel || '',
              source: formData.source,
              unit_name: reservation?.units?.booking_com_name || reservation?.units?.name,
              unit_number: reservation?.units?.unit_number,
            },
          });
          
          if (notifyError) {
            console.error('Failed to send cancellation notification:', notifyError);
          } else {
            toast.success('Cancellation notification sent to admins');
          }
        } catch (notifyErr) {
          console.error('Error sending cancellation notification:', notifyErr);
        }
      }
      
      setIsEditMode(false);
      fetchReservation();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!canEdit) {
      toast.error('You do not have permission to cancel reservations');
      return;
    }

    setDeleting(true);
    
    const nights = reservation?.nights || calculateNights();
    
    // Soft delete: Update status to cancelled instead of deleting
    const { error } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to cancel reservation');
      setDeleting(false);
      return;
    }
    
    // Send cancellation notification email
    try {
      await supabase.functions.invoke('send-cancellation-notification', {
        body: {
          reservation_id: id,
          booking_reference: reservation?.booking_reference,
          guest_names: reservation?.guest_names,
          check_in_date: reservation?.check_in_date,
          check_out_date: reservation?.check_out_date,
          nights: nights,
          total_price: reservation?.total_price,
          currency: reservation?.currency || 'USD',
          channel: reservation?.channel || '',
          source: reservation?.source,
          unit_name: reservation?.units?.booking_com_name || reservation?.units?.name,
          unit_number: reservation?.units?.unit_number,
        },
      });
    } catch (notifyErr) {
      console.error('Error sending cancellation notification:', notifyErr);
    }
    
    toast.success('Reservation cancelled successfully');
    navigate('/admin');
  };

  const handleDeleteLinkedCharge = async () => {
    if (!chargeToDelete) return;
    
    setDeletingCharge(true);
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', chargeToDelete.id);

      if (error) throw error;

      toast.success(`${chargeToDelete.type === 'late_checkout' ? 'Late checkout' : 'Extension'} deleted successfully`);
      setShowDeleteChargeDialog(false);
      setChargeToDelete(null);
      // Refresh linked charges
      if (reservation?.group_id) {
        fetchLinkedCharges(reservation.group_id, reservation.id);
      }
    } catch (error) {
      console.error('Error deleting linked charge:', error);
      toast.error('Failed to delete. You may not have permission.');
    } finally {
      setDeletingCharge(false);
    }
  };

  const handleDownloadDocument = async (url: string, docType: 'id_passport_url' | 'id_passport_url_back' | 'marriage_certificate_url' | 'booking_screenshot_url') => {
    setDownloading(prev => ({ ...prev, [docType]: true }));
    
    try {
      // Extract filename from URL
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      if (!filename) {
        toast.error('Invalid document URL');
        return;
      }
      
      // Determine primary and fallback buckets
      let primaryBucket = '';
      let fallbackBucket = '';
      
      if (docType === 'booking_screenshot_url') {
        primaryBucket = 'booking-screenshots';
        fallbackBucket = '';
      } else if (docType === 'marriage_certificate_url') {
        primaryBucket = 'marriage-certificates';
        fallbackBucket = 'id-passports';
      } else {
        primaryBucket = 'id-passports';
        fallbackBucket = 'marriage-certificates'; // Fallback for legacy documents
      }
      
      // Try downloading from primary bucket
      let { data, error } = await supabase.storage
        .from(primaryBucket)
        .download(filename);
      
      // If failed, try fallback bucket (for legacy documents in wrong bucket)
      if (error && fallbackBucket) {
        console.log('Trying fallback bucket:', fallbackBucket);
        const fallbackResult = await supabase.storage
          .from(fallbackBucket)
          .download(filename);
        data = fallbackResult.data;
        error = fallbackResult.error;
      }
      
      if (error || !data) {
        console.error('Error downloading document:', error);
        toast.error('Failed to download document');
        return;
      }
      
      // Create blob URL and trigger download
      const blob = new Blob([data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success('Document downloaded successfully');
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    } finally {
      setDownloading(prev => ({ ...prev, [docType]: false }));
    }
  };

  const addGuestName = () => {
    setFormData(prev => ({
      ...prev,
      guest_names: [...prev.guest_names, ''],
    }));
  };

  const removeGuestName = (index: number) => {
    if (formData.guest_names.length > 1) {
      setFormData(prev => ({
        ...prev,
        guest_names: prev.guest_names.filter((_, i) => i !== index),
      }));
    }
  };

  const updateGuestName = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      guest_names: prev.guest_names.map((name, i) => (i === index ? value : name)),
    }));
  };

  const handleDownloadConfirmation = async () => {
    if (!confirmationRef.current || !reservation) return;
    
    setDownloadingConfirmation(true);
    try {
      const dataUrl = await toPng(confirmationRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      const guestName = reservation.guest_names?.[0]?.split(' ')[0] || 'guest';
      const checkIn = format(new Date(reservation.check_in_date), 'yyyy-MM-dd');
      link.download = `suitespot-confirmation-${guestName}-${checkIn}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('Confirmation downloaded successfully');
    } catch (error) {
      console.error('Error downloading confirmation:', error);
      toast.error('Failed to download confirmation');
    } finally {
      setDownloadingConfirmation(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!reservation) return;
    
    const checkIn = format(new Date(reservation.check_in_date), 'EEEE, MMMM d, yyyy');
    const checkOut = format(new Date(reservation.check_out_date), 'EEEE, MMMM d, yyyy');
    const roomName = reservation.units?.booking_com_name || reservation.units?.name || 'N/A';
    
    // Calculate tax
    const subtotal = (reservation.price_per_night || 0) * (reservation.nights || 0);
    const taxPercentage = reservation.units?.tax_percentage || 14;
    const taxAmount = subtotal * (taxPercentage / 100);
    const totalWithTax = subtotal + taxAmount;
    
    const message = `🏨 *SuiteSpot Reservation Confirmation*

📋 *Booking Reference:* ${reservation.booking_reference}

👤 *Guest:* ${reservation.guest_names?.join(', ') || 'N/A'}
👥 *Number of Guests:* ${reservation.number_of_guests}

🏠 *Room:* ${roomName}
${reservation.units?.unit_number ? `🚪 *Unit:* #${reservation.units.unit_number}` : ''}

📅 *Check-in:* ${checkIn}
📅 *Check-out:* ${checkOut}
🌙 *Duration:* ${reservation.nights} night(s)

💵 *Subtotal:* USD ${subtotal.toFixed(2)}
${taxPercentage > 0 ? `🧾 *Taxes (${taxPercentage}%):* USD ${taxAmount.toFixed(2)}` : ''}
💰 *Total Price:* USD ${totalWithTax.toFixed(2)}

✅ Status: Confirmed

Thank you for choosing SuiteSpot! 🌟`;

    const phone = reservation.contact_phone?.replace(/\D/g, '') || '';
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    toast.success('WhatsApp opened with confirmation');
  };

  const handleShareEmail = () => {
    if (!reservation) return;
    
    const checkIn = format(new Date(reservation.check_in_date), 'EEEE, MMMM d, yyyy');
    const checkOut = format(new Date(reservation.check_out_date), 'EEEE, MMMM d, yyyy');
    const roomName = reservation.units?.booking_com_name || reservation.units?.name || 'N/A';
    
    // Calculate tax
    const subtotal = (reservation.price_per_night || 0) * (reservation.nights || 0);
    const taxPercentage = reservation.units?.tax_percentage || 14;
    const taxAmount = subtotal * (taxPercentage / 100);
    const totalWithTax = subtotal + taxAmount;
    
    const subject = `Your Reservation Confirmation - ${reservation.booking_reference}`;
    
    const body = `SuiteSpot Reservation Confirmation

Booking Reference: ${reservation.booking_reference}

GUEST DETAILS
━━━━━━━━━━━━━━
Guest Name(s): ${reservation.guest_names?.join(', ') || 'N/A'}
Number of Guests: ${reservation.number_of_guests}
${reservation.guest_nationality ? `Nationality: ${reservation.guest_nationality}` : ''}

ACCOMMODATION
━━━━━━━━━━━━━━
Room: ${roomName}
${reservation.units?.unit_number ? `Unit Number: #${reservation.units.unit_number}` : ''}

STAY DATES
━━━━━━━━━━━━━━
Check-in: ${checkIn}
Check-out: ${checkOut}
Duration: ${reservation.nights} night(s)

PRICING SUMMARY
━━━━━━━━━━━━━━
Subtotal: USD ${subtotal.toFixed(2)}
${taxPercentage > 0 ? `Taxes & Fees (${taxPercentage}%): USD ${taxAmount.toFixed(2)}` : ''}
Total Price: USD ${totalWithTax.toFixed(2)}

Status: Confirmed ✓

━━━━━━━━━━━━━━
Thank you for choosing SuiteSpot!`;

    const mailtoUrl = `mailto:${reservation.contact_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    toast.success('Email client opened with confirmation');
  };

  if (!reservation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            
            {/* Mobile back button - icon only */}
            <Button 
              variant="ghost" 
              onClick={() => navigate('/reservations-list')}
              className="md:hidden"
              size="icon"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            {/* Desktop back button with text */}
            <Button 
              variant="ghost" 
              onClick={() => navigate('/reservations-list')}
              className="hidden md:flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            
            <div>
              <h1 className="text-3xl font-bold">Reservation Details</h1>
              <p className="text-muted-foreground">Booking Reference: {reservation.booking_reference}</p>
              {reservation.channex_booking_id && (
                <p className="text-xs text-muted-foreground">Channex ID: {reservation.channex_booking_id}</p>
              )}
            </div>
          </div>
          {canEdit && !isEditMode && (
            <div className="hidden md:flex gap-2">
              <Button 
                variant="outline"
                size="icon"
                onClick={handleShareWhatsApp}
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline"
                size="icon"
                onClick={handleShareEmail}
              >
                <Mail className="h-4 w-4" />
              </Button>
              <CreateGuestAccountDialog
                reservationId={reservation.id}
                guestName={reservation.guest_names[0] || 'Guest'}
              />
              <Button 
                variant="outline"
                onClick={() => setShowRoomTransferDialog(true)}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Room Transfer
              </Button>
              <Button onClick={() => setIsEditMode(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Reservation
              </Button>
              <Button 
                variant="outline"
                onClick={handleDownloadConfirmation}
                disabled={downloadingConfirmation}
              >
                {downloadingConfirmation ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Confirmation
              </Button>
              <Button 
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancel Reservation
              </Button>
            </div>
          )}
        </div>
        {canEdit && !isEditMode && (
          <div className="flex md:hidden gap-2 mt-4 justify-center flex-wrap">
            <Button 
              variant="outline"
              size="sm"
              onClick={handleDownloadConfirmation}
              disabled={downloadingConfirmation}
            >
              {downloadingConfirmation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleShareWhatsApp}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={handleShareEmail}
            >
              <Mail className="h-4 w-4" />
            </Button>
            <CreateGuestAccountDialog
              reservationId={reservation.id}
              guestName={reservation.guest_names[0] || 'Guest'}
            />
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowRoomTransferDialog(true)}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => setIsEditMode(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button 
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
        {isEditMode && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setIsEditMode(false);
              fetchReservation();
            }}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Guest Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditMode ? (
              <>
                <div>
                  <Label>Guest Names</Label>
                  {formData.guest_names.map((name, idx) => (
                    <div key={idx} className="flex gap-2 mt-2">
                      <Input
                        value={name}
                        onChange={(e) => updateGuestName(idx, e.target.value)}
                        placeholder={`Guest ${idx + 1} name`}
                      />
                      {formData.guest_names.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeGuestName(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addGuestName}
                    className="mt-2"
                  >
                    Add Guest
                  </Button>
                </div>
                <div>
                  <Label>Number of Guests</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.number_of_guests}
                    onChange={(e) => setFormData(prev => ({ ...prev, number_of_guests: parseInt(e.target.value) || 1 }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Nationality</Label>
                  <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={nationalityOpen}
                        className="w-full justify-between mt-2"
                      >
                        {formData.guest_nationality || "Select nationality..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search nationality..." />
                        <CommandList>
                          <CommandEmpty>No nationality found.</CommandEmpty>
                          <CommandGroup>
                            {NATIONALITIES.map((nat) => (
                              <CommandItem
                                key={nat}
                                value={nat}
                                onSelect={(currentValue) => {
                                  setFormData(prev => ({ ...prev, guest_nationality: currentValue }));
                                  setNationalityOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.guest_nationality === nat ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {nat}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                    placeholder="guest@example.com"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                    placeholder="+1234567890"
                    className="mt-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-muted-foreground">Guest Names</Label>
                  <div className="mt-1 space-y-1">
                    {reservation.guest_names && reservation.guest_names.length > 0 ? (
                      reservation.guest_names.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="font-medium">{name}</span>
                          {reservation.guest_types && reservation.guest_types[idx] && (
                            <Badge variant="secondary" className="text-xs capitalize">
                              {reservation.guest_types[idx]}
                            </Badge>
                          )}
                          {reservation.guest_genders && reservation.guest_genders[idx] && (
                            <Badge variant="outline" className="text-xs">
                              {reservation.guest_genders[idx] === 'male' ? 'Male' : 'Female'}
                            </Badge>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="font-medium">N/A</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Number of Guests</Label>
                  <p className="mt-1 font-medium">{reservation.number_of_guests}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nationality</Label>
                  <p className="mt-1 font-medium">{reservation.guest_nationality || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact Email</Label>
                  <p className="mt-1 font-medium">{reservation.contact_email || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Contact Phone</Label>
                  <p className="mt-1 font-medium">{reservation.contact_phone || 'N/A'}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditMode ? (
              <>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      Unit
                      {checkingAvailability && (
                        <span className="text-xs text-muted-foreground">(checking availability...)</span>
                      )}
                    </Label>
                    {(() => {
                      const currentAvailability = unitAvailability.find(u => u.id === reservation?.unit_id);
                      if (currentAvailability?.hasBlockedDates || currentAvailability?.hasConflict) {
                        return (
                          <span className="text-xs text-orange-600 flex items-center gap-1 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            Current unit has issues - change room below
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <Select value={formData.unit_id} onValueChange={(value) => setFormData(prev => ({ ...prev, unit_id: value }))}>
                    <SelectTrigger className={cn(
                      "mt-2",
                      (() => {
                        const currentAvailability = unitAvailability.find(u => u.id === formData.unit_id);
                        if (currentAvailability?.hasBlockedDates) return "border-orange-500 bg-orange-50";
                        if (currentAvailability?.hasConflict) return "border-destructive bg-destructive/10";
                        return "";
                      })()
                    )}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...units]
                        .sort((a, b) => {
                          const availA = unitAvailability.find(u => u.id === a.id);
                          const availB = unitAvailability.find(u => u.id === b.id);
                          // Current unit first
                          if (a.id === reservation?.unit_id) return -1;
                          if (b.id === reservation?.unit_id) return 1;
                          // Then available units
                          if (availA?.isAvailable && !availB?.isAvailable) return -1;
                          if (!availA?.isAvailable && availB?.isAvailable) return 1;
                          // Then by unit number
                          return (a.unit_number || '').localeCompare(b.unit_number || '');
                        })
                        .map((unit) => {
                          const availability = unitAvailability.find(u => u.id === unit.id);
                          const isCurrentUnit = unit.id === reservation?.unit_id;
                          const hasIssue = availability && !availability.isAvailable && !isCurrentUnit;
                          
                          return (
                            <SelectItem 
                              key={unit.id} 
                              value={unit.id}
                              className={cn(
                                hasIssue && "text-destructive",
                                availability?.isAvailable && !isCurrentUnit && "text-green-600"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                {unit.name}
                                {unit.unit_number && ` - #${unit.unit_number}`}
                                {isCurrentUnit && (
                                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Current</span>
                                )}
                                {availability?.hasBlockedDates && !isCurrentUnit && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Blocked</span>
                                )}
                                {availability?.hasConflict && !isCurrentUnit && (
                                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Conflict</span>
                                )}
                                {availability?.isAvailable && !isCurrentUnit && (
                                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Available</span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {unitAvailability.filter(u => u.isAvailable && u.id !== reservation?.unit_id).length} other rooms available
                    </p>
                    {formData.unit_id !== reservation?.unit_id && (
                      <p className="text-xs">
                        {(() => {
                          const selected = unitAvailability.find(u => u.id === formData.unit_id);
                          if (!selected) return '';
                          if (selected.hasBlockedDates) return <span className="text-orange-600">⚠️ Unit has blocked dates</span>;
                          if (selected.hasConflict) return <span className="text-destructive">⚠️ Unit has a conflict</span>;
                          if (selected.isAvailable) return <span className="text-green-600">✓ Unit is available</span>;
                          return '';
                        })()}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Check-in Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal mt-2", !formData.check_in_date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.check_in_date ? format(formData.check_in_date, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.check_in_date}
                        onSelect={(date) => date && setFormData(prev => ({ ...prev, check_in_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Check-out Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal mt-2", !formData.check_out_date && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.check_out_date ? format(formData.check_out_date, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.check_out_date}
                        onSelect={(date) => date && setFormData(prev => ({ ...prev, check_out_date: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nights</Label>
                  <p className="mt-1 font-medium">{calculateNights()}</p>
                </div>
                <div>
                  <Label>Price per Night</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price_per_night}
                    onChange={(e) => setFormData(prev => ({ ...prev, price_per_night: parseFloat(e.target.value) || 0 }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Total Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.total_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_price: parseFloat(e.target.value) || 0 }))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Commission Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.commission_amount}
                    onChange={(e) => {
                      const newAmount = parseFloat(e.target.value) || 0;
                      setFormData(prev => ({ ...prev, commission_amount: newAmount }));
                      // Auto-calculate commission rate
                      if (formData.total_price > 0) {
                        const rate = (newAmount / formData.total_price) * 100;
                        setTimeout(() => {
                          setFormData(prev => ({ ...prev, commission_rate: rate }));
                        }, 0);
                      }
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Commission Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.commission_rate}
                    onChange={(e) => {
                      const newRate = parseFloat(e.target.value) || 0;
                      setFormData(prev => ({ ...prev, commission_rate: newRate }));
                      // Auto-calculate commission amount
                      const commission = (formData.total_price * newRate) / 100;
                      setTimeout(() => {
                        setFormData(prev => ({ ...prev, commission_amount: commission }));
                      }, 0);
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={formData.source} onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Emad">Emad</SelectItem>
                      <SelectItem value="Nicola">Nicola</SelectItem>
                      <SelectItem value="Youssef">Youssef</SelectItem>
                      <SelectItem value="KSS">KSS</SelectItem>
                      <SelectItem value="booking.com">booking.com</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Currency</Label>
                  {formData.source?.toLowerCase().includes('booking') ? (
                    <div className="mt-2 px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                      USD (Booking.com)
                    </div>
                  ) : (
                    <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EGP">EGP</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Payment Method</Label>
                  {formData.source?.toLowerCase().includes('booking') ? (
                    <div className="mt-2 px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                      Credit Card (Booking.com)
                    </div>
                  ) : (
                    <Select value={formData.payment_method} onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-muted-foreground">Room Name</Label>
                  <p className="mt-1 text-2xl font-bold">{reservation.units?.name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit Number</Label>
                  <p className="mt-1 font-medium">{reservation.units?.unit_number || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Check-in Date</Label>
                  <p className="mt-1 font-medium">{format(new Date(reservation.check_in_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Check-out Date</Label>
                  <p className="mt-1 font-medium">{format(new Date(reservation.check_out_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Nights</Label>
                  <p className="mt-1 font-medium">{reservation.nights}</p>
                </div>
                {(() => {
                  // Calculate pricing breakdown for display
                  const pricePerNight = reservation?.price_per_night || 0;
                  const nights = reservation?.nights || 0;
                  const subtotal = pricePerNight * nights;
                  
                  // For Booking.com: total_price is already VAT-inclusive, don't add tax
                  const isBookingCom = reservation?.source?.toLowerCase().includes('booking') || 
                                       reservation?.channel === 'Booking.com';
                  
                  if (isBookingCom) {
                    // Booking.com prices are already VAT-inclusive - use database value directly
                    const totalPrice = reservation?.total_price || subtotal;
                    
                    return (
                      <>
                        <div>
                          <Label className="text-muted-foreground">Price per Night</Label>
                          <p className="mt-1 font-medium">
                            USD {Number(pricePerNight).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Subtotal ({nights} nights)</Label>
                          <p className="mt-1 font-medium">
                            USD {subtotal.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground font-semibold">Total Price (incl. VAT)</Label>
                          <p className="mt-1 font-bold text-lg">
                            USD {Number(totalPrice).toFixed(2)}
                          </p>
                        </div>
                      </>
                    );
                  }
                  
                  // Manual/Direct reservations: calculate VAT breakdown
                  const taxPercentage = reservation?.units?.tax_percentage || 14;
                  const isVatExempt = reservation?.vat_exempt === true;
                  const taxAmount = isVatExempt ? 0 : subtotal * (taxPercentage / 100);
                  const totalWithTax = subtotal + taxAmount;
                  
                  return (
                    <>
                      <div>
                        <Label className="text-muted-foreground">Price per Night</Label>
                        <p className="mt-1 font-medium">
                          USD {Number(pricePerNight).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Subtotal ({nights} nights)</Label>
                        <p className="mt-1 font-medium">
                          USD {subtotal.toFixed(2)}
                        </p>
                      </div>
                      {!isVatExempt && taxPercentage > 0 && (
                        <div>
                          <Label className="text-muted-foreground">Taxes & Fees ({taxPercentage}%)</Label>
                          <p className="mt-1 font-medium">
                            USD {taxAmount.toFixed(2)}
                          </p>
                        </div>
                      )}
                      <div>
                        <Label className="text-muted-foreground font-semibold">Total Price (incl. VAT)</Label>
                        <p className="mt-1 font-bold text-lg">
                          USD {totalWithTax.toFixed(2)}
                        </p>
                      </div>
                    </>
                  );
                })()}
                <div>
                  <Label className="text-muted-foreground">Commission Rate</Label>
                  <p className="mt-1 font-medium">
                    {reservation.commission_amount && reservation.total_price 
                      ? ((Number(reservation.commission_amount) / Number(reservation.total_price)) * 100).toFixed(2)
                      : reservation.commission_rate || 'N/A'}%
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Commission Amount</Label>
                  <p className="mt-1 font-medium">
                    ${reservation.commission_amount ? Number(reservation.commission_amount).toFixed(2) : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Net Revenue</Label>
                  <p className="mt-1 font-medium">
                    {reservation.total_price && reservation.commission_amount
                      ? `$${(Number(reservation.total_price) - Number(reservation.commission_amount)).toFixed(2)}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Source</Label>
                  <p className="mt-1 font-medium">{reservation.source}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Channel</Label>
                  <p className="mt-1 font-medium">{reservation.channel}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Currency</Label>
                  <p className="mt-1 font-medium">{reservation.currency || 'USD'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  <p className="mt-1 font-medium">
                    {reservation.payment_method === 'cash' ? 'Cash' : 
                     reservation.payment_method === 'credit_card' ? 'Credit Card' : 
                     'Not Set'}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Status & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditMode ? (
              <>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="checked-in">Checked-In</SelectItem>
                      <SelectItem value="checked-out">Checked-Out</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Arrival Time
                  </Label>
                  <Input
                    type="time"
                    value={formData.arrival_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, arrival_time: e.target.value }))}
                    className="mt-2 w-[180px]"
                    placeholder="e.g. 14:00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">24h format (e.g. 14:00 = 2:00 PM)</p>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any notes about this reservation..."
                    className="mt-2"
                    rows={4}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Status</Label>
                  <div className="mt-2">
                    <Badge className={statusColors[reservation.status as keyof typeof statusColors]}>
                      {statusLabels[reservation.status as keyof typeof statusLabels] || reservation.status}
                    </Badge>
                  </div>
                </div>
                {((() => {
                  if (!reservation.notes) return null;
                  const patterns = [
                    /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})[:\.](\d{2})/i,
                    /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})\s*(am|pm)/i,
                  ];
                  for (const pattern of patterns) {
                    const match = reservation.notes.match(pattern);
                    if (match) return true;
                  }
                  return null;
                })()) && (
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Arrival Time
                    </Label>
                    <div className="mt-2">
                      <Badge variant="outline" className="bg-violet-100 text-violet-800 border-violet-300 gap-1">
                        <Clock className="h-3 w-3" />
                        Guest arrives at {(() => {
                          if (!reservation.notes) return '';
                          const patterns = [
                            /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})[:\.](\d{2})/i,
                            /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})\s*(am|pm)/i,
                          ];
                          for (const pattern of patterns) {
                            const match = reservation.notes.match(pattern);
                            if (match) {
                              let hours = parseInt(match[1], 10);
                              const mOrAmPm = match[2];
                              if (/^(am|pm)$/i.test(mOrAmPm)) {
                                if (mOrAmPm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
                                if (mOrAmPm.toLowerCase() === 'am' && hours === 12) hours = 0;
                                return `${hours.toString().padStart(2, '0')}:00`;
                              }
                              return `${hours.toString().padStart(2, '0')}:${mOrAmPm}`;
                            }
                          }
                          return '';
                        })()}
                      </Badge>
                    </div>
                  </div>
                )}
                {reservation.notes && (
                  <div>
                    <Label>Notes</Label>
                    <p className="mt-2 text-sm">{reservation.notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {reservation.booking_screenshot_url && reservation.source === 'booking.com' && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Booking Screenshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <img 
                  src={reservation.booking_screenshot_url} 
                  alt="Booking.com Screenshot" 
                  className="w-full max-w-2xl rounded-lg border border-border shadow-sm"
                />
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadDocument(reservation.booking_screenshot_url!, 'booking_screenshot_url')}
                  disabled={downloading.booking_screenshot_url}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {downloading.booking_screenshot_url ? 'Downloading...' : 'Download Screenshot'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents Card */}
        {(isEditMode || reservation.marriage_certificate_url || reservation.id_passport_url || reservation.id_passport_url_back) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Uploaded Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* ID/Passport Front */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <Label className="font-semibold">ID/Passport - Front</Label>
                  </div>
                  {isEditMode ? (
                    idPassportUrl ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Document uploaded
                        </span>
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span><Upload className="h-4 w-4 mr-1" /> Replace</span>
                            </Button>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,.pdf" 
                              onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'id_front')} 
                            />
                          </label>
                          <Button variant="ghost" size="sm" onClick={() => setIdPassportUrl(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input 
                          type="file" 
                          accept="image/*,.pdf"
                          onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'id_front')} 
                          disabled={isIdUploading}
                        />
                        {isIdUploading && <Progress value={idUploadProgress} className="h-2" />}
                      </div>
                    )
                  ) : (
                    reservation.id_passport_url ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Document uploaded
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDownloadDocument(reservation.id_passport_url!, 'id_passport_url')}
                          disabled={downloading.id_passport_url}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {downloading.id_passport_url ? 'Downloading...' : 'Download'}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No document uploaded</p>
                    )
                  )}
                </div>

                {/* ID/Passport Back */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <Label className="font-semibold">ID/Passport - Back</Label>
                  </div>
                  {isEditMode ? (
                    idPassportUrlBack ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Document uploaded
                        </span>
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span><Upload className="h-4 w-4 mr-1" /> Replace</span>
                            </Button>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,.pdf" 
                              onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'id_back')} 
                            />
                          </label>
                          <Button variant="ghost" size="sm" onClick={() => setIdPassportUrlBack(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input 
                          type="file" 
                          accept="image/*,.pdf"
                          onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'id_back')} 
                          disabled={isIdUploadingBack}
                        />
                        {isIdUploadingBack && <Progress value={idUploadProgressBack} className="h-2" />}
                      </div>
                    )
                  ) : (
                    reservation.id_passport_url_back ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Document uploaded
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDownloadDocument(reservation.id_passport_url_back!, 'id_passport_url_back')}
                          disabled={downloading.id_passport_url_back}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {downloading.id_passport_url_back ? 'Downloading...' : 'Download'}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No document uploaded</p>
                    )
                  )}
                </div>

                {/* Marriage Certificate */}
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <Label className="font-semibold">Marriage Certificate</Label>
                  </div>
                  {isEditMode ? (
                    marriageCertUrl ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Document uploaded
                        </span>
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <Button variant="outline" size="sm" asChild>
                              <span><Upload className="h-4 w-4 mr-1" /> Replace</span>
                            </Button>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,.pdf" 
                              onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'marriage')} 
                            />
                          </label>
                          <Button variant="ghost" size="sm" onClick={() => setMarriageCertUrl(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input 
                          type="file" 
                          accept="image/*,.pdf"
                          onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'marriage')} 
                          disabled={isMarriageUploading}
                        />
                        {isMarriageUploading && <Progress value={marriageUploadProgress} className="h-2" />}
                      </div>
                    )
                  ) : (
                    reservation.marriage_certificate_url ? (
                      <div className="space-y-2">
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <Check className="h-4 w-4" /> Document uploaded
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleDownloadDocument(reservation.marriage_certificate_url!, 'marriage_certificate_url')}
                          disabled={downloading.marriage_certificate_url}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {downloading.marriage_certificate_url ? 'Downloading...' : 'Download'}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No document uploaded</p>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Linked Charges Section */}
      {linkedCharges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Linked Charges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {linkedCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => navigate(`/reservation/${charge.id}`)}
                  >
                    <div className={cn(
                      "p-2 rounded-full",
                      charge.type === 'late_checkout' 
                        ? "bg-amber-100 text-amber-700" 
                        : "bg-blue-100 text-blue-700"
                    )}>
                      {charge.type === 'late_checkout' ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {charge.type === 'late_checkout' ? 'Late Checkout Fee' : `Extension (${charge.nights} night${charge.nights !== 1 ? 's' : ''})`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Attributed to: {charge.source || 'Admin'} • {format(new Date(charge.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold text-lg">${charge.total_price?.toFixed(2)}</div>
                      <Badge variant="outline" className="text-xs">
                        {charge.booking_reference}
                      </Badge>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChargeToDelete(charge);
                          setShowDeleteChargeDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t">
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Additional Charges</span>
                  <span className="text-primary">
                    ${linkedCharges.reduce((sum, c) => sum + (c.total_price || 0), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <RoomTransferDialog
        open={showRoomTransferDialog}
        onOpenChange={setShowRoomTransferDialog}
        reservation={reservation}
        onSuccess={() => {
          fetchReservation();
          setShowRoomTransferDialog(false);
        }}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to cancel this reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              The reservation will be marked as cancelled and retained for records. A cancellation notification will be sent to all admins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Cancelling...' : 'Yes, Cancel Reservation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteChargeDialog} onOpenChange={setShowDeleteChargeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {chargeToDelete?.type === 'late_checkout' ? 'Late Checkout Fee' : 'Extension'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the ${chargeToDelete?.total_price?.toFixed(2)} {chargeToDelete?.type === 'late_checkout' ? 'late checkout fee' : 'extension'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCharge}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLinkedCharge}
              disabled={deletingCharge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCharge ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden Confirmation Card for Download */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div
          ref={confirmationRef}
          className="bg-white p-8"
          style={{ width: '600px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 
              className="text-2xl font-bold text-gray-900" 
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              SuiteSpot
            </h1>
            <p 
              className="text-lg font-medium text-gray-900 mb-1" 
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              ICONIA Zamalek
            </p>
            <p className="text-gray-500 text-sm">Reservation Confirmation</p>
          </div>

          {/* Booking Reference */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-gray-500 text-sm mb-1">Booking Reference</p>
            <p className="text-xl font-bold text-gray-900">{reservation.booking_reference}</p>
          </div>

          {/* Guest Information */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Guest Details</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Guest Name(s)</span>
                <span className="font-medium text-gray-900">{reservation.guest_names?.join(', ') || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Number of Guests</span>
                <span className="font-medium text-gray-900">{reservation.number_of_guests}</span>
              </div>
              {reservation.guest_nationality && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Nationality</span>
                  <span className="font-medium text-gray-900">{reservation.guest_nationality}</span>
                </div>
              )}
            </div>
          </div>

          {/* Accommodation */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Accommodation</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Suite</span>
                <span className="font-medium text-gray-900">
                  {reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}
                </span>
              </div>
              {reservation.units?.unit_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Unit Number</span>
                  <span className="font-medium text-gray-900">#{reservation.units.unit_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stay Dates */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Stay Dates</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Check-in</span>
                <span className="font-medium text-gray-900">
                  {format(new Date(reservation.check_in_date), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-out</span>
                <span className="font-medium text-gray-900">
                  {format(new Date(reservation.check_out_date), 'EEEE, MMMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-900">{reservation.nights} night(s)</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Pricing Summary</h2>
            {(() => {
              const subtotal = (reservation.price_per_night || 0) * (reservation.nights || 0);
              const taxPercentage = reservation.units?.tax_percentage || 14;
              const taxAmount = subtotal * (taxPercentage / 100);
              const totalWithTax = subtotal + taxAmount;
              
              return (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price per Night</span>
                    <span className="font-medium text-gray-900">
                      USD {reservation.price_per_night?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal ({reservation.nights} nights)</span>
                    <span className="font-medium text-gray-900">
                      USD {subtotal.toFixed(2)}
                    </span>
                  </div>
                  {taxPercentage > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taxes & Fees ({taxPercentage}%)</span>
                      <span className="font-medium text-gray-900">
                        USD {taxAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t mt-2">
                    <span className="font-semibold text-gray-900">Total Price</span>
                    <span className="font-bold text-lg text-gray-900">
                      USD {totalWithTax.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Contact Information */}
          {(reservation.contact_email || reservation.contact_phone) && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Contact Information</h2>
              <div className="space-y-2">
                {reservation.contact_email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{reservation.contact_email}</span>
                  </div>
                )}
                {reservation.contact_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-900">{reservation.contact_phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-green-700 font-semibold">
              ✓ Reservation {reservation.status === 'confirmed' ? 'Confirmed' : 
                reservation.status === 'checked-in' ? 'Checked-In' :
                reservation.status === 'checked-out' ? 'Checked-Out' :
                reservation.status === 'completed' ? 'Completed' : reservation.status}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-center text-gray-400 text-xs">
            <p>Thank you for choosing SuiteSpot</p>
            <p className="mt-1">Generated on {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationDetail;
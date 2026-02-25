import { useEffect, useState } from 'react';
import { CreateReservationDialog } from '@/components/CreateReservationDialog';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Search, Users, Check, CalendarIcon, Download, FileSpreadsheet, X, Mail, CheckCircle2, XCircle, Clock, Eye, FileText, Minus, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { generateCheckInPDF, downloadCheckInPDF } from '@/lib/generateCheckInPDF';

interface CheckInAgreement {
  reservation_id: string;
  guest_full_name: string;
  guest_nationality: string | null;
  guest_date_of_birth: string | null;
  guest_phone: string;
  guest_email: string;
  signature_url: string;
  signed_at: string;
}

interface Reservation {
  id: string;
  booking_reference: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  number_of_guests: number;
  guest_names: string[];
  guest_nationality: string | null;
  status: string;
  units: { name: string; unit_number: string | null; booking_com_name: string | null } | null;
  source: string;
  price_per_night: number | null;
  total_price: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  net_revenue: number | null;
  currency: string | null;
  created_at: string;
  group_id: string | null;
  unit_id: string;
  contact_email: string | null;
  confirmation_email_status: string | null;
  confirmation_email_sent_at: string | null;
  payment_method: string | null;
  settled: string | null;
  vat_exempt: boolean | null;
  arrival_time: string | null;
  notes: string | null;
}

interface GroupedReservation extends Reservation {
  isGrouped: boolean;
  groupCount?: number;
  groupRooms?: Reservation[];
}

type SortField = 'units' | 'guest_names' | 'check_in_date' | 'check_out_date' | 'nights' | 'number_of_guests' | 'guest_nationality' | 'status' | 'source' | 'price_per_night' | 'total_price' | 'booking_reference' | 'created_at';
type SortOrder = 'asc' | 'desc';

const statusColors = {
  confirmed: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'checked-in': 'bg-green-100 text-green-800 hover:bg-green-100',
  'checked-out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  completed: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
  // Legacy status values for backwards compatibility
  Upcoming: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'In-House': 'bg-green-100 text-green-800 hover:bg-green-100',
  'Checked-Out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  Cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

const statusLabels = {
  confirmed: 'Confirmed',
  'checked-in': 'Checked-In',
  'checked-out': 'Checked-Out',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface ReservationsListProps {
  userRole?: string | null;
}

export const ReservationsList = ({ userRole }: ReservationsListProps) => {
  const propertyId = usePropertyId();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<GroupedReservation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [settledFilter, setSettledFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [units, setUnits] = useState<{ id: string; name: string; unit_number: string | null }[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedGroup, setSelectedGroup] = useState<Reservation[] | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [checkInAgreements, setCheckInAgreements] = useState<Map<string, CheckInAgreement>>(new Map());
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReservations();
    fetchUnits();
    fetchCheckInAgreements();

    // Real-time updates for reservations
    const reservationsChannel = supabase
      .channel('reservations-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        (payload) => {
          console.log('ReservationsList real-time update:', payload);
          fetchReservations();
        }
      )
      .subscribe((status) => {
        console.log('ReservationsList subscription status:', status);
      });

    // Real-time updates for units
    const unitsChannel = supabase
      .channel('units-changes-list')
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

    return () => {
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(unitsChannel);
    };
  }, []);

  useEffect(() => {
    filterReservations();
  }, [reservations, searchQuery, statusFilter, unitFilter, paymentFilter, sourceFilter, currencyFilter, sortField, sortOrder, dateRange]);

  useEffect(() => {
    // Extract unique sources from reservations
    const uniqueSources = [...new Set(reservations.map(r => r.source).filter(Boolean))].sort();
    setSources(uniqueSources);
  }, [reservations]);

  const fetchReservations = async () => {
    const { data, error } = await withPropertyFilter(supabase
      .from('reservations')
      .select('*, units!unit_id(name, unit_number, booking_com_name)')
      .order('check_in_date', { ascending: false }), propertyId);

    if (!error && data) {
      setReservations(data as unknown as Reservation[]);
    }
  };

  // Check if a reservation is an extension (has -EXT suffix)
  const isExtensionBooking = (bookingReference: string): boolean => {
    return bookingReference?.toUpperCase().includes('-EXT');
  };

  const processGroupedReservations = (reservationsList: Reservation[]): GroupedReservation[] => {
    // No grouping - every reservation is displayed as its own row
    return reservationsList.map(res => ({
      ...res,
      isGrouped: false,
    }));
  };

  const fetchUnits = async () => {
    const { data, error } = await withPropertyFilter(supabase
      .from('units')
      .select('id, name, unit_number')
      .order('unit_number'), propertyId);

    if (!error && data) {
      setUnits(data);
    }
  };

  const fetchCheckInAgreements = async () => {
    const { data, error } = await supabase
      .from('check_in_agreements')
      .select('reservation_id, guest_full_name, guest_nationality, guest_date_of_birth, guest_phone, guest_email, signature_url, signed_at');

    if (!error && data) {
      const agreementsMap = new Map<string, CheckInAgreement>();
      data.forEach((agreement) => {
        agreementsMap.set(agreement.reservation_id, agreement);
      });
      setCheckInAgreements(agreementsMap);
    }
  };

  const handlePreviewCheckInDoc = async (reservation: Reservation) => {
    const agreement = checkInAgreements.get(reservation.id);
    if (!agreement) return;

    setPreviewLoading(true);
    try {
      const pdfBlob = await generateCheckInPDF({
        guestName: agreement.guest_full_name,
        guestNationality: agreement.guest_nationality || '',
        guestDateOfBirth: agreement.guest_date_of_birth || '',
        guestPhone: agreement.guest_phone,
        guestEmail: agreement.guest_email,
        unitName: reservation.units?.name || 'N/A',
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        signatureDataUrl: agreement.signature_url,
        signedAt: new Date(agreement.signed_at),
      });
      const url = URL.createObjectURL(pdfBlob);
      setPreviewPdfUrl(url);
      setShowPreviewDialog(true);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      toast.error('Failed to generate PDF preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadCheckInDoc = async (reservation: Reservation) => {
    const agreement = checkInAgreements.get(reservation.id);
    if (!agreement) return;

    try {
      await downloadCheckInPDF({
        guestName: agreement.guest_full_name,
        guestNationality: agreement.guest_nationality || '',
        guestDateOfBirth: agreement.guest_date_of_birth || '',
        guestPhone: agreement.guest_phone,
        guestEmail: agreement.guest_email,
        unitName: reservation.units?.name || 'N/A',
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        signatureDataUrl: agreement.signature_url,
        signedAt: new Date(agreement.signed_at),
      }, `check-in-agreement-${reservation.booking_reference}.pdf`);
      toast.success('Check-in agreement downloaded');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download check-in agreement');
    }
  };

  const filterReservations = () => {
    let filtered = [...reservations];

    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.booking_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.guest_names.some((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (unitFilter !== 'all') {
      filtered = filtered.filter((r) => (r.units?.unit_number || r.units?.name) === unitFilter);
    }

    // Payment method filtering
    if (paymentFilter !== 'all') {
      filtered = filtered.filter((r) => r.payment_method === paymentFilter);
    }

    // Source filtering
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((r) => r.source === sourceFilter);
    }

    // Settled filtering
    if (settledFilter !== 'all') {
      filtered = filtered.filter((r) => r.settled === settledFilter);
    }

    // Currency filtering
    if (currencyFilter !== 'all') {
      filtered = filtered.filter((r) => r.currency === currencyFilter);
    }

    // Date range filtering
    if (dateRange.from) {
      filtered = filtered.filter(r => new Date(r.check_in_date) >= dateRange.from!);
    }
    if (dateRange.to) {
      filtered = filtered.filter(r => new Date(r.check_in_date) <= dateRange.to!);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === 'units') {
        aVal = a.units?.name || '';
        bVal = b.units?.name || '';
      } else if (sortField === 'guest_names') {
        aVal = a.guest_names.join(', ');
        bVal = b.guest_names.join(', ');
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const groupedFiltered = processGroupedReservations(filtered);
    setFilteredReservations(groupedFiltered);
  };

  const handleViewGroup = (groupRooms: Reservation[], e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGroup(groupRooms);
    setShowGroupDialog(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-3.5 w-3.5" /> 
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredReservations.map(r => r.id));
      setSelectedReservations(allIds);
    } else {
      setSelectedReservations(new Set());
    }
  };

  const handleSelectReservation = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedReservations);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedReservations(newSelected);
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedReservations.size === 0) {
      toast.error('Please select at least one reservation');
      return;
    }
    
    if (!bulkStatus) {
      toast.error('Please select a status');
      return;
    }

    setIsUpdating(true);
    
    try {
      const isCancelling = bulkStatus === 'cancelled';
      
      // Build update object - include cancelled_at if cancelling
      const updateData: Record<string, unknown> = { status: bulkStatus };
      if (isCancelling) {
        updateData.cancelled_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('reservations')
        .update(updateData)
        .in('id', Array.from(selectedReservations));

      if (error) {
        toast.error('Failed to update reservations');
        console.error('Bulk update error:', error);
      } else {
        // If cancelling, send notifications for each reservation
        if (isCancelling) {
          const selectedIds = Array.from(selectedReservations);
          
          // Get full reservation details for notifications
          const { data: cancelledReservations } = await supabase
            .from('reservations')
            .select('*, units!unit_id(name, unit_number, booking_com_name)')
            .in('id', selectedIds);
          
          // Send cancellation notifications
          for (const reservation of (cancelledReservations || [])) {
            try {
              await supabase.functions.invoke('send-cancellation-notification', {
                body: {
                  reservation_id: reservation.id,
                  booking_reference: reservation.booking_reference,
                  guest_names: reservation.guest_names,
                  check_in_date: reservation.check_in_date,
                  check_out_date: reservation.check_out_date,
                  nights: reservation.nights,
                  total_price: reservation.total_price,
                  currency: reservation.currency || 'USD',
                  channel: reservation.channel || '',
                  source: reservation.source,
                  unit_name: reservation.units?.booking_com_name || reservation.units?.name,
                  unit_number: reservation.units?.unit_number,
                },
              });
              console.log('Cancellation notification sent for reservation:', reservation.id);
            } catch (notifyErr) {
              console.error('Error sending cancellation notification for', reservation.id, notifyErr);
            }
          }
          
          toast.success(`Cancelled ${selectedReservations.size} reservation(s) and sent notifications`);
        } else {
          toast.success(`Successfully updated ${selectedReservations.size} reservation(s)`);
        }
        
        setSelectedReservations(new Set());
        setBulkStatus('');
        fetchReservations();
      }
    } catch (error) {
      toast.error('An error occurred while updating reservations');
      console.error('Bulk update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReservations.size === 0) return;
    
    setIsDeleting(true);
    
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .in('id', Array.from(selectedReservations));

      if (error) {
        toast.error('Failed to delete reservations');
        console.error('Bulk delete error:', error);
      } else {
        toast.success(`Successfully deleted ${selectedReservations.size} reservation(s)`);
        setSelectedReservations(new Set());
        fetchReservations();
      }
    } catch (error) {
      toast.error('An error occurred while deleting reservations');
      console.error('Bulk delete error:', error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedReservations.size === 0) return;
    
    setIsCancelling(true);
    
    try {
      // Update reservations to cancelled status
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .in('id', Array.from(selectedReservations));

      if (updateError) {
        toast.error('Failed to cancel reservations');
        console.error('Bulk cancel error:', updateError);
        return;
      }

      // Fetch full reservation details for email notifications
      const { data: cancelledReservations, error: fetchError } = await supabase
        .from('reservations')
        .select(`
          id,
          booking_reference,
          guest_names,
          check_in_date,
          check_out_date,
          nights,
          number_of_guests,
          total_price,
          currency,
          source,
          channel,
          units!unit_id (name, unit_number, booking_com_name)
        `)
        .in('id', Array.from(selectedReservations));

      if (fetchError) {
        console.error('Error fetching cancelled reservations:', fetchError);
      } else if (cancelledReservations) {
        // Send cancellation notification emails for each reservation
        for (const reservation of cancelledReservations) {
          try {
            await supabase.functions.invoke('send-cancellation-notification', {
              body: {
                reservation_id: reservation.id,
                booking_reference: reservation.booking_reference,
                guest_names: reservation.guest_names,
                check_in_date: reservation.check_in_date,
                check_out_date: reservation.check_out_date,
                nights: reservation.nights || 1,
                total_price: reservation.total_price,
                currency: reservation.currency || 'USD',
                channel: reservation.channel || '',
                source: reservation.source,
                unit_name: (reservation.units as any)?.booking_com_name || reservation.units?.name || 'Unknown',
                unit_number: reservation.units?.unit_number || '',
              }
            });
          } catch (emailError) {
            console.error('Error sending cancellation email:', emailError);
          }
        }
      }

      toast.success(`Successfully cancelled ${selectedReservations.size} reservation(s)`);
      setSelectedReservations(new Set());
      fetchReservations();
    } catch (error) {
      toast.error('An error occurred while cancelling reservations');
      console.error('Bulk cancel error:', error);
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const formatPaymentMethod = (method: string | null): string => {
    if (!method) return '-';
    const labels: Record<string, string> = {
      'credit_card': 'Credit Card',
      'cash': 'Cash',
      'bank_transfer': 'Bank Transfer',
    };
    return labels[method] || method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatSettled = (settled: string | null): string => {
    if (!settled) return '-';
    const labels: Record<string, string> = {
      'booking_com': 'Booking.com',
      'yes': 'Yes',
      'no': 'No',
    };
    return labels[settled] || settled;
  };

  const getExportData = () => {
    const dataToExport = selectedReservations.size > 0
      ? filteredReservations.filter(r => selectedReservations.has(r.id))
      : filteredReservations;

    return dataToExport.map(r => {
      const isVatExempt = r.vat_exempt === true;
      const netRevenue = r.total_price 
        ? (isVatExempt ? Number(r.total_price) : Number(r.total_price) / 1.14)
        : null;
      const vatAmount = r.total_price 
        ? (isVatExempt ? 0 : Number(r.total_price) - Number(r.total_price) / 1.14)
        : null;
      
      return {
        'Room Name': r.units?.name || 'N/A',
        'Room #': r.units?.unit_number || '-',
        'Guest Name(s)': r.guest_names.join(', '),
        'Check-in': format(new Date(r.check_in_date), 'dd MMM yyyy'),
        'Arrival Time': r.arrival_time || parseArrivalTimeFromNotes(r.notes) || '-',
        'Check-out': format(new Date(r.check_out_date), 'dd MMM yyyy'),
        'Nights': r.nights,
        'Guests': r.number_of_guests,
        'Nationality': r.guest_nationality || 'N/A',
        'Status': statusLabels[r.status as keyof typeof statusLabels] || r.status,
        'Source': r.source,
        'Price/Night': r.price_per_night ? `$${Number(r.price_per_night).toFixed(2)}` : '-',
        'Net Revenue': netRevenue !== null ? `$${netRevenue.toFixed(2)}` : '-',
        'VAT (14%)': vatAmount !== null ? `$${vatAmount.toFixed(2)}` : '-',
        'Total Revenue': r.total_price ? `$${Number(r.total_price).toFixed(2)}` : '-',
        'Payment': formatPaymentMethod(r.payment_method),
        'Currency': getCurrencyLabel(r.currency),
        'Settled': formatSettled(r.settled),
        'Reference': r.booking_reference,
        'Created': format(new Date(r.created_at), 'dd MMM yyyy'),
      };
    });
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('No reservations to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reservations');
    
    const filename = `reservations_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${data.length} reservation(s) to Excel`);
  };

  const handleExportCSV = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('No reservations to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservations_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    toast.success(`Exported ${data.length} reservation(s) to CSV`);
  };

  const handlePaymentMethodChange = async (reservationId: string, paymentMethod: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ payment_method: paymentMethod })
      .eq('id', reservationId);

    if (error) {
      toast.error('Failed to update payment method');
      console.error('Payment method update error:', error);
    } else {
      toast.success('Payment method updated');
      fetchReservations();
    }
  };

  const handleSettledChange = async (reservationId: string, settledValue: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ settled: settledValue })
      .eq('id', reservationId);

    if (error) {
      toast.error('Failed to update settled status');
      console.error('Settled update error:', error);
    } else {
      toast.success('Settled status updated');
      fetchReservations();
    }
  };

  const handleCurrencyChange = async (reservationId: string, currency: string) => {
    const { error } = await supabase
      .from('reservations')
      .update({ currency })
      .eq('id', reservationId);

    if (error) {
      toast.error('Failed to update currency');
      console.error('Currency update error:', error);
    } else {
      toast.success('Currency updated');
      fetchReservations();
    }
  };

  // Parse arrival time from notes field (looks for patterns like "arrival at 14:00", "ETA 15:30", "arriving 13:00", etc.)
  const parseArrivalTimeFromNotes = (notes: string | null): string | null => {
    if (!notes) return null;
    // Match patterns like: "arrival at 14:00", "ETA: 15:30", "arriving at 1pm", "check-in time: 14:00", "arrives at 13:00", "arrival 16:00"
    const patterns = [
      /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})[:\.](\d{2})/i,
      /(?:arriv(?:al|ing|e|es)|eta|check[\s-]?in[\s-]?time|expected[\s-]?(?:at|time))[\s:]*(?:at\s*)?(\d{1,2})\s*(am|pm)/i,
    ];

    for (const pattern of patterns) {
      const match = notes.match(pattern);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutesOrAmPm = match[2];

        if (minutesOrAmPm && /^(am|pm)$/i.test(minutesOrAmPm)) {
          // Handle AM/PM format
          if (minutesOrAmPm.toLowerCase() === 'pm' && hours !== 12) hours += 12;
          if (minutesOrAmPm.toLowerCase() === 'am' && hours === 12) hours = 0;
          return `${hours.toString().padStart(2, '0')}:00`;
        } else {
          // Handle 24h format
          return `${hours.toString().padStart(2, '0')}:${minutesOrAmPm}`;
        }
      }
    }
    return null;
  };

  const handleArrivalTimeChange = async (reservationId: string, arrivalTime: string) => {
    // Validate HH:MM format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (arrivalTime && !timeRegex.test(arrivalTime)) {
      toast.error('Please enter time in HH:MM format (e.g., 14:00)');
      return;
    }

    const { error } = await supabase
      .from('reservations')
      .update({ arrival_time: arrivalTime || null } as any)
      .eq('id', reservationId);

    if (error) {
      toast.error('Failed to update arrival time');
      console.error('Arrival time update error:', error);
    } else {
      toast.success('Arrival time updated');
      fetchReservations();
    }
  };

  // Get effective arrival time: stored value OR parsed from notes
  const getEffectiveArrivalTime = (reservation: Reservation): string | null => {
    if (reservation.arrival_time) return reservation.arrival_time;
    return parseArrivalTimeFromNotes(reservation.notes);
  };

  const getCurrencyLabel = (currency: string | null) => {
    switch (currency) {
      case 'USD': return 'Dollars (USD)';
      case 'AED': return 'Dirhams (AED)';
      case 'SAR': return 'Riyals (SAR)';
      case 'EGP': return 'Egyptian Pounds (EGP)';
      default: return currency || '-';
    }
  };

  // Helper to detect Booking.com reservations
  const isBookingComReservation = (reservation: Reservation): boolean => {
    return reservation.source?.toLowerCase().includes('booking') || false;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Name or booking reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="checked-in">Checked-In</SelectItem>
            <SelectItem value="checked-out">Checked-Out</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Units" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.unit_number || unit.name}>
                {unit.unit_number || unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full sm:w-[240px] justify-start text-left font-normal",
                !dateRange.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "MMM dd, yyyy")} - {format(dateRange.to, "MMM dd, yyyy")}
                  </>
                ) : (
                  format(dateRange.from, "MMM dd, yyyy")
                )
              ) : (
                <span>Select date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Payment, Source, and Export Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap">
        {/* 2-column grid for mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-4 w-full sm:w-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment</label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All Payments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="booking_com">Booking.com</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Settled</label>
            <Select value={settledFilter} onValueChange={setSettledFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All Settled" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Settled</SelectItem>
                <SelectItem value="booking_com">Booking.com</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Source</label>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Currency</label>
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Currencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="USD">Dollars (USD)</SelectItem>
                <SelectItem value="AED">Dirhams (AED)</SelectItem>
                <SelectItem value="SAR">Riyals (SAR)</SelectItem>
                <SelectItem value="EGP">Egyptian Pounds (EGP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(dateRange.from || dateRange.to) && (
          <Button
            variant="outline"
            onClick={() => setDateRange({ from: undefined, to: undefined })}
            className="sm:w-auto"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Dates
          </Button>
        )}


      </div>

      {/* Bulk Actions Toolbar */}
      {selectedReservations.size > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex flex-col gap-4">
            {/* Selection count */}
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-primary" />
              <span className="font-medium">
                {selectedReservations.size} reservation(s) selected
              </span>
            </div>
            
            {/* Status update row */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked-in">Checked-In</SelectItem>
                  <SelectItem value="checked-out">Checked-Out</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleBulkStatusUpdate} 
                disabled={isUpdating || !bulkStatus}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                {isUpdating ? 'Updating...' : 'Update Status'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSelectedReservations(new Set())}
                size="sm"
                className="flex-1 sm:flex-none"
              >
                Clear Selection
              </Button>
            </div>
            
            {/* Cancel and Delete row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-primary/20">
              <Button 
                variant="outline" 
                onClick={() => setShowCancelConfirm(true)}
                size="sm"
                className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 flex-1 sm:flex-none"
              >
                <XCircle className="h-4 w-4" />
                Cancel Reservations
              </Button>
              
              {userRole === 'admin' && (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                  size="sm"
                  className="gap-1 flex-1 sm:flex-none"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Permanently Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-700">
              <XCircle className="h-5 w-5" />
              Cancel Reservations
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to cancel {selectedReservations.size} reservation(s)?
              </p>
              <p className="text-muted-foreground">
                The reservations will be marked as cancelled and admin users will receive email notifications.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Go Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkCancel} 
              disabled={isCancelling}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {isCancelling ? 'Cancelling...' : 'Yes, Cancel Reservations'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Delete Reservations
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to <strong>permanently delete</strong> {selectedReservations.size} reservation(s)?
              </p>
              <p className="text-destructive font-medium">
                This action cannot be undone. The reservations will be completely removed from the system.
              </p>
              <p className="text-muted-foreground text-xs">
                Tip: If you want to cancel a booking but keep it in records, use "Cancel Reservations" instead.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Go Back</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] md:w-[50px] min-w-[40px] md:min-w-[50px] max-w-[40px] md:max-w-[50px] sticky left-0 z-20 bg-background">
                <Checkbox
                  checked={selectedReservations.size === filteredReservations.length && filteredReservations.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead 
                className="w-[100px] md:w-[180px] min-w-[100px] md:min-w-[180px] max-w-[100px] md:max-w-[180px] cursor-pointer hover:bg-muted/50 sticky left-[40px] md:left-[50px] z-20 bg-background"
                onClick={() => handleSort('units')}
              >
                <div className="flex items-center gap-1 truncate">
                  Room Name {getSortIcon('units')}
                </div>
              </TableHead>
              <TableHead className="w-[50px] md:w-[80px] min-w-[50px] md:min-w-[80px] max-w-[50px] md:max-w-[80px] sticky left-[140px] md:left-[230px] z-20 bg-background">
                Room #
              </TableHead>
              <TableHead 
                className="w-[120px] md:w-[180px] min-w-[120px] md:min-w-[180px] max-w-[120px] md:max-w-[180px] cursor-pointer hover:bg-muted/50 md:sticky md:left-[310px] z-20 bg-background"
                onClick={() => handleSort('guest_names')}
              >
                <div className="flex items-center gap-1 truncate">
                  Guest Name(s) {getSortIcon('guest_names')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center gap-1">
                  Source {getSortIcon('source')}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('check_in_date')}
              >
                <div className="flex items-center gap-1">
                  Check-in {getSortIcon('check_in_date')}
                </div>
              </TableHead>
              <TableHead className="w-[100px] min-w-[100px]">
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Arrival Time
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('check_out_date')}
              >
                <div className="flex items-center gap-1">
                  Check-out {getSortIcon('check_out_date')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('nights')}
              >
                <div className="flex items-center gap-1">
                  Nights {getSortIcon('nights')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('number_of_guests')}
              >
                <div className="flex items-center gap-1">
                  Guests {getSortIcon('number_of_guests')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('guest_nationality')}
              >
                <div className="flex items-center gap-1">
                  Nationality {getSortIcon('guest_nationality')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status {getSortIcon('status')}
                </div>
              </TableHead>
              <TableHead>Check-in Doc</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('price_per_night')}
              >
                <div className="flex items-center justify-end gap-1">
                  Price/Night {getSortIcon('price_per_night')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right"
                onClick={() => handleSort('total_price')}
              >
                <div className="flex items-center justify-end gap-1">
                  Net Revenue {getSortIcon('total_price')}
                </div>
              </TableHead>
              <TableHead className="text-right">
                VAT (14%)
              </TableHead>
              <TableHead className="text-right">
                Total Revenue
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('booking_reference')}
              >
                <div className="flex items-center gap-1">
                  Reference {getSortIcon('booking_reference')}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('created_at')}
              >
                <div className="flex items-center gap-1">
                  Date Created {getSortIcon('created_at')}
                </div>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Settled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={22} className="text-center text-muted-foreground">
                  No reservations found
                </TableCell>
              </TableRow>
            ) : (
              filteredReservations.map((reservation) => (
                <TableRow
                  key={reservation.id}
                  className="hover:bg-muted/50"
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="w-[40px] md:w-[50px] min-w-[40px] md:min-w-[50px] max-w-[40px] md:max-w-[50px] sticky left-0 z-10 bg-background">
                    <Checkbox
                      checked={selectedReservations.has(reservation.id)}
                      onCheckedChange={(checked) => handleSelectReservation(reservation.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell 
                    className="w-[100px] md:w-[180px] min-w-[100px] md:min-w-[180px] max-w-[100px] md:max-w-[180px] font-medium cursor-pointer sticky left-[40px] md:left-[50px] z-10 bg-background"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{reservation.units?.booking_com_name || reservation.units?.name || 'N/A'}</span>
                      {reservation.isGrouped && reservation.groupCount && (
                        <Badge 
                          variant="outline" 
                          className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 shrink-0"
                          onClick={(e) => handleViewGroup(reservation.groupRooms!, e)}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {reservation.groupCount} rooms
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell 
                    className="w-[50px] md:w-[80px] min-w-[50px] md:min-w-[80px] max-w-[50px] md:max-w-[80px] cursor-pointer sticky left-[140px] md:left-[230px] z-10 bg-background"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.isGrouped && reservation.groupCount ? (
                      <span className="text-muted-foreground text-xs">Multiple</span>
                    ) : (
                      reservation.units?.unit_number || '-'
                    )}
                  </TableCell>
                  <TableCell 
                    className="w-[120px] md:w-[180px] min-w-[120px] md:min-w-[180px] max-w-[120px] md:max-w-[180px] cursor-pointer md:sticky md:left-[310px] z-10 bg-background"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    <span className="truncate block">{reservation.guest_names?.length > 0 ? reservation.guest_names.join(', ') : 'N/A'}</span>
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer border-r border-border shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.source?.toLowerCase().includes('booking') 
                      ? 'Booking.com' 
                      : reservation.source || 'N/A'}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {format(new Date(reservation.check_in_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const effectiveTime = getEffectiveArrivalTime(reservation);
                      const isFromNotes = !reservation.arrival_time && effectiveTime;
                      return (
                        <div className="flex items-center gap-1">
                          <Input
                            type="time"
                            defaultValue={effectiveTime || ''}
                            className={cn(
                              "w-[90px] h-7 text-xs",
                              isFromNotes && "border-amber-300 bg-amber-50"
                            )}
                            title={isFromNotes ? 'Auto-detected from notes (click to confirm/edit)' : 'Set arrival time'}
                            onBlur={(e) => {
                              const newVal = e.target.value;
                              if (newVal !== (reservation.arrival_time || '')) {
                                handleArrivalTimeChange(reservation.id, newVal);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                          {effectiveTime && !reservation.arrival_time && (
                            <span className="text-amber-500" title="Parsed from notes">
                              <Clock className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {format(new Date(reservation.check_out_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.nights}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.number_of_guests}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.guest_nationality || 'N/A'}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    <Badge className={statusColors[reservation.status as keyof typeof statusColors]}>
                      {statusLabels[reservation.status as keyof typeof statusLabels] || reservation.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {checkInAgreements.has(reservation.id) ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handlePreviewCheckInDoc(reservation)}
                          title="Preview check-in document"
                          disabled={previewLoading}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDownloadCheckInDoc(reservation)}
                          title="Download check-in document"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        <Minus className="h-4 w-4" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.isGrouped && reservation.groupCount ? (
                      <span className="text-muted-foreground text-xs">Various</span>
                    ) : (
                      reservation.price_per_night ? `$${Number(reservation.price_per_night).toFixed(2)}` : '-'
                    )}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.total_price 
                      ? `$${(reservation.vat_exempt ? Number(reservation.total_price) : Number(reservation.total_price) / 1.14).toFixed(2)}` 
                      : '-'}
                  </TableCell>
                  <TableCell 
                    className="text-right text-muted-foreground cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.total_price 
                      ? `$${(reservation.vat_exempt ? 0 : Number(reservation.total_price) - Number(reservation.total_price) / 1.14).toFixed(2)}` 
                      : '-'}
                  </TableCell>
                  <TableCell 
                    className="text-right font-medium cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {reservation.total_price ? `$${Number(reservation.total_price).toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell 
                    className="font-mono text-sm cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      {reservation.booking_reference}
                      {isExtensionBooking(reservation.booking_reference) && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Extension
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => navigate(`/reservation/${reservation.id}`)}
                  >
                    {format(new Date(reservation.created_at), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell>
                    {!reservation.contact_email ? (
                      <span className="text-muted-foreground text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        No email
                      </span>
                    ) : reservation.confirmation_email_status === 'sent' ? (
                      <span className="text-green-600 flex items-center gap-1" title={`Sent ${reservation.confirmation_email_sent_at ? format(new Date(reservation.confirmation_email_sent_at), 'dd MMM HH:mm') : ''}`}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">Sent</span>
                      </span>
                    ) : reservation.confirmation_email_status === 'failed' ? (
                      <span className="text-destructive flex items-center gap-1" title="Email failed to send">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">Failed</span>
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1" title="Email not yet sent">
                        <Mail className="h-3 w-3" />
                        <span className="text-xs">Pending</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isBookingComReservation(reservation) ? (
                      <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                        Credit Card
                      </span>
                    ) : (
                      <Select
                        value={reservation.payment_method || ''}
                        onValueChange={(value) => handlePaymentMethodChange(reservation.id, value)}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="credit_card">Credit Card</SelectItem>
                          <SelectItem value="booking_com">Booking.com</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isBookingComReservation(reservation) ? (
                      <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                        Dollars (USD)
                      </span>
                    ) : (
                      <Select
                        value={reservation.currency || ''}
                        onValueChange={(value) => handleCurrencyChange(reservation.id, value)}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">Dollars (USD)</SelectItem>
                          <SelectItem value="AED">Dirhams (AED)</SelectItem>
                          <SelectItem value="SAR">Riyals (SAR)</SelectItem>
                          <SelectItem value="EGP">Egyptian Pounds (EGP)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {isBookingComReservation(reservation) ? (
                      <span className="text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                        Booking.com
                      </span>
                    ) : (
                      <Select
                        value={reservation.settled || ''}
                        onValueChange={(value) => handleSettledChange(reservation.id, value)}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="booking_com">Booking.com</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Group Details Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Multi-Room Booking Details</DialogTitle>
            <DialogDescription>
              This booking includes {selectedGroup?.length} rooms
            </DialogDescription>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="space-y-4">
              {/* Group Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Guest Name</p>
                  <p className="font-semibold">{selectedGroup[0].guest_names.join(', ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Rooms</p>
                  <p className="font-semibold">{selectedGroup.length}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Check-in</p>
                  <p className="font-semibold">{format(new Date(selectedGroup[0].check_in_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Check-out</p>
                  <p className="font-semibold">{format(new Date(selectedGroup[0].check_out_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Combined Total</p>
                  <p className="font-semibold text-lg">
                    ${selectedGroup.reduce((sum, r) => sum + (Number(r.total_price) || 0), 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedGroup[0].status as keyof typeof statusColors]}>
                    {selectedGroup[0].status}
                  </Badge>
                </div>
              </div>

              {/* Individual Rooms */}
              <div className="space-y-2">
                <h3 className="font-semibold">Individual Rooms</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room</TableHead>
                        <TableHead>Room Name</TableHead>
                        <TableHead>Room #</TableHead>
                        <TableHead className="text-right">Price/Night</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Booking Ref</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedGroup.map((room, index) => (
                        <TableRow key={room.id}>
                          <TableCell className="font-medium">Room {index + 1}</TableCell>
                          <TableCell>{room.units?.name || 'N/A'}</TableCell>
                          <TableCell>{room.units?.unit_number || '-'}</TableCell>
                          <TableCell className="text-right">
                            ${Number(room.price_per_night).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${Number(room.total_price).toFixed(2)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{room.booking_reference}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowGroupDialog(false);
                                navigate(`/reservation/${room.id}`);
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        setShowPreviewDialog(open);
        if (!open && previewPdfUrl) {
          URL.revokeObjectURL(previewPdfUrl);
          setPreviewPdfUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Check-in Agreement Preview</DialogTitle>
            <DialogDescription>
              Signed check-in agreement document
            </DialogDescription>
          </DialogHeader>
          {previewPdfUrl && (
            <iframe
              src={previewPdfUrl}
              className="w-full h-full min-h-[60vh] border rounded"
              title="Check-in Agreement PDF Preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
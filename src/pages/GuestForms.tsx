import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  format, 
  differenceInDays, 
  differenceInHours,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  isAfter,
  parseISO
} from 'date-fns';
import { downloadCheckInPDF } from '@/lib/generateCheckInPDF';
import { cn } from '@/lib/utils';
import { SlideMenu } from '@/components/SlideMenu';
import { NotificationBell } from '@/components/NotificationBell';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileCheck,
  FileX,
  Mail,
  Files,
  Download,
  Search,
  Copy,
  Check,
  ExternalLink,
  ArrowLeft,
  BookOpen,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { PassportUploadDialog } from '@/components/PassportUploadDialog';
import { toast } from 'sonner';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';

interface Unit {
  name: string;
  unit_number: string | null;
}

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  guest_nationality: string | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  checked_in_at: string | null;
  units: Unit | null;
}

interface CheckInAgreement {
  id: string;
  reservation_id: string;
  guest_full_name: string;
  guest_nationality: string | null;
  guest_date_of_birth: string | null;
  guest_phone: string;
  guest_email: string;
  signature_url: string;
  signed_at: string;
}

type FilterType = 'all' | 'completed' | 'pending' | 'emails';
type DateFilterType = 'all' | 'week' | 'month' | 'ytd';
type SortField = 'check_in_status' | 'form_status' | 'signed_at' | null;
type SortOrder = 'asc' | 'desc';

export default function GuestForms() {
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading, hasPermission } = useAuth();
  const propertyId = usePropertyId();

  useEffect(() => {
    if (!authLoading && userRole && userRole !== 'admin' && !hasPermission('can_access_front_desk')) {
      navigate('/admin');
    }
  }, [userRole, authLoading, hasPermission, navigate]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [agreements, setAgreements] = useState<CheckInAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [passportDialogOpen, setPassportDialogOpen] = useState(false);
  const [passportReservation, setPassportReservation] = useState<{ id: string; guestName: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, propertyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch reservations with checked-in, checked-out, or confirmed status (where check-in date is today or earlier)
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: reservationsData, error: reservationsError } = await withPropertyFilter(supabase
        .from('reservations')
        .select(`
          id,
          booking_reference,
          guest_names,
          guest_nationality,
          check_in_date,
          check_out_date,
          status,
          checked_in_at,
          units!unit_id (name, unit_number)
        `)
        .in('status', ['checked-in', 'checked-out', 'confirmed'])
        .lte('check_in_date', today)
        .order('check_in_date', { ascending: false }), propertyId);

      if (reservationsError) throw reservationsError;

      // Fetch all check-in agreements
      const { data: agreementsData, error: agreementsError } = await supabase
        .from('check_in_agreements')
        .select('*');

      if (agreementsError) throw agreementsError;

      setReservations(reservationsData || []);
      setAgreements(agreementsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load guest forms data');
    } finally {
      setLoading(false);
    }
  };

  // Create a map for quick agreement lookup
  const agreementsMap = useMemo(() => {
    return new Map(agreements.map(a => [a.reservation_id, a]));
  }, [agreements]);

  // Compute statistics
  const stats = useMemo(() => {
    const withForm = reservations.filter(r => agreementsMap.has(r.id));
    const withoutForm = reservations.filter(r => !agreementsMap.has(r.id));
    const uniqueEmails = new Set(
      agreements.map(a => a.guest_email?.toLowerCase()).filter(Boolean)
    );

    return {
      checkedInWithForm: withForm.length,
      checkedInWithoutForm: withoutForm.length,
      totalEmails: uniqueEmails.size,
      totalForms: agreements.length,
    };
  }, [reservations, agreements, agreementsMap]);

  // Get unique emails for modal
  const uniqueEmails = useMemo(() => {
    return [...new Set(
      agreements.map(a => a.guest_email?.toLowerCase()).filter(Boolean)
    )].sort();
  }, [agreements]);

  // Combined data for table
  const tableData = useMemo(() => {
    return reservations.map(res => ({
      reservation: res,
      agreement: agreementsMap.get(res.id) || null,
      hasForm: agreementsMap.has(res.id),
    }));
  }, [reservations, agreementsMap]);

  // Filtered data based on active filter, date filter, search, and sorting
  const filteredData = useMemo(() => {
    let data = tableData;

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (dateFilter) {
        case 'week':
          startDate = startOfWeek(now, { weekStartsOn: 0 });
          break;
        case 'month':
          startDate = startOfMonth(now);
          break;
        case 'ytd':
          startDate = startOfYear(now);
          break;
        default:
          startDate = new Date(0);
      }
      const endDate = now;
      
      data = data.filter(d => {
        const checkIn = parseISO(d.reservation.check_in_date);
        const checkOut = parseISO(d.reservation.check_out_date);
        return (checkIn >= startDate && checkIn <= endDate) ||
               (checkOut >= startDate && checkOut <= endDate) ||
               (checkIn <= startDate && checkOut >= endDate);
      });
    }

    // Apply card filter
    if (activeFilter === 'completed') {
      data = data.filter(d => d.hasForm);
    } else if (activeFilter === 'pending') {
      data = data.filter(d => !d.hasForm);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      data = data.filter(d => {
        const guestName = d.reservation.guest_names?.[0]?.toLowerCase() || '';
        const bookingRef = d.reservation.booking_reference?.toLowerCase() || '';
        const formName = d.agreement?.guest_full_name?.toLowerCase() || '';
        const formEmail = d.agreement?.guest_email?.toLowerCase() || '';
        const roomNumber = d.reservation.units?.unit_number?.toLowerCase() || '';

        return (
          guestName.includes(query) ||
          bookingRef.includes(query) ||
          formName.includes(query) ||
          formEmail.includes(query) ||
          roomNumber.includes(query)
        );
      });
    }

    // Apply sorting
    if (sortField) {
      data = [...data].sort((a, b) => {
        let aVal: number;
        let bVal: number;

        switch (sortField) {
          case 'check_in_status':
            // Order: checked-in > checked-out > confirmed (Pending)
            const statusOrder: Record<string, number> = { 'checked-in': 1, 'checked-out': 2, 'confirmed': 3 };
            aVal = statusOrder[a.reservation.status] || 4;
            bVal = statusOrder[b.reservation.status] || 4;
            break;
          case 'form_status':
            // Completed (true) comes before Pending (false)
            aVal = a.hasForm ? 0 : 1;
            bVal = b.hasForm ? 0 : 1;
            break;
          case 'signed_at':
            aVal = a.agreement?.signed_at ? new Date(a.agreement.signed_at).getTime() : 0;
            bVal = b.agreement?.signed_at ? new Date(b.agreement.signed_at).getTime() : 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [tableData, activeFilter, searchQuery, dateFilter, sortField, sortOrder]);

  const handleExportCSV = () => {
    const escapeCSV = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const headers = ['Room', 'Guest Name', 'Check-In', 'Check-Out', 'Booking Ref', 'Check-In Status', 'Form Status', 'Form Name', 'Form Email', 'Form Phone', 'Signed At', 'Nationality', 'Age'];
    const rows = filteredData.map(d => [
      d.reservation.units?.unit_number || d.reservation.units?.name || '',
      d.reservation.guest_names?.[0] || '',
      d.reservation.check_in_date,
      d.reservation.check_out_date,
      d.reservation.booking_reference || '',
      d.reservation.status || '',
      d.hasForm ? 'Completed' : 'Pending',
      d.agreement?.guest_full_name || '',
      d.agreement?.guest_email || '',
      d.agreement?.guest_phone || '',
      d.agreement?.signed_at ? format(new Date(d.agreement.signed_at), 'yyyy-MM-dd HH:mm') : '',
      d.agreement?.guest_nationality || '',
      d.agreement?.guest_date_of_birth || '',
    ].map(v => escapeCSV(String(v))));

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guest-forms-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async (reservation: Reservation, agreement: CheckInAgreement) => {
    setDownloadingId(reservation.id);
    try {
      await downloadCheckInPDF(
        {
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
        },
        `guest-form-${reservation.booking_reference}.pdf`
      );
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch {
      toast.error('Failed to copy email');
    }
  };

  const handleCopyAllEmails = async () => {
    try {
      await navigator.clipboard.writeText(uniqueEmails.join('\n'));
      toast.success(`Copied ${uniqueEmails.length} emails to clipboard`);
    } catch {
      toast.error('Failed to copy emails');
    }
  };

  const handleCardClick = (filter: FilterType) => {
    if (filter === 'emails') {
      setEmailModalOpen(true);
    } else if (filter === 'all') {
      setActiveFilter('all');
    } else {
      setActiveFilter(activeFilter === filter ? 'all' : filter);
    }
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

  const getFormAge = (signedAt: string | null | undefined) => {
    if (!signedAt) return '-';
    const days = differenceInDays(new Date(), new Date(signedAt));
    if (days === 0) {
      const hours = differenceInHours(new Date(), new Date(signedAt));
      return hours === 0 ? 'Just now' : `${hours}h ago`;
    }
    return days === 1 ? '1 day ago' : `${days} days ago`;
  };

  const calculateAge = (dateOfBirth: string | null | undefined): string => {
    if (!dateOfBirth) return '-';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Guest Forms" />
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
              
              <h1 className="text-xl font-semibold">Guest Forms</h1>
            </div>
            <NotificationBell />
          </div>
        </div>
      </header>

      <div className="container mx-auto p-6">
        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              activeFilter === 'completed' && 'ring-2 ring-primary'
            )}
            onClick={() => handleCardClick('completed')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {stats.checkedInWithForm}
                  </div>
                  <p className="text-sm text-muted-foreground">Forms Completed</p>
                   <p className="text-xs text-muted-foreground">(In date range)</p>
                </div>
                <FileCheck className="h-8 w-8 text-muted-foreground opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              activeFilter === 'pending' && 'ring-2 ring-primary'
            )}
            onClick={() => handleCardClick('pending')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {stats.checkedInWithoutForm}
                  </div>
                  <p className="text-sm text-muted-foreground">Forms Pending</p>
                  <p className="text-xs text-muted-foreground">(In date range)</p>
                </div>
                <FileX className="h-8 w-8 text-muted-foreground opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => handleCardClick('emails')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {stats.totalEmails}
                  </div>
                  <p className="text-sm text-muted-foreground">Guest Emails</p>
                  <p className="text-xs text-muted-foreground">(Click to view list)</p>
                </div>
                <Mail className="h-8 w-8 text-muted-foreground opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              activeFilter === 'all' && 'ring-2 ring-primary'
            )}
            onClick={() => handleCardClick('all')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.totalForms}</div>
                  <p className="text-sm text-muted-foreground">Total Forms</p>
                  <p className="text-xs text-muted-foreground">(All time)</p>
                </div>
                <Files className="h-8 w-8 text-muted-foreground opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Date Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, booking ref, email, or room..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={dateFilter === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(dateFilter === 'week' ? 'all' : 'week')}
            >
              {dateFilter === 'week' 
                ? `${format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'MMM d')} - ${format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'MMM d')}`
                : 'Week'
              }
            </Button>
            <Button
              variant={dateFilter === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(dateFilter === 'month' ? 'all' : 'month')}
            >
              {dateFilter === 'month' 
                ? `${format(new Date(), 'MMM')} to Date`
                : 'Month to Date'
              }
            </Button>
            <Button
              variant={dateFilter === 'ytd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(dateFilter === 'ytd' ? 'all' : 'ytd')}
            >
              {dateFilter === 'ytd' 
                ? `YTD ${format(new Date(), 'yyyy')}`
                : 'Year to Date'
              }
            </Button>
            {activeFilter !== 'all' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setActiveFilter('all')}>
                {activeFilter === 'completed' ? 'Forms Completed' : 'Forms Pending'} ✕
              </Badge>
            )}
          </div>
        </div>

        {/* Count bar + Export */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {filteredData.length} of {tableData.length} guests
          </span>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Table */}
        <Card>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Guest Name</TableHead>
                <TableHead>Check-In</TableHead>
                <TableHead>Check-Out</TableHead>
                <TableHead>Booking Ref</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none transition-colors"
                  onClick={() => handleSort('check_in_status')}
                >
                  <div className="flex items-center gap-1">
                    Check-In Status
                    {getSortIcon('check_in_status')}
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none transition-colors"
                  onClick={() => handleSort('form_status')}
                >
                  <div className="flex items-center gap-1">
                    Form Status
                    {getSortIcon('form_status')}
                  </div>
                </TableHead>
                <TableHead>Form Name</TableHead>
                <TableHead>Form Email</TableHead>
                <TableHead>Form Phone</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 select-none transition-colors"
                  onClick={() => handleSort('signed_at')}
                >
                  <div className="flex items-center gap-1">
                    Signed At
                    {getSortIcon('signed_at')}
                  </div>
                </TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>Guest Age</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      No guest forms found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map(({ reservation, agreement, hasForm }) => {
                    const isPending = !hasForm && reservation.status === 'checked-in';
                    return (
                      <TableRow
                        key={reservation.id}
                        className={cn(isPending && 'bg-destructive/5')}
                      >
                        <TableCell className="font-medium">
                          {reservation.units?.unit_number || reservation.units?.name || '-'}
                        </TableCell>
                        <TableCell>{reservation.guest_names?.[0] || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(reservation.check_in_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {format(new Date(reservation.check_out_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-mono text-xs"
                            onClick={() => navigate(`/reservation/${reservation.id}`)}
                          >
                            {reservation.booking_reference}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          {reservation.status === 'checked-in' 
                            ? 'Checked In' 
                            : reservation.status === 'checked-out' 
                              ? 'Checked Out'
                              : 'Pending Check-In'}
                        </TableCell>
                        <TableCell>
                          {hasForm ? (
                            <Badge variant="default" className="bg-green-600">
                              Completed
                            </Badge>
                          ) : (
                            <Badge 
                              variant="outline"
                              className="cursor-pointer bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200 transition-colors"
                              onClick={() => window.open(`/guest-checkin/${reservation.id}`, '_blank')}
                            >
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{agreement?.guest_full_name || '-'}</TableCell>
                        <TableCell>{agreement?.guest_email || '-'}</TableCell>
                        <TableCell>{agreement?.guest_phone || '-'}</TableCell>
                        <TableCell>
                          {agreement?.signed_at
                            ? format(new Date(agreement.signed_at), 'MMM d, yyyy h:mm a')
                            : '-'}
                        </TableCell>
                        <TableCell>{agreement?.guest_nationality || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {calculateAge(agreement?.guest_date_of_birth)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPassportReservation({
                                  id: reservation.id,
                                  guestName: agreement?.guest_full_name || reservation.guest_names?.[0] || 'Guest'
                                });
                                setPassportDialogOpen(true);
                              }}
                              title="Upload Passports"
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
                            {hasForm && agreement && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPDF(reservation, agreement)}
                                disabled={downloadingId === reservation.id}
                                title="Download PDF"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Email List Modal */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Guest Emails ({uniqueEmails.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={handleCopyAllEmails} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copy All Emails
            </Button>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {uniqueEmails.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No emails collected yet
                </p>
              ) : (
                <div className="space-y-2">
                  {uniqueEmails.map(email => (
                    <div
                      key={email}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted transition-colors"
                    >
                      <span className="text-sm">{email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyEmail(email)}
                      >
                        {copiedEmail === email ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Passport Upload Dialog */}
      <PassportUploadDialog
        open={passportDialogOpen}
        onOpenChange={setPassportDialogOpen}
        reservationId={passportReservation?.id || ''}
        guestName={passportReservation?.guestName || 'Guest'}
      />
    </div>
  );
}

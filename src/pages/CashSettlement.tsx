import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Banknote, CreditCard, CheckCircle, CheckCircle2, Clock, Download, X, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

type Reservation = {
  id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  total_price: number | null;
  price_per_night: number | null;
  nights: number | null;
  vat_exempt: boolean | null;
  payment_method: string | null;
  source: string;
  channel: string;
  settled: string | null;
  status: string;
  unit_id: string | null;
  units?: { name: string; unit_number: string | null; booking_com_name: string | null; tax_percentage: number | null } | null;
};

type ModalType = 'cash' | 'card' | 'settled' | 'pending' | null;

export default function CashSettlement() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
  const [showBulkSettleDialog, setShowBulkSettleDialog] = useState(false);
  const [selectedSettledReservations, setSelectedSettledReservations] = useState<Set<string>>(new Set());
  const [showBulkUnsettleDialog, setShowBulkUnsettleDialog] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [dateFilterType, setDateFilterType] = useState<'check_in' | 'check_out'>('check_in');

  // Fetch reservations excluding booking.com and cancelled
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['cash-settlement-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, units!unit_id(name, unit_number, booking_com_name, tax_percentage)')
        .in('payment_method', ['cash', 'credit_card'])
        .neq('source', 'booking.com')
        .not('status', 'ilike', '%cancelled%')
        .is('cancelled_at', null)
        .order('check_in_date', { ascending: false });
      
      if (error) throw error;
      return data as Reservation[];
    },
  });

  // Settle mutation
  const settleMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error } = await supabase
        .from('reservations')
        .update({ settled: 'yes' })
        .eq('id', reservationId);
      
      if (error) throw error;
    },
    onSuccess: (_, reservationId) => {
      queryClient.invalidateQueries({ queryKey: ['cash-settlement-reservations'] });
      toast.success('Reservation marked as settled');
      // Remove from selection if it was selected
      setSelectedReservations(prev => {
        const newSet = new Set(prev);
        newSet.delete(reservationId);
        return newSet;
      });
    },
    onError: (error) => {
      toast.error('Failed to settle reservation: ' + error.message);
    },
  });

  // Bulk settle mutation
  const bulkSettleMutation = useMutation({
    mutationFn: async (reservationIds: string[]) => {
      const { error } = await supabase
        .from('reservations')
        .update({ settled: 'yes' })
        .in('id', reservationIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-settlement-reservations'] });
      toast.success(`${selectedReservations.size} reservations settled successfully`);
      setSelectedReservations(new Set());
    },
    onError: (error) => {
      toast.error('Failed to settle reservations: ' + error.message);
    },
  });

  const handleBulkSettle = () => {
    if (selectedReservations.size === 0) return;
    setShowBulkSettleDialog(true);
  };

  const confirmBulkSettle = () => {
    bulkSettleMutation.mutate(Array.from(selectedReservations));
    setShowBulkSettleDialog(false);
  };

  // Bulk unsettle mutation
  const bulkUnsettleMutation = useMutation({
    mutationFn: async (reservationIds: string[]) => {
      const { error } = await supabase
        .from('reservations')
        .update({ settled: 'no' })
        .in('id', reservationIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-settlement-reservations'] });
      toast.success(`${selectedSettledReservations.size} reservations unsettled successfully`);
      setSelectedSettledReservations(new Set());
    },
    onError: (error) => {
      toast.error('Failed to unsettle reservations: ' + error.message);
    },
  });

  const handleBulkUnsettle = () => {
    if (selectedSettledReservations.size === 0) return;
    setShowBulkUnsettleDialog(true);
  };

  const confirmBulkUnsettle = () => {
    bulkUnsettleMutation.mutate(Array.from(selectedSettledReservations));
    setShowBulkUnsettleDialog(false);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const cashReservations = reservations.filter(r => r.payment_method === 'cash');
    const cardReservations = reservations.filter(r => r.payment_method === 'credit_card');
    const settledReservations = reservations.filter(r => r.settled === 'yes');
    const pendingReservations = reservations.filter(r => r.settled !== 'yes');

    const calcTotal = (r: Reservation): number => {
      if (r.vat_exempt) return r.total_price || 0;
      const subtotal = (r.price_per_night || 0) * (r.nights || 0);
      const taxPercentage = r.units?.tax_percentage || 14;
      return subtotal + (subtotal * taxPercentage / 100);
    };

    const cashTotal = cashReservations.reduce((sum, r) => sum + calcTotal(r), 0);
    const cardTotal = cardReservations.reduce((sum, r) => sum + calcTotal(r), 0);
    const settledTotal = settledReservations.reduce((sum, r) => sum + calcTotal(r), 0);
    const pendingTotal = pendingReservations.reduce((sum, r) => sum + calcTotal(r), 0);

    const total = cashTotal + cardTotal;
    const cashPercent = total > 0 ? (cashTotal / total) * 100 : 0;
    const cardPercent = total > 0 ? (cardTotal / total) * 100 : 0;

    return {
      cash: { reservations: cashReservations, total: cashTotal, percent: cashPercent, count: cashReservations.length },
      card: { reservations: cardReservations, total: cardTotal, percent: cardPercent, count: cardReservations.length },
      settled: { reservations: settledReservations, total: settledTotal, count: settledReservations.length },
      pending: { reservations: pendingReservations, total: pendingTotal, count: pendingReservations.length },
    };
  }, [reservations]);

  // Helper function to check if reservation falls within date range
  const isInDateRange = (reservation: Reservation): boolean => {
    if (!dateRange?.from) return true;
    
    const dateToCheck = dateFilterType === 'check_in' 
      ? new Date(reservation.check_in_date) 
      : new Date(reservation.check_out_date);
    
    const fromDate = new Date(dateRange.from);
    fromDate.setHours(0, 0, 0, 0);
    
    if (dateRange.to) {
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      return dateToCheck >= fromDate && dateToCheck <= toDate;
    }
    
    return dateToCheck >= fromDate && dateToCheck < new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
  };

  // Calculate VAT-inclusive total for a reservation
  const calculateTotalWithVAT = (reservation: Reservation): number => {
    if (reservation.vat_exempt) {
      return reservation.total_price || 0;
    }
    const subtotal = (reservation.price_per_night || 0) * (reservation.nights || 0);
    const taxPercentage = reservation.units?.tax_percentage || 14;
    return subtotal + (subtotal * taxPercentage / 100);
  };

  // Filter reservations for main tables - cash only for settled/unsettled
  const filteredCashReservations = useMemo(() => {
    return reservations.filter(r => {
      if (r.payment_method !== 'cash') return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!isInDateRange(r)) return false;
      return true;
    });
  }, [reservations, sourceFilter, dateRange, dateFilterType]);

  // Card reservations (separate table)
  const filteredCardReservations = useMemo(() => {
    return reservations.filter(r => {
      if (r.payment_method !== 'credit_card') return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      if (!isInDateRange(r)) return false;
      return true;
    });
  }, [reservations, sourceFilter, dateRange, dateFilterType]);

  const unsettledCashReservations = filteredCashReservations.filter(r => r.settled !== 'yes');
  const settledCashReservations = filteredCashReservations.filter(r => r.settled === 'yes');

  // Calculate selected totals
  const selectedTotal = useMemo(() => {
    return unsettledCashReservations
      .filter(r => selectedReservations.has(r.id))
      .reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
  }, [unsettledCashReservations, selectedReservations]);

  const selectedCount = selectedReservations.size;

  // Calculate selected settled totals
  const selectedSettledTotal = useMemo(() => {
    return settledCashReservations
      .filter(r => selectedSettledReservations.has(r.id))
      .reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
  }, [settledCashReservations, selectedSettledReservations]);

  const selectedSettledCount = selectedSettledReservations.size;

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const sources = new Set(reservations.map(r => r.source));
    return Array.from(sources).sort();
  }, [reservations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReservations(new Set(unsettledCashReservations.map(r => r.id)));
    } else {
      setSelectedReservations(new Set());
    }
  };

  const handleSelectReservation = (reservationId: string, checked: boolean) => {
    const newSet = new Set(selectedReservations);
    if (checked) {
      newSet.add(reservationId);
    } else {
      newSet.delete(reservationId);
    }
    setSelectedReservations(newSet);
  };

  const handleSelectAllSettled = (checked: boolean) => {
    if (checked) {
      setSelectedSettledReservations(new Set(settledCashReservations.map(r => r.id)));
    } else {
      setSelectedSettledReservations(new Set());
    }
  };

  const handleSelectSettledReservation = (reservationId: string, checked: boolean) => {
    const newSet = new Set(selectedSettledReservations);
    if (checked) {
      newSet.add(reservationId);
    } else {
      newSet.delete(reservationId);
    }
    setSelectedSettledReservations(newSet);
  };

  const exportToExcel = () => {
    const formatRow = (r: Reservation) => ({
      'Booking Reference': r.booking_reference,
      'Guest Name': r.guest_names?.[0] || 'N/A',
      'Room Name': r.units?.booking_com_name || 'Unassigned',
      'Room #': r.units?.unit_number || '-',
      'Check-in': format(new Date(r.check_in_date), 'MMM d, yyyy'),
      'Check-out': format(new Date(r.check_out_date), 'MMM d, yyyy'),
      'Amount (incl. VAT)': calculateTotalWithVAT(r),
      'Payment Method': r.payment_method === 'credit_card' ? 'Card' : r.payment_method,
      'Source': r.source,
      'Settled': r.settled === 'yes' ? 'Yes' : 'No',
    });

    const wb = XLSX.utils.book_new();

    // Unsettled Cash sheet
    const unsettledData = unsettledCashReservations.map(formatRow);
    const unsettledTotal = unsettledCashReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
    unsettledData.push({ 'Booking Reference': 'TOTAL (incl. 14% VAT)', 'Guest Name': '', 'Room Name': '', 'Room #': '', 'Check-in': '', 'Check-out': '', 'Amount (incl. VAT)': unsettledTotal, 'Payment Method': '', 'Source': '', 'Settled': '' });
    const ws1 = XLSX.utils.json_to_sheet(unsettledData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Unsettled Cash');

    // Settled Cash sheet
    const settledData = settledCashReservations.map(formatRow);
    const settledTotal = settledCashReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
    settledData.push({ 'Booking Reference': 'TOTAL (incl. 14% VAT)', 'Guest Name': '', 'Room Name': '', 'Room #': '', 'Check-in': '', 'Check-out': '', 'Amount (incl. VAT)': settledTotal, 'Payment Method': '', 'Source': '', 'Settled': '' });
    const ws2 = XLSX.utils.json_to_sheet(settledData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Settled Cash');

    // Card Reservations sheet
    const cardData = filteredCardReservations.map(formatRow);
    const cardTotal = filteredCardReservations.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
    cardData.push({ 'Booking Reference': 'TOTAL (incl. 14% VAT)', 'Guest Name': '', 'Room Name': '', 'Room #': '', 'Check-in': '', 'Check-out': '', 'Amount (incl. VAT)': cardTotal, 'Payment Method': '', 'Source': '', 'Settled': '' });
    const ws3 = XLSX.utils.json_to_sheet(cardData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Card Reservations');

    // Summary sheet
    const summaryData = [
      { Category: 'Unsettled Cash', Count: unsettledCashReservations.length, 'Total (incl. VAT)': unsettledTotal },
      { Category: 'Settled Cash', Count: settledCashReservations.length, 'Total (incl. VAT)': settledTotal },
      { Category: 'Card Reservations', Count: filteredCardReservations.length, 'Total (incl. VAT)': cardTotal },
      { Category: 'GRAND TOTAL', Count: unsettledCashReservations.length + settledCashReservations.length + filteredCardReservations.length, 'Total (incl. VAT)': unsettledTotal + settledTotal + cardTotal },
    ];
    const ws4 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Summary');

    const fileName = `settlement-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Settlement report exported successfully');
  };

  const getModalData = () => {
    switch (activeModal) {
      case 'cash': return { title: 'Cash Reservations', data: stats.cash.reservations, icon: Banknote, color: 'text-green-500' };
      case 'card': return { title: 'Card Reservations', data: stats.card.reservations, icon: CreditCard, color: 'text-blue-500' };
      case 'settled': return { title: 'Settled Reservations', data: stats.settled.reservations, icon: CheckCircle, color: 'text-emerald-500' };
      case 'pending': return { title: 'Pending Reservations', data: stats.pending.reservations, icon: Clock, color: 'text-amber-500' };
      default: return null;
    }
  };

  const modalData = getModalData();

  const ReservationTable = ({ 
    data, 
    showSettleAction = false,
    showUnsettleAction = false 
  }: { 
    data: Reservation[]; 
    showSettleAction?: boolean;
    showUnsettleAction?: boolean;
  }) => {
    const tableTotal = data.reduce((sum, r) => sum + calculateTotalWithVAT(r), 0);
    const hasCheckbox = showSettleAction || showUnsettleAction;
    
    // Determine selection state based on action type
    const selectionSet = showUnsettleAction ? selectedSettledReservations : selectedReservations;
    const isAllSelected = hasCheckbox && data.length > 0 && data.every(r => selectionSet.has(r.id));
    const isSomeSelected = hasCheckbox && data.some(r => selectionSet.has(r.id));
    
    const handleSelectAllForTable = (checked: boolean) => {
      if (showUnsettleAction) {
        handleSelectAllSettled(checked);
      } else {
        handleSelectAll(checked);
      }
    };

    const handleSelectRowForTable = (id: string, checked: boolean) => {
      if (showUnsettleAction) {
        handleSelectSettledReservation(id, checked);
      } else {
        handleSelectReservation(id, checked);
      }
    };
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {hasCheckbox && (
              <TableHead className="w-12">
                <Checkbox 
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement).dataset.state = isSomeSelected && !isAllSelected ? 'indeterminate' : isAllSelected ? 'checked' : 'unchecked';
                    }
                  }}
                  onCheckedChange={(checked) => handleSelectAllForTable(!!checked)}
                />
              </TableHead>
            )}
            <TableHead>Booking Ref</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Suite</TableHead>
            <TableHead>Room #</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Total (incl. VAT)</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            {(showSettleAction || showUnsettleAction) && <TableHead>Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hasCheckbox ? 11 : 9} className="text-center text-muted-foreground py-8">
                No reservations found
              </TableCell>
            </TableRow>
          ) : (
            data.map((r) => (
              <TableRow key={r.id} className={selectionSet.has(r.id) ? 'bg-primary/5' : ''}>
                {hasCheckbox && (
                  <TableCell>
                    <Checkbox 
                      checked={selectionSet.has(r.id)}
                      onCheckedChange={(checked) => handleSelectRowForTable(r.id, !!checked)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-sm">{r.booking_reference}</TableCell>
                <TableCell>{r.guest_names?.[0] || 'N/A'}</TableCell>
                <TableCell>{r.units?.booking_com_name || 'Unassigned'}</TableCell>
                <TableCell>{r.units?.unit_number || '-'}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(r.check_in_date), 'MMM d')} - {format(new Date(r.check_out_date), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(calculateTotalWithVAT(r))}</TableCell>
                <TableCell>
                  <Badge variant={r.payment_method === 'cash' ? 'default' : 'secondary'} className="capitalize">
                    {r.payment_method === 'credit_card' ? 'Card' : r.payment_method}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{r.source}</TableCell>
                <TableCell>
                  <Badge 
                    variant={
                      r.status === 'checked-in' ? 'default' : 
                      r.status === 'completed' ? 'secondary' : 
                      'outline'
                    }
                    className={
                      r.status === 'checked-in' ? 'bg-green-500' : 
                      r.status === 'completed' ? 'bg-blue-500 text-white' : 
                      ''
                    }
                  >
                    {r.status === 'checked-in' ? 'Checked In' : 
                     r.status === 'completed' ? 'Completed' : 
                     r.status === 'confirmed' ? 'Confirmed' : 
                     r.status}
                  </Badge>
                </TableCell>
                {showSettleAction && (
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => settleMutation.mutate(r.id)}
                      disabled={settleMutation.isPending}
                    >
                      Settle
                    </Button>
                  </TableCell>
                )}
                {showUnsettleAction && (
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        supabase
                          .from('reservations')
                          .update({ settled: 'no' })
                          .eq('id', r.id)
                          .then(({ error }) => {
                            if (error) {
                              toast.error('Failed to unsettle reservation');
                            } else {
                              queryClient.invalidateQueries({ queryKey: ['cash-settlement-reservations'] });
                              toast.success('Reservation unsettled');
                              setSelectedSettledReservations(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(r.id);
                                return newSet;
                              });
                            }
                          });
                      }}
                    >
                      Unsettle
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
        {data.length > 0 && (
          <TableFooter>
            <TableRow className="bg-muted/50">
              <TableCell colSpan={hasCheckbox ? 6 : 5} className="text-right font-semibold">
                Total incl. 14% VAT ({data.length} reservations)
              </TableCell>
              <TableCell className="font-bold text-lg">{formatCurrency(tableTotal)}</TableCell>
              <TableCell colSpan={(showSettleAction || showUnsettleAction) ? 4 : 3}></TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-4">
          <SlideMenu userRole={userRole} />
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Cash Settlement</h1>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cash Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-green-500/20 hover:border-green-500/40"
            onClick={() => setActiveModal('cash')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cash</CardTitle>
              <Banknote className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.cash.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.cash.count} reservations • {stats.cash.percent.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          {/* Card Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-blue-500/20 hover:border-blue-500/40"
            onClick={() => setActiveModal('card')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Card</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.card.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.card.count} reservations • {stats.card.percent.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          {/* Settled Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-emerald-500/20 hover:border-emerald-500/40"
            onClick={() => setActiveModal('settled')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Settled</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.settled.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.settled.count} reservations
              </p>
            </CardContent>
          </Card>

          {/* Pending Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-amber-500/20 hover:border-amber-500/40"
            onClick={() => setActiveModal('pending')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pending.total)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.pending.count} reservations
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map((source) => (
                  <SelectItem key={source} value={source} className="capitalize">
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilterType} onValueChange={(v) => setDateFilterType(v as 'check_in' | 'check_out')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="check_in">Check-in</SelectItem>
                <SelectItem value="check_out">Check-out</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex flex-col">
                  <div className="flex gap-2 p-2 border-b">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
                      }}
                    >
                      This Month
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const lastMonth = subMonths(new Date(), 1);
                        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
                      }}
                    >
                      Last Month
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDateRange(undefined)}
                    >
                      Clear
                    </Button>
                  </div>
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </div>
              </PopoverContent>
            </Popover>

            {dateRange?.from && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDateRange(undefined)}
                className="h-9 w-9"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Button onClick={exportToExcel} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>

        {/* Selection Summary Bar */}
        {selectedCount > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="font-medium text-primary">
                {selectedCount} reservation{selectedCount > 1 ? 's' : ''} selected
              </span>
              <span className="text-foreground font-bold text-lg">
                Total: {formatCurrency(selectedTotal)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedReservations(new Set())}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
              <Button 
                size="sm"
                onClick={handleBulkSettle}
                disabled={bulkSettleMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Settle Selected ({selectedCount})
              </Button>
            </div>
          </div>
        )}

        {/* Unsettled Cash Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Unsettled Cash Reservations
              <Badge variant="outline" className="ml-2">{unsettledCashReservations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationTable data={unsettledCashReservations} showSettleAction />
          </CardContent>
        </Card>

        {/* Settled Selection Summary Bar */}
        {selectedSettledCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="font-medium text-amber-700">
                {selectedSettledCount} settled reservation{selectedSettledCount > 1 ? 's' : ''} selected
              </span>
              <span className="text-amber-900 font-bold text-lg">
                Total: {formatCurrency(selectedSettledTotal)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedSettledReservations(new Set())}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
              <Button 
                size="sm"
                variant="destructive"
                onClick={handleBulkUnsettle}
                disabled={bulkUnsettleMutation.isPending}
                className="gap-2"
              >
                Unsettle Selected ({selectedSettledCount})
              </Button>
            </div>
          </div>
        )}

        {/* Settled Cash Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Settled Cash Reservations
              <Badge variant="outline" className="ml-2">{settledCashReservations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationTable data={settledCashReservations} showUnsettleAction />
          </CardContent>
        </Card>

        {/* Card Reservations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              Reservations Paid by Card
              <Badge variant="outline" className="ml-2">{filteredCardReservations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReservationTable data={filteredCardReservations} />
          </CardContent>
        </Card>
      </main>

      {/* Modal */}
      <Dialog open={activeModal !== null} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modalData && <modalData.icon className={`h-5 w-5 ${modalData.color}`} />}
              {modalData?.title}
              <Badge variant="outline" className="ml-2">{modalData?.data.length || 0}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {modalData && <ReservationTable data={modalData.data} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Settle Confirmation Dialog */}
      <AlertDialog open={showBulkSettleDialog} onOpenChange={setShowBulkSettleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Settlement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to settle {selectedCount} reservation{selectedCount > 1 ? 's' : ''} totaling {formatCurrency(selectedTotal)}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkSettle} className="bg-green-600 hover:bg-green-700">
              Settle {selectedCount} Reservation{selectedCount > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Unsettle Confirmation Dialog */}
      <AlertDialog open={showBulkUnsettleDialog} onOpenChange={setShowBulkUnsettleDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Unsettle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unsettle {selectedSettledCount} reservation{selectedSettledCount > 1 ? 's' : ''} totaling {formatCurrency(selectedSettledTotal)}? These will be moved back to unsettled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkUnsettle} className="bg-amber-600 hover:bg-amber-700">
              Unsettle {selectedSettledCount} Reservation{selectedSettledCount > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

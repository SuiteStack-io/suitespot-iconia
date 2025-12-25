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
import { ArrowLeft, Banknote, CreditCard, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Reservation = {
  id: string;
  booking_reference: string;
  guest_names: string[];
  check_in_date: string;
  check_out_date: string;
  total_price: number | null;
  payment_method: string | null;
  source: string;
  channel: string;
  settled: string | null;
  status: string;
  unit_id: string | null;
  units?: { name: string; unit_number: string | null; booking_com_name: string | null } | null;
};

type ModalType = 'cash' | 'card' | 'settled' | 'pending' | null;

export default function CashSettlement() {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Fetch reservations excluding booking.com and cancelled
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['cash-settlement-reservations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, units(name, unit_number, booking_com_name)')
        .in('payment_method', ['cash', 'credit_card'])
        .neq('source', 'booking.com')
        .neq('status', 'cancelled')
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-settlement-reservations'] });
      toast.success('Reservation marked as settled');
    },
    onError: (error) => {
      toast.error('Failed to settle reservation: ' + error.message);
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    const cashReservations = reservations.filter(r => r.payment_method === 'cash');
    const cardReservations = reservations.filter(r => r.payment_method === 'credit_card');
    const settledReservations = reservations.filter(r => r.settled === 'yes');
    const pendingReservations = reservations.filter(r => r.settled !== 'yes');

    const cashTotal = cashReservations.reduce((sum, r) => sum + (r.total_price || 0), 0);
    const cardTotal = cardReservations.reduce((sum, r) => sum + (r.total_price || 0), 0);
    const settledTotal = settledReservations.reduce((sum, r) => sum + (r.total_price || 0), 0);
    const pendingTotal = pendingReservations.reduce((sum, r) => sum + (r.total_price || 0), 0);

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

  // Filter reservations for main tables - cash only for settled/unsettled
  const filteredCashReservations = useMemo(() => {
    return reservations.filter(r => {
      if (r.payment_method !== 'cash') return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      return true;
    });
  }, [reservations, sourceFilter]);

  // Card reservations (separate table)
  const filteredCardReservations = useMemo(() => {
    return reservations.filter(r => {
      if (r.payment_method !== 'credit_card') return false;
      if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
      return true;
    });
  }, [reservations, sourceFilter]);

  const unsettledCashReservations = filteredCashReservations.filter(r => r.settled !== 'yes');
  const settledCashReservations = filteredCashReservations.filter(r => r.settled === 'yes');

  // Get unique sources for filter
  const uniqueSources = useMemo(() => {
    const sources = new Set(reservations.map(r => r.source));
    return Array.from(sources).sort();
  }, [reservations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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

  const ReservationTable = ({ data, showSettleAction = false }: { data: Reservation[]; showSettleAction?: boolean }) => {
    const tableTotal = data.reduce((sum, r) => sum + (r.total_price || 0), 0);
    
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Booking Ref</TableHead>
            <TableHead>Guest</TableHead>
            <TableHead>Suite</TableHead>
            <TableHead>Room #</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Source</TableHead>
            {showSettleAction && <TableHead>Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showSettleAction ? 9 : 8} className="text-center text-muted-foreground py-8">
                No reservations found
              </TableCell>
            </TableRow>
          ) : (
            data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">{r.booking_reference}</TableCell>
                <TableCell>{r.guest_names?.[0] || 'N/A'}</TableCell>
                <TableCell>{r.units?.booking_com_name || 'Unassigned'}</TableCell>
                <TableCell>{r.units?.unit_number || '-'}</TableCell>
                <TableCell className="text-sm">
                  {format(new Date(r.check_in_date), 'MMM d')} - {format(new Date(r.check_out_date), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(r.total_price || 0)}</TableCell>
                <TableCell>
                  <Badge variant={r.payment_method === 'cash' ? 'default' : 'secondary'} className="capitalize">
                    {r.payment_method === 'credit_card' ? 'Card' : r.payment_method}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{r.source}</TableCell>
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
              </TableRow>
            ))
          )}
        </TableBody>
        {data.length > 0 && (
          <TableFooter>
            <TableRow className="bg-muted/50">
              <TableCell colSpan={5} className="text-right font-semibold">
                Total ({data.length} reservations)
              </TableCell>
              <TableCell className="font-bold text-lg">{formatCurrency(tableTotal)}</TableCell>
              <TableCell colSpan={showSettleAction ? 3 : 2}></TableCell>
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
        <div className="flex flex-wrap gap-4">
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
        </div>

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
            <ReservationTable data={settledCashReservations} />
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
    </div>
  );
}

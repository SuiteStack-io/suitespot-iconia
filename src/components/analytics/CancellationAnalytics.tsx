import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { XCircle, TrendingDown, DollarSign, Calendar, ChevronRight, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface CancellationAnalyticsProps {
  startDate: string;
  endDate: string;
}

interface CancellationBySource {
  source: string;
  cancellations: number;
  totalBookings: number;
  cancellationRate: number;
  revenueLost: number;
  nightsLost: number;
}

interface CancellationDetail {
  bookingReference: string;
  guestName: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  source: string;
  cancelledAt: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export const CancellationAnalytics = ({ startDate, endDate }: CancellationAnalyticsProps) => {
  const [stats, setStats] = useState({
    totalCancellations: 0,
    cancellationRate: 0,
    revenueLost: 0,
    nightsLost: 0,
  });
  const [bySource, setBySource] = useState<CancellationBySource[]>([]);
  const [details, setDetails] = useState<CancellationDetail[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCancellationStats();
  }, [startDate, endDate]);

  const fetchCancellationStats = async () => {
    setLoading(true);
    try {
      // Fetch all reservations in date range
      const { data: allReservations } = await supabase
        .from('reservations')
        .select('id, status, source, total_price, nights')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate);

      // Fetch cancelled reservations with details
      const { data: cancelledReservations } = await supabase
        .from('reservations')
        .select('*, units!unit_id(name, unit_number)')
        .eq('status', 'cancelled')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate);

      const total = allReservations?.length || 0;
      const cancelled = cancelledReservations?.length || 0;
      const rate = total > 0 ? (cancelled / total) * 100 : 0;
      const revenueLost = cancelledReservations?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
      const nightsLost = cancelledReservations?.reduce((sum, r) => sum + (r.nights || 0), 0) || 0;

      setStats({
        totalCancellations: cancelled,
        cancellationRate: rate,
        revenueLost,
        nightsLost,
      });

      // Group by source
      const sourceMap: Record<string, { cancellations: number; totalBookings: number; revenueLost: number; nightsLost: number }> = {};
      
      allReservations?.forEach((r) => {
        const source = normalizeSource(r.source);
        if (!sourceMap[source]) {
          sourceMap[source] = { cancellations: 0, totalBookings: 0, revenueLost: 0, nightsLost: 0 };
        }
        sourceMap[source].totalBookings += 1;
        if (r.status === 'cancelled') {
          sourceMap[source].cancellations += 1;
          sourceMap[source].revenueLost += r.total_price || 0;
          sourceMap[source].nightsLost += r.nights || 0;
        }
      });

      const bySourceArray = Object.entries(sourceMap).map(([source, data]) => ({
        source,
        ...data,
        cancellationRate: data.totalBookings > 0 ? (data.cancellations / data.totalBookings) * 100 : 0,
      })).sort((a, b) => b.cancellations - a.cancellations);

      setBySource(bySourceArray);

      // Format details for the dialog
      const formattedDetails = cancelledReservations?.map((r: any) => ({
        bookingReference: r.booking_reference,
        guestName: r.guest_names?.[0] || 'Unknown',
        unitName: r.units?.name || 'Unassigned',
        checkIn: format(new Date(r.check_in_date), 'MMM dd, yyyy'),
        checkOut: format(new Date(r.check_out_date), 'MMM dd, yyyy'),
        nights: r.nights || 0,
        totalPrice: r.total_price || 0,
        source: normalizeSource(r.source),
        cancelledAt: r.cancelled_at ? format(new Date(r.cancelled_at), 'MMM dd, yyyy HH:mm') : 'Unknown',
      })) || [];

      setDetails(formattedDetails);
    } catch (error) {
      console.error('Error fetching cancellation stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizeSource = (source: string | null): string => {
    if (!source) return 'Unknown';
    const lower = source.toLowerCase();
    if (lower.includes('booking.com') || lower.includes('booking')) return 'Booking.com';
    if (lower.includes('airbnb')) return 'Airbnb';
    if (lower.includes('direct')) return 'Direct';
    if (lower.includes('phone')) return 'Phone';
    if (lower.includes('walk-in') || lower.includes('walkin')) return 'Walk-in';
    return source;
  };

  const pieData = bySource.filter(s => s.cancellations > 0).map(s => ({
    name: s.source,
    value: s.cancellations,
  }));

  const barData = bySource.filter(s => s.cancellations > 0).map(s => ({
    source: s.source,
    rate: parseFloat(s.cancellationRate.toFixed(1)),
    lost: s.revenueLost,
  }));

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(details.map(d => ({
      'Booking Ref': d.bookingReference,
      'Guest': d.guestName,
      'Unit': d.unitName,
      'Check-in': d.checkIn,
      'Check-out': d.checkOut,
      'Nights': d.nights,
      'Revenue Lost': `$${d.totalPrice.toFixed(2)}`,
      'Source': d.source,
      'Cancelled At': d.cancelledAt,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cancellations');
    const filename = `cancellations_${format(new Date(startDate), 'yyyy-MM-dd')}_to_${format(new Date(endDate), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success('Cancellations exported successfully');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Cancellation Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Cancellation Analytics
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={details.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors"
              onClick={() => setShowDetailsDialog(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Cancellations</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.totalCancellations}</p>
            </div>

            <div
              className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
              onClick={() => setShowSourceDialog(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Cancel Rate</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.cancellationRate.toFixed(1)}%</p>
            </div>

            <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Revenue Lost</span>
              </div>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">${stats.revenueLost.toLocaleString()}</p>
            </div>

            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Nights Lost</span>
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.nightsLost}</p>
            </div>
          </div>

          {/* Charts Section */}
          {stats.totalCancellations > 0 && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie Chart - Cancellations by Source */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4 text-sm">Cancellations by Source</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart - Cancellation Rate by Source */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4 text-sm">Cancellation Rate by Source</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                    <YAxis unit="%" tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Source Breakdown Table */}
          {bySource.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Cancellations</TableHead>
                    <TableHead className="text-right">Total Bookings</TableHead>
                    <TableHead className="text-right">Cancel Rate</TableHead>
                    <TableHead className="text-right">Revenue Lost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySource.map((source) => (
                    <TableRow key={source.source}>
                      <TableCell className="font-medium">{source.source}</TableCell>
                      <TableCell className="text-right text-red-600">{source.cancellations}</TableCell>
                      <TableCell className="text-right">{source.totalBookings}</TableCell>
                      <TableCell className="text-right text-amber-600">{source.cancellationRate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-orange-600">${source.revenueLost.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {stats.totalCancellations === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No cancellations found for this period</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancellation Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cancelled Reservations</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead className="text-right">Nights</TableHead>
                  <TableHead className="text-right">Revenue Lost</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Cancelled At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No cancellations found
                    </TableCell>
                  </TableRow>
                ) : (
                  details.map((d) => (
                    <TableRow key={d.bookingReference}>
                      <TableCell className="font-mono text-sm">{d.bookingReference}</TableCell>
                      <TableCell>{d.guestName}</TableCell>
                      <TableCell>{d.unitName}</TableCell>
                      <TableCell>{d.checkIn}</TableCell>
                      <TableCell className="text-right">{d.nights}</TableCell>
                      <TableCell className="text-right text-red-600">${d.totalPrice.toLocaleString()}</TableCell>
                      <TableCell>{d.source}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.cancelledAt}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Source Breakdown Dialog */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cancellation Rate by Source</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Cancelled</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Revenue Lost</TableHead>
                  <TableHead className="text-right">Nights Lost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySource.map((source) => (
                  <TableRow key={source.source}>
                    <TableCell className="font-medium">{source.source}</TableCell>
                    <TableCell className="text-right text-red-600">{source.cancellations}</TableCell>
                    <TableCell className="text-right">{source.totalBookings}</TableCell>
                    <TableCell className="text-right text-amber-600 font-medium">{source.cancellationRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right text-orange-600">${source.revenueLost.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-purple-600">{source.nightsLost}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right text-red-600">{stats.totalCancellations}</TableCell>
                  <TableCell className="text-right">{bySource.reduce((sum, s) => sum + s.totalBookings, 0)}</TableCell>
                  <TableCell className="text-right text-amber-600">{stats.cancellationRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-orange-600">${stats.revenueLost.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-purple-600">{stats.nightsLost}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

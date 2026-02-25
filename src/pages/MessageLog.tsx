import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';
import { format } from 'date-fns';

interface MessageLogEntry {
  id: string;
  reservation_id: string;
  guest_name: string;
  phone_number: string;
  message_type: string;
  status: string;
  error_message: string | null;
  twilio_message_sid: string | null;
  sent_at: string;
  booking_reference?: string;
}

const MessageLog = () => {
  const navigate = useNavigate();
  const { user, loading, userRole } = useAuth();
  const [logs, setLogs] = useState<MessageLogEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading]);

  useEffect(() => {
    fetchLogs();
  }, [typeFilter, statusFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    setFetching(true);
    let query = supabase
      .from('whatsapp_message_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(500);

    if (typeFilter !== 'all') query = query.eq('message_type', typeFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (dateFrom) query = query.gte('sent_at', dateFrom);
    if (dateTo) query = query.lte('sent_at', dateTo + 'T23:59:59');

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching message logs:', error);
      setLogs([]);
    } else {
      // Fetch booking references for all reservation_ids
      const resIds = [...new Set((data || []).map(d => d.reservation_id).filter(Boolean))];
      let refMap: Record<string, string> = {};
      if (resIds.length > 0) {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('id, booking_reference')
          .in('id', resIds);
        reservations?.forEach(r => { refMap[r.id] = r.booking_reference; });
      }

      setLogs((data || []).map(d => ({
        ...d,
        booking_reference: refMap[d.reservation_id] || '—',
      })));
    }
    setFetching(false);
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 4) return phone || '—';
    return '****' + phone.slice(-4);
  };

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { welcome: 'Welcome', midstay: 'Mid-Stay', checkout: 'Checkout' };
    return map[type] || type;
  };

  const statusBadge = (status: string) => {
    if (status === 'sent') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Sent</Badge>;
    if (status === 'failed') return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Failed</Badge>;
    return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Skipped</Badge>;
  };

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-4">
          <SlideMenu userRole={userRole} />
          <Button variant="ghost" onClick={() => navigate('/admin')} size="icon" className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Message Log</h1>
            <p className="text-muted-foreground text-sm">WhatsApp message history</p>
          </div>
        </div>

        <AdminBreadcrumb section="Customer Excellence" currentPage="Message Log" sectionPath="/message-log" />

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Message Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="midstay">Mid-Stay</SelectItem>
                  <SelectItem value="checkout">Checkout</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-[160px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-[160px]"
                placeholder="To"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fetching ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No messages found</TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(log.sent_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{log.guest_name}</TableCell>
                      <TableCell className="font-mono text-sm">{maskPhone(log.phone_number)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabel(log.message_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.booking_reference}</TableCell>
                      <TableCell>
                        {statusBadge(log.status)}
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={log.error_message}>
                            {log.error_message}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessageLog;

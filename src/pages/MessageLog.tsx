import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, RefreshCw, ScrollText, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { SlideMenu } from '@/components/SlideMenu';
import { useAuth } from '@/lib/auth';

interface MessageLogEntry {
  id: string;
  reservation_id: string;
  guest_name: string;
  phone_number: string;
  message_type: string;
  message_body: string;
  status: string;
  error_message: string | null;
  twilio_message_sid: string | null;
  sent_at: string;
  created_at: string;
  reservations?: { booking_reference: string } | null;
}

const maskPhone = (phone: string) => {
  if (!phone || phone.length < 6) return phone;
  const prefix = phone.substring(0, 4);
  const suffix = phone.substring(phone.length - 2);
  const middle = phone.substring(4, phone.length - 2).replace(/./g, '*');
  return `${prefix}${middle}${suffix}`;
};

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  delivered: 'bg-green-200 text-green-900',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-800',
};

const MessageLog = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [logs, setLogs] = useState<MessageLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('whatsapp-log-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_message_log' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [typeFilter, statusFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    let query = supabase
      .from('whatsapp_message_log')
      .select('*, reservations!reservation_id(booking_reference)')
      .order('sent_at', { ascending: false })
      .limit(200);

    if (typeFilter !== 'all') query = query.eq('message_type', typeFilter);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (dateFrom) query = query.gte('sent_at', dateFrom);
    if (dateTo) query = query.lte('sent_at', dateTo + 'T23:59:59');

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to load message log');
      console.error(error);
    } else {
      setLogs((data as any) || []);
    }
    setLoading(false);
  };

  const handleResend = async (entry: MessageLogEntry) => {
    setResending(entry.id);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-message', {
        body: { reservationId: entry.reservation_id, messageType: entry.message_type },
      });
      if (error) throw error;
      toast.success('Message resent');
      fetchLogs();
    } catch (err: any) {
      toast.error('Resend failed: ' + err.message);
    }
    setResending(null);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            <Button variant="ghost" onClick={() => navigate('/admin')} size="icon" className="md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Message Log</h1>
              <p className="text-muted-foreground">View all sent WhatsApp messages and delivery status</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="midstay">Mid-Stay</SelectItem>
                    <SelectItem value="checkout">Checkout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="skipped">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">From</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">To</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No messages found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Booking Ref</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {format(new Date(entry.sent_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{entry.guest_name}</TableCell>
                        <TableCell className="text-sm font-mono">{maskPhone(entry.phone_number)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{entry.message_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {(entry.reservations as any)?.booking_reference || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[entry.status] || ''}>{entry.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                          {entry.error_message || '—'}
                        </TableCell>
                        <TableCell>
                          {entry.status === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResend(entry)}
                              disabled={resending === entry.id}
                            >
                              <RefreshCw className={`h-3 w-3 mr-1 ${resending === entry.id ? 'animate-spin' : ''}`} />
                              Resend
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MessageLog;

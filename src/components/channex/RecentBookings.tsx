import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Booking {
  id: string;
  created_at: string;
  ota_name: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  guest_country: string | null;
  arrival_date: string;
  departure_date: string;
  status: string;
  acknowledged: boolean;
  total_amount: number;
  currency: string;
  ota_reservation_code: string | null;
  channex_booking_id: string;
  booking_data: any;
}

export function RecentBookings() {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('channex_bookings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setBookings((data as Booking[]) || []);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-xs">New</Badge>;
      case 'modified':
        return <Badge variant="outline" className="text-xs">Modified</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="text-xs">Cancelled</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">No OTA bookings received yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Recent OTA Bookings</h3>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date</TableHead>
              <TableHead>OTA</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead className="hidden md:table-cell">Arrival</TableHead>
              <TableHead className="hidden md:table-cell">Departure</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">ACK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b) => {
              const isExpanded = expandedId === b.id;
              return (
                <Collapsible key={b.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : b.id)} asChild>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell className="text-xs">
                          {format(new Date(b.created_at), 'MMM d HH:mm')}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{b.ota_name}</TableCell>
                        <TableCell className="text-xs">{b.guest_name}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{b.arrival_date}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{b.departure_date}</TableCell>
                        <TableCell>{statusBadge(b.status)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {b.acknowledged ? (
                            <Badge variant="outline" className="text-xs text-green-600">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-orange-500">No</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                            <div>
                              <span className="text-muted-foreground">Email:</span>{' '}
                              {b.guest_email}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Phone:</span>{' '}
                              {b.guest_phone || '—'}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Country:</span>{' '}
                              {b.guest_country || '—'}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Amount:</span>{' '}
                              {b.total_amount} {b.currency}
                            </div>
                            <div>
                              <span className="text-muted-foreground">OTA Code:</span>{' '}
                              {b.ota_reservation_code || '—'}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Channex ID:</span>{' '}
                              <code className="bg-muted px-1 rounded">{b.channex_booking_id.slice(0, 12)}...</code>
                            </div>
                          </div>
                          {b.booking_data && (
                            <div>
                              <p className="text-xs font-semibold mb-1">Raw Booking Data</p>
                              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-48">
                                {JSON.stringify(b.booking_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

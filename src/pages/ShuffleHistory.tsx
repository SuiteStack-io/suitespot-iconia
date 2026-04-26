import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Shuffle, User, Undo2, X } from 'lucide-react';
import { format } from 'date-fns';
import suitespotLogo from '@/assets/suitespot-logo.png';

interface ShuffleLog {
  id: string;
  shuffle_date: string;
  triggered_by_booking_id: string | null;
  triggered_by_reference: string;
  room_type: string;
  moves: any[];
  move_count: number;
  reason: string | null;
  created_at: string;
}

const NON_UNDOABLE_REASONS: Record<string, string> = {
  'Manual mid-stay transfer': 'Mid-stay transfers cannot be undone here. Edit the reservation directly.',
  'Manual drag-and-drop undone via toast': 'This row is itself an undo and cannot be reversed.',
  'Manual undo from history page': 'This row is itself an undo and cannot be reversed.',
};

const ShuffleHistory = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: 'automatic' | 'manual' =
    searchParams.get('type') === 'manual' ? 'manual' : 'automatic';
  const [logs, setLogs] = useState<ShuffleLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const propertyId = usePropertyId();

  const [queuedUndos, setQueuedUndos] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [failureDetails, setFailureDetails] = useState<{ row: string; reason: string }[] | null>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchLogs();
  }, [user, propertyId, filter]);

  const handleFilterChange = (value: string) => {
    if (value !== 'automatic' && value !== 'manual') return;
    const next = new URLSearchParams(searchParams);
    if (value === 'automatic') next.delete('type');
    else next.set('type', 'manual');
    setSearchParams(next, { replace: true });
  };

  const fetchLogs = async () => {
    setFetching(true);
    let query = supabase
      .from('room_shuffle_log')
      .select('*')
      .eq('change_type', filter)
      .order('shuffle_date', { ascending: false })
      .limit(100);
    query = withPropertyFilter(query, propertyId) as any;
    const { data, error } = await query;

    if (error) console.error('Error fetching shuffle logs:', error);
    else setLogs((data as any) || []);
    setFetching(false);
  };

  const toggleUndo = (logId: string) => {
    setQueuedUndos(prev => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const handleSaveChanges = async () => {
    setExecuting(true);
    const queuedRows = logs.filter(l => queuedUndos.has(l.id));
    const failures: { row: string; reason: string }[] = [];
    let successRowCount = 0;
    let totalSuccessfulMoves = 0;

    for (const row of queuedRows) {
      const moves = (row.moves as any[]) ?? [];
      if (moves.length === 0) {
        console.warn('Skipping row with empty moves array:', row.id);
        continue;
      }

      const successfulMoves: any[] = [];

      for (const move of moves) {
        if (!move?.from_unit_id || !move?.reservation_id || !move?.check_in_date || !move?.check_out_date) {
          failures.push({
            row: row.triggered_by_reference,
            reason: `${move?.guest_name ?? 'Unknown guest'}: Move data incomplete, cannot reverse.`,
          });
          continue;
        }

        // Pre-flight: confirm from_unit_id is currently free for the reservation's date range
        const { data: conflicts, error: conflictErr } = await supabase
          .from('reservations')
          .select('id, guest_names')
          .eq('unit_id', move.from_unit_id)
          .neq('id', move.reservation_id)
          .lt('check_in_date', move.check_out_date)
          .gt('check_out_date', move.check_in_date)
          .is('cancelled_at', null);

        if (conflictErr) {
          failures.push({
            row: row.triggered_by_reference,
            reason: `${move.guest_name}: Conflict check failed — ${conflictErr.message}`,
          });
          continue;
        }

        if (conflicts && conflicts.length > 0) {
          const otherGuest = (conflicts[0] as any).guest_names?.[0] ?? 'another guest';
          failures.push({
            row: row.triggered_by_reference,
            reason: `${move.guest_name}: Original room #${move.from_unit_number ?? ''} is now occupied by ${otherGuest}`,
          });
          continue;
        }

        const { error: updErr } = await supabase
          .from('reservations')
          .update({ unit_id: move.from_unit_id })
          .eq('id', move.reservation_id);

        if (updErr) {
          failures.push({
            row: row.triggered_by_reference,
            reason: `${move.guest_name}: ${updErr.message}`,
          });
          continue;
        }

        successfulMoves.push({
          reservation_id: move.reservation_id,
          guest_name: move.guest_name,
          from_unit_id: move.to_unit_id,
          from_unit_number: move.to_unit_number,
          to_unit_id: move.from_unit_id,
          to_unit_number: move.from_unit_number,
          check_in_date: move.check_in_date,
          check_out_date: move.check_out_date,
        });
      }

      if (successfulMoves.length > 0) {
        successRowCount++;
        totalSuccessfulMoves += successfulMoves.length;
        try {
          await supabase.from('room_shuffle_log').insert({
            triggered_by_booking_id: row.triggered_by_booking_id ?? row.moves?.[0]?.reservation_id ?? null,
            triggered_by_reference: row.triggered_by_reference,
            room_type: row.room_type,
            moves: successfulMoves,
            move_count: successfulMoves.length,
            reason: 'Manual undo from history page',
            change_type: 'manual',
            // property_id intentionally omitted — BEFORE INSERT trigger fills it
          } as any);
        } catch (logErr) {
          console.error('Failed to write undo log row:', logErr);
        }
      }
    }

    setExecuting(false);
    setConfirmOpen(false);
    setQueuedUndos(new Set());

    const totalRows = queuedRows.length;
    if (failures.length === 0) {
      toast({
        title: `Reversed ${successRowCount} room change${successRowCount !== 1 ? 's' : ''}.`,
      });
    } else if (successRowCount === 0) {
      setFailureDetails(failures);
      toast({
        variant: 'destructive',
        title: `Could not reverse any of the ${totalRows} room change${totalRows !== 1 ? 's' : ''}.`,
        description: 'See details for what went wrong.',
      });
    } else {
      setFailureDetails(failures);
      toast({
        title: `Reversed ${successRowCount} of ${totalRows} room changes.`,
        description: `${failures.length} could not be undone — see details.`,
      });
    }

    fetchLogs();
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const showUndoControls = filter === 'manual' && isAdmin;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="PMS" currentPage="Shuffle History" />
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <SlideMenu userRole={userRole} />
              <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold">Shuffle History</h1>
                <p className="text-sm text-muted-foreground">
                  {filter === 'manual' ? 'Manual room change log' : 'Auto-shuffle room rearrangement log'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Tabs value={filter} onValueChange={handleFilterChange}>
                <TabsList>
                  <TabsTrigger value="automatic">Automatic</TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>
              </Tabs>
              {showUndoControls && (
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={queuedUndos.size === 0 || executing}
                >
                  Save Changes ({queuedUndos.size})
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {fetching ? (
          <div className="text-center text-muted-foreground py-12">Loading shuffle history...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Shuffle className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>{filter === 'manual' ? 'No manual room changes yet.' : 'No room shuffles have occurred yet.'}</p>
          </div>
        ) : (
          <TooltipProvider>
            <div className="space-y-4">
              {logs.map(log => {
                const queued = queuedUndos.has(log.id);
                const disabledReason = log.reason ? NON_UNDOABLE_REASONS[log.reason] : undefined;
                return (
                  <Card key={log.id} className={queued ? 'bg-amber-50' : undefined}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {filter === 'manual'
                            ? <User className="h-5 w-5 text-stone-600" />
                            : <Shuffle className="h-5 w-5 text-amber-500" />}
                          <CardTitle className="text-base">
                            Shuffle for booking {log.triggered_by_reference}
                          </CardTitle>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{log.room_type}</Badge>
                          <Badge variant="secondary">{log.move_count} move{log.move_count !== 1 ? 's' : ''}</Badge>
                          {queued && (
                            <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              Queued for undo
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.shuffle_date), 'MMM d, yyyy HH:mm')}
                          </span>
                          {showUndoControls && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleUndo(log.id)}
                                    disabled={!!disabledReason}
                                  >
                                    {queued ? (
                                      <>
                                        <X className="h-4 w-4" />
                                        Cancel
                                      </>
                                    ) : (
                                      <>
                                        <Undo2 className="h-4 w-4" />
                                        Undo
                                      </>
                                    )}
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {disabledReason ?? 'Stage this room change to be reversed'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {log.reason && (
                        <p className="text-sm text-muted-foreground mb-3">{log.reason}</p>
                      )}
                      <div className="space-y-2">
                        {(log.moves as any[]).map((move: any, i: number) => {
                          const fromNum = move.from_unit_number ?? move.from_room_number;
                          const toNum = move.to_unit_number ?? move.to_room_number;
                          const checkIn = move.check_in_date ?? move.check_in;
                          const checkOut = move.check_out_date ?? move.check_out;
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-2">
                              <span className="font-medium">{move.guest_name}</span>
                              <span className="text-muted-foreground">Room #{fromNum}</span>
                              <span className="text-amber-500">→</span>
                              <span className="text-muted-foreground">Room #{toNum}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {checkIn} — {checkOut}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse {queuedUndos.size} room change{queuedUndos.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {queuedUndos.size} reservation(s) back to their original room(s). The Booking.com / OTA channels will be updated automatically. Email notifications will not be sent for these reversals. This action cannot be undone via this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveChanges} disabled={executing}>
              {executing ? 'Reversing…' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!failureDetails} onOpenChange={(open) => !open && setFailureDetails(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Undo failures</DialogTitle>
            <DialogDescription>
              The following room changes could not be reversed:
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm max-h-96 overflow-y-auto">
            {failureDetails?.map((f, i) => (
              <li key={i} className="border-l-2 border-destructive pl-3">
                <div className="font-medium">Booking {f.row}</div>
                <div className="text-muted-foreground">{f.reason}</div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShuffleHistory;

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shuffle, User } from 'lucide-react';
import { format } from 'date-fns';
import suitespotLogo from '@/assets/suitespot-logo.png';

interface ShuffleLog {
  id: string;
  shuffle_date: string;
  triggered_by_reference: string;
  room_type: string;
  moves: any[];
  move_count: number;
  reason: string | null;
  created_at: string;
}

const ShuffleHistory = () => {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: 'automatic' | 'manual' =
    searchParams.get('type') === 'manual' ? 'manual' : 'automatic';
  const [logs, setLogs] = useState<ShuffleLog[]>([]);
  const [fetching, setFetching] = useState(true);
  const propertyId = usePropertyId();

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

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="PMS" currentPage="Shuffle History" />
          <div className="flex items-center gap-4">
            <SlideMenu userRole={userRole} />
            <img src={suitespotLogo} alt="SuiteSpot Logo" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold">Shuffle History</h1>
              <p className="text-sm text-muted-foreground">Auto-shuffle room rearrangement log</p>
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
            <p>No room shuffles have occurred yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map(log => (
              <Card key={log.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Shuffle className="h-5 w-5 text-amber-500" />
                      <CardTitle className="text-base">
                        Shuffle for booking {log.triggered_by_reference}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.room_type}</Badge>
                      <Badge variant="secondary">{log.move_count} move{log.move_count !== 1 ? 's' : ''}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.shuffle_date), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {log.reason && (
                    <p className="text-sm text-muted-foreground mb-3">{log.reason}</p>
                  )}
                  <div className="space-y-2">
                    {(log.moves as any[]).map((move: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-2">
                        <span className="font-medium">{move.guest_name}</span>
                        <span className="text-muted-foreground">Room #{move.from_room_number}</span>
                        <span className="text-amber-500">→</span>
                        <span className="text-muted-foreground">Room #{move.to_room_number}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {move.check_in} — {move.check_out}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ShuffleHistory;

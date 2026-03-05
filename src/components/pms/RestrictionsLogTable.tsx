import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, CheckCircle, Clock } from 'lucide-react';

interface RatePlanOption {
  id: string;
  name: string;
  room_type: string | null;
}

interface RestrictionsLogTableProps {
  ratePlans: RatePlanOption[];
  refreshKey?: number;
}

interface RestrictionRow {
  id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  min_stay_arrival: number | null;
  min_stay_through: number | null;
  max_stay: number | null;
  stop_sell: boolean | null;
  closed_to_arrival: boolean | null;
  closed_to_departure: boolean | null;
  synced_to_channex: boolean | null;
  ratePlanName: string;
  roomType: string | null;
}

export function RestrictionsLogTable({ ratePlans, refreshKey }: RestrictionsLogTableProps) {
  const { toast } = useToast();
  const [restrictions, setRestrictions] = useState<RestrictionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRestrictions = useCallback(async () => {
    if (ratePlans.length === 0) {
      setRestrictions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const planIds = ratePlans.map((p) => p.id);
    const { data, error } = await supabase
      .from('rate_plan_restrictions')
      .select('*')
      .in('rate_plan_id', planIds)
      .order('date_from', { ascending: true });

    if (error) {
      console.error('Error fetching restrictions:', error);
      setLoading(false);
      return;
    }

    const planMap = new Map(ratePlans.map((p) => [p.id, p]));
    const mapped: RestrictionRow[] = (data || []).map((r) => {
      const plan = planMap.get(r.rate_plan_id);
      return {
        ...r,
        ratePlanName: plan?.name || 'Unknown',
        roomType: plan?.room_type || null,
      };
    });

    setRestrictions(mapped);
    setLoading(false);
  }, [ratePlans]);

  useEffect(() => {
    fetchRestrictions();
  }, [fetchRestrictions, refreshKey]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('rate_plan_restrictions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete restriction', variant: 'destructive' });
      return;
    }
    toast({ title: 'Deleted', description: 'Restriction removed' });
    setRestrictions((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Current Restrictions</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Current Restrictions</CardTitle>
        <CardDescription>
          {restrictions.length} date-specific restriction(s) for this property
        </CardDescription>
      </CardHeader>
      <CardContent>
        {restrictions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No date-specific restrictions set.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rate Plan</TableHead>
                <TableHead className="hidden md:table-cell">Room Type</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Restrictions</TableHead>
                <TableHead className="w-10">Sync</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restrictions.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm font-medium">{r.ratePlanName}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {r.roomType || '—'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(r.date_from + 'T00:00:00'), 'MMM d, yyyy')}
                    {r.date_from !== r.date_to && (
                      <> → {format(new Date(r.date_to + 'T00:00:00'), 'MMM d, yyyy')}</>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.stop_sell && <Badge variant="destructive" className="text-[10px]">Stop Sell</Badge>}
                      {(r.min_stay_arrival ?? 0) > 1 && (
                        <Badge variant="secondary" className="text-[10px]">A:{r.min_stay_arrival}</Badge>
                      )}
                      {(r.min_stay_through ?? 0) > 1 && (
                        <Badge variant="secondary" className="text-[10px]">T:{r.min_stay_through}</Badge>
                      )}
                      {r.max_stay && <Badge variant="secondary" className="text-[10px]">Max:{r.max_stay}</Badge>}
                      {r.closed_to_arrival && <Badge variant="outline" className="text-[10px]">CTA</Badge>}
                      {r.closed_to_departure && <Badge variant="outline" className="text-[10px]">CTD</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.synced_to_channex ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-orange-500" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

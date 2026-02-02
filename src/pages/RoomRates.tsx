import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { useAuth } from '@/lib/auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RatePlan {
  id: string;
  name: string;
  is_default: boolean;
  is_active: boolean;
}

interface RatePlanPrice {
  id: string;
  rate_plan_id: string;
  room_type: string;
  weekday_rate: number;
  weekend_rate: number;
  min_stay: number;
}

const RoomRates = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [defaultPlan, setDefaultPlan] = useState<RatePlan | null>(null);
  const [prices, setPrices] = useState<RatePlanPrice[]>([]);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      // Fetch the default rate plan
      const { data: plans, error: plansError } = await supabase
        .from('rate_plans')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();

      if (plansError && plansError.code !== 'PGRST116') throw plansError;

      if (plans) {
        setDefaultPlan(plans);

        // Fetch prices for the default plan
        const { data: priceData, error: pricesError } = await supabase
          .from('rate_plan_prices')
          .select('*')
          .eq('rate_plan_id', plans.id)
          .order('room_type');

        if (pricesError) throw pricesError;
        setPrices(priceData || []);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return '—';
    return `$${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <SlideMenu userRole={userRole} />
            <h1 className="text-xl font-semibold text-foreground">Room Rates</h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/pms/prices" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Manage in PMS
            </Link>
          </Button>
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="ICONIA" currentPage="Room Rates" />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Rates are managed centrally in{' '}
            <Link to="/pms/prices" className="text-primary hover:underline">
              PMS → Prices
            </Link>
            . Below shows the current default rate plan.
          </p>
        </div>

        {defaultPlan ? (
          <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h2 className="font-semibold">{defaultPlan.name}</h2>
              <p className="text-sm text-muted-foreground">Default Rate Plan</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Room Type</TableHead>
                  <TableHead className="font-semibold text-right">Weekday Rate</TableHead>
                  <TableHead className="font-semibold text-right">Weekend Rate</TableHead>
                  <TableHead className="font-semibold text-right">Min Stay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((price) => (
                  <TableRow key={price.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{price.room_type}</TableCell>
                    <TableCell className="text-right">{formatCurrency(price.weekday_rate)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(price.weekend_rate)}</TableCell>
                    <TableCell className="text-right">{price.min_stay} night{price.min_stay !== 1 ? 's' : ''}</TableCell>
                  </TableRow>
                ))}

                {prices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No room types configured in the default rate plan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-card rounded-lg border shadow-sm p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No default rate plan found. Create one in PMS → Prices.
            </p>
            <Button asChild>
              <Link to="/pms/prices">Go to Price Management</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default RoomRates;

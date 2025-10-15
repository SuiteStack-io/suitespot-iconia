import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { RevenueBySource } from '@/components/RevenueBySource';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Analytics = () => {
  const { userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });

  useEffect(() => {
    if (!loading && userRole !== 'admin') {
      navigate('/');
    }
  }, [userRole, loading, navigate]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchRevenueStats();
      
      const channel = supabase
        .channel('reservations-revenue')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
          },
          () => {
            fetchRevenueStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole]);

  const fetchRevenueStats = async () => {
    const { data: revenueData } = await supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount')
      .neq('status', 'Cancelled');

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    setRevenueStats({ totalRevenue, netRevenue, totalCommission });
  };

  if (loading || userRole !== 'admin') {
    return null;
  }

  const revenueCards = [
    {
      title: 'Total Revenue',
      value: revenueStats.totalRevenue,
      subtitle: 'Gross revenue',
      color: 'text-emerald-600',
    },
    {
      title: 'Net Revenue',
      value: revenueStats.netRevenue,
      subtitle: 'After commission',
      color: 'text-green-600',
    },
    {
      title: 'Commission Paid',
      value: revenueStats.totalCommission,
      subtitle: 'Total commission',
      color: 'text-amber-600',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">Revenue Analytics</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          {revenueCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <DollarSign className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${stat.value.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section>
          <RevenueBySource />
        </section>
      </main>
    </div>
  );
};

export default Analytics;

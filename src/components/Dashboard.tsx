import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, LogIn, LogOut, TrendingUp, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardStats {
  todayArrivals: number;
  todayDepartures: number;
  inHouse: number;
  newBookings: number;
  totalRevenue: number;
  netRevenue: number;
  totalCommission: number;
}

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    todayArrivals: 0,
    todayDepartures: 0,
    inHouse: 0,
    newBookings: 0,
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });

  useEffect(() => {
    fetchStats();
    
    // Real-time updates
    const channel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');

    // Today's arrivals
    const { data: arrivals } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('check_in_date', today)
      .neq('status', 'Cancelled');

    // Today's departures
    const { data: departures } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('check_out_date', today)
      .neq('status', 'Cancelled');

    // In-house count
    const { data: inHouse } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('status', 'In-House');

    // New bookings in last 24h
    const { data: newBookings } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .gte('created_at', yesterday);

    // Revenue calculations
    const { data: revenueData } = await supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount')
      .neq('status', 'Cancelled');

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    setStats({
      todayArrivals: arrivals?.length || 0,
      todayDepartures: departures?.length || 0,
      inHouse: inHouse?.length || 0,
      newBookings: newBookings?.length || 0,
      totalRevenue,
      netRevenue,
      totalCommission,
    });
  };

  const statCards = [
    {
      title: "Today's Arrivals",
      value: stats.todayArrivals,
      icon: LogIn,
      color: 'text-blue-600',
      isRevenue: false,
    },
    {
      title: "Today's Departures",
      value: stats.todayDepartures,
      icon: LogOut,
      color: 'text-orange-600',
      isRevenue: false,
    },
    {
      title: 'In-House Now',
      value: stats.inHouse,
      icon: Calendar,
      color: 'text-green-600',
      isRevenue: false,
    },
    {
      title: 'New Bookings (24h)',
      value: stats.newBookings,
      icon: TrendingUp,
      color: 'text-purple-600',
      isRevenue: false,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stat.isRevenue ? `$${stat.value.toFixed(2)}` : stat.value}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
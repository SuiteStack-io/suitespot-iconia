import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, Calendar, BarChart3, Users } from 'lucide-react';
import { RevenueBySource } from '@/components/RevenueBySource';
import { RevenueByRoom } from '@/components/RevenueByRoom';
import { RevenueByGuests } from '@/components/RevenueByGuests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TimePeriod = 'week' | 'month' | 'quarter' | 'ytd';

const Analytics = () => {
  const { userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [bookingSources, setBookingSources] = useState({ direct: 0, indirect: 0 });
  const [totalGuests, setTotalGuests] = useState(0);

  useEffect(() => {
    if (!loading && userRole !== 'admin') {
      navigate('/');
    }
  }, [userRole, loading, navigate]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchAllStats();
      
      const channel = supabase
        .channel('reservations-analytics')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservations',
          },
          () => {
            fetchAllStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userRole, timePeriod]);

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();
    
    switch (timePeriod) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
        break;
    }
    
    return { startDate: startDate.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
  };

  const getFormattedDateRange = () => {
    const { startDate, endDate } = getDateRange();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const fetchAllStats = async () => {
    const { startDate, endDate } = getDateRange();
    
    // Fetch revenue stats
    const { data: revenueData } = await supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount, channel, source')
      .neq('status', 'Cancelled')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    setRevenueStats({ totalRevenue, netRevenue, totalCommission });
    
    // Fetch total bookings
    const { data: bookingsData, count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Cancelled')
      .gte('created_at', startDate)
      .lte('created_at', endDate);
      
    setTotalBookings(count || 0);
    
    // Calculate total guests
    const { data: guestsData } = await supabase
      .from('reservations')
      .select('number_of_guests')
      .neq('status', 'cancelled')
      .gte('check_in_date', startDate)
      .lte('check_out_date', endDate);
    
    const totalGuestsCount = guestsData?.reduce((sum, r) => sum + (r.number_of_guests || 0), 0) || 0;
    setTotalGuests(totalGuestsCount);
    
    // Calculate booking sources
    const directBookings = revenueData?.filter(r => 
      r.channel?.toLowerCase() === 'direct' || r.source?.toLowerCase() === 'direct'
    ).length || 0;
    const indirectBookings = (revenueData?.length || 0) - directBookings;
    
    setBookingSources({ direct: directBookings, indirect: indirectBookings });
    
    // Calculate occupancy rate
    const { data: units } = await supabase
      .from('units')
      .select('id');
      
    const totalUnits = units?.length || 1;
    
    const { data: reservations } = await supabase
      .from('reservations')
      .select('check_in_date, check_out_date, nights')
      .eq('status', 'confirmed')
      .gte('check_in_date', startDate)
      .lte('check_out_date', endDate);
    
    const totalNights = reservations?.reduce((sum, r) => sum + (r.nights || 0), 0) || 0;
    
    let days = 1;
    switch (timePeriod) {
      case 'week':
        days = 7;
        break;
      case 'month':
        days = 30;
        break;
      case 'quarter':
        days = 90;
        break;
      case 'ytd':
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        days = Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
        break;
    }
    
    const totalAvailableNights = totalUnits * days;
    const occupancy = totalAvailableNights > 0 ? (totalNights / totalAvailableNights) * 100 : 0;
    
    setOccupancyRate(occupancy);
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
          <h1 className="text-xl font-bold">Suitespot Analytics</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <div className="flex justify-center">
            <Tabs value={timePeriod} onValueChange={(value) => setTimePeriod(value as TimePeriod)}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="quarter">Quarter</TabsTrigger>
                <TabsTrigger value="ytd">YTD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="text-center text-sm text-muted-foreground">
            {getFormattedDateRange()}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {occupancyRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {timePeriod}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalBookings}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {timePeriod}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Guests</CardTitle>
              <Users className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalGuests}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {timePeriod}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Booking Sources</CardTitle>
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Direct</span>
                  <span className="font-bold">
                    {bookingSources.direct} ({totalBookings > 0 ? ((bookingSources.direct / totalBookings) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Indirect</span>
                  <span className="font-bold">
                    {bookingSources.indirect} ({totalBookings > 0 ? ((bookingSources.indirect / totalBookings) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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

        <section className="space-y-8">
          <RevenueBySource />
          <RevenueByRoom />
          <RevenueByGuests />
        </section>
      </main>
    </div>
  );
};

export default Analytics;

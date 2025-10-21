import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, Calendar as CalendarIcon, BarChart3, Users } from 'lucide-react';
import { RevenueBySource } from '@/components/RevenueBySource';
import { RevenueByRoom } from '@/components/RevenueByRoom';
import { RevenueByGuests } from '@/components/RevenueByGuests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Slider } from '@/components/ui/slider';

type TimePeriod = 'week' | 'month' | 'quarter' | 'ytd';

const Analytics = () => {
  const { userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [bookingSources, setBookingSources] = useState({ direct: 0, indirect: 0 });
  const [totalGuests, setTotalGuests] = useState(0);
  const [landlordPercentage, setLandlordPercentage] = useState(70);
  const [totalNights, setTotalNights] = useState(0);
  const [totalAvailableRooms, setTotalAvailableRooms] = useState(0);
  const [directCommission, setDirectCommission] = useState(0);
  const [bookingComCommission, setBookingComCommission] = useState(0);

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
  }, [userRole, timePeriod, customDateRange]);

  const getDateRange = () => {
    // If custom date range is set, use it
    if (customDateRange?.from && customDateRange?.to) {
      return { 
        startDate: format(customDateRange.from, 'yyyy-MM-dd'), 
        endDate: format(customDateRange.to, 'yyyy-MM-dd') 
      };
    }
    
    // Otherwise use predefined period
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
        startDate = new Date(2025, 0, 1); // January 1st, 2025
        break;
    }
    
    return { startDate: startDate.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
  };

  const getFormattedDateRange = () => {
    const { startDate, endDate } = getDateRange();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`;
  };

  const handleTabChange = (value: string) => {
    setTimePeriod(value as TimePeriod);
    setCustomDateRange(undefined); // Clear custom date range when tab is selected
  };

  const fetchAllStats = async () => {
    const { startDate, endDate } = getDateRange();
    
    // Fetch revenue stats - using check_in_date for accurate date range
    const { data: revenueData } = await supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount, channel, source')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate);

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    // Calculate commission by source
    const directCommissionAmount = revenueData
      ?.filter(r => r.channel?.toLowerCase() === 'direct' || r.source?.toLowerCase() === 'direct')
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
    const bookingComCommissionAmount = revenueData
      ?.filter(r => r.channel?.toLowerCase() !== 'direct' && r.source?.toLowerCase() !== 'direct')
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    setRevenueStats({ totalRevenue, netRevenue, totalCommission });
    setDirectCommission(directCommissionAmount);
    setBookingComCommission(bookingComCommissionAmount);
    
    // Fetch total bookings - using check_in_date
    const { data: bookingsData, count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate);
      
    setTotalBookings(count || 0);
    
    // Calculate total guests
    const { data: guestsData } = await supabase
      .from('reservations')
      .select('number_of_guests')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate);
    
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
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_out_date', endDate);
    
    const totalNights = reservations?.reduce((sum, r) => sum + (r.nights || 0), 0) || 0;
    setTotalNights(totalNights);
    
    let days = 1;
    if (customDateRange?.from && customDateRange?.to) {
      days = Math.ceil((customDateRange.to.getTime() - customDateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else {
      const now = new Date();
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
          const ytdStart = new Date(2025, 0, 1);
          days = Math.ceil((now.getTime() - ytdStart.getTime()) / (1000 * 60 * 60 * 24));
          break;
      }
    }
    
    const totalAvailableNights = totalUnits * days;
    const occupancy = totalAvailableNights > 0 ? (totalNights / totalAvailableNights) * 100 : 0;
    
    setOccupancyRate(occupancy);
    setTotalAvailableRooms(totalAvailableNights);
  };

  if (loading || userRole !== 'admin') {
    return null;
  }

  const landlordTotalRevenue = revenueStats.totalRevenue * (landlordPercentage / 100);
  const suitespotTotalRevenue = revenueStats.totalRevenue * ((100 - landlordPercentage) / 100);
  
  const landlordNetRevenue = revenueStats.netRevenue * (landlordPercentage / 100);
  const suitespotNetRevenue = revenueStats.netRevenue * ((100 - landlordPercentage) / 100);

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
            <Tabs value={customDateRange ? '' : timePeriod} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="quarter">Quarter</TabsTrigger>
                <TabsTrigger value="ytd">YTD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex justify-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-sm text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {getFormattedDateRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="range"
                  selected={customDateRange || {
                    from: new Date(getDateRange().startDate),
                    to: new Date(getDateRange().endDate)
                  }}
                  onSelect={setCustomDateRange}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
              <CalendarIcon className="h-4 w-4 text-purple-600" />
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ADR</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalNights > 0 ? (revenueStats.totalRevenue / totalNights).toFixed(2) : '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Average Daily Rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">RevPAR</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totalAvailableRooms > 0 ? (revenueStats.totalRevenue / totalAvailableRooms).toFixed(2) : '0.00'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Revenue per Available Room</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Landlord Percentage</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-3">
                {landlordPercentage}%
              </div>
              <Slider
                value={[landlordPercentage]}
                onValueChange={(value) => setLandlordPercentage(value[0])}
                min={0}
                max={100}
                step={1}
                className="mb-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                SuiteSpot Revenue % ({100 - landlordPercentage}%)
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${revenueStats.totalRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Gross revenue</p>
              <div className="mt-3 pt-3 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Landlord ({landlordPercentage}%)</span>
                  <span className="font-semibold">${landlordTotalRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">SuiteSpot ({100 - landlordPercentage}%)</span>
                  <span className="font-semibold">${suitespotTotalRevenue.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${revenueStats.netRevenue.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">After commission</p>
              <div className="mt-3 pt-3 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Landlord ({landlordPercentage}%)</span>
                  <span className="font-semibold">${landlordNetRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">SuiteSpot ({100 - landlordPercentage}%)</span>
                  <span className="font-semibold">${suitespotNetRevenue.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${revenueStats.totalCommission.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total commission</p>
              <div className="mt-3 pt-3 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Direct</span>
                  <span className="font-semibold">${directCommission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Booking.com</span>
                  <span className="font-semibold">${bookingComCommission.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
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

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, Calendar as CalendarIcon, BarChart3, Users, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

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
  const [showDirectDialog, setShowDirectDialog] = useState(false);
  const [directSourceDetails, setDirectSourceDetails] = useState<Array<{
    source: string;
    count: number;
    grossRevenue: number;
    commissionRate: number;
    commission: number;
    netRevenue: number;
  }>>([]);
  const [showOccupancyDialog, setShowOccupancyDialog] = useState(false);
  const [showBookingsDialog, setShowBookingsDialog] = useState(false);
  const [showGuestsDialog, setShowGuestsDialog] = useState(false);
  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [occupancyDetails, setOccupancyDetails] = useState<Array<{
    unitName: string;
    unitNumber: string;
    nightsBooked: number;
    nightsAvailable: number;
    occupancyRate: number;
  }>>([]);
  const [bookingsDetails, setBookingsDetails] = useState<Array<{
    guestNames: string;
    unitName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    guests: number;
    source: string;
  }>>([]);
  const [guestsDetails, setGuestsDetails] = useState<Array<{
    guestNames: string;
    numberOfGuests: number;
    unitName: string;
    checkIn: string;
    checkOut: string;
  }>>([]);
  const [showTotalRevenueDialog, setShowTotalRevenueDialog] = useState(false);
  const [totalRevenueDetails, setTotalRevenueDetails] = useState<Array<{
    unitName: string;
    unitNumber: string;
    bookings: number;
    grossRevenue: number;
    landlordShare: number;
    suitespotShare: number;
  }>>([]);
  const [showNetRevenueDialog, setShowNetRevenueDialog] = useState(false);
  const [netRevenueDetails, setNetRevenueDetails] = useState<Array<{
    unitName: string;
    unitNumber: string;
    grossRevenue: number;
    commission: number;
    netRevenue: number;
    landlordShare: number;
    suitespotShare: number;
  }>>([]);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [commissionDetails, setCommissionDetails] = useState<Array<{
    source: string;
    bookings: number;
    grossRevenue: number;
    commissionRate: number;
    commissionAmount: number;
  }>>([]);

  useEffect(() => {
    if (!loading && userRole !== 'admin') {
      navigate('/admin');
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

  const fetchDirectSourceDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await supabase
      .from('reservations')
      .select('source, total_price, commission_amount, net_revenue')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate);

    // Filter for direct bookings only
    const directData = data?.filter(r => 
      r.source?.toLowerCase() === 'direct' || 
      r.source?.toLowerCase() !== 'booking.com'
    ) || [];

    // Group by source
    const sourceMap: Record<string, any> = {};
    
    directData.forEach((reservation) => {
      const source = reservation.source || 'Unknown';
      
      // Skip booking.com entries
      if (source.toLowerCase().includes('booking')) return;
      
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          count: 0,
          grossRevenue: 0,
          commissionRate: 10.0, // Default rate for direct bookings
          commission: 0,
          netRevenue: 0,
        };
      }
      
      sourceMap[source].count += 1;
      sourceMap[source].grossRevenue += reservation.total_price || 0;
      sourceMap[source].commission += reservation.commission_amount || 0;
      sourceMap[source].netRevenue += reservation.net_revenue || 0;
    });

    const sourceArray = Object.values(sourceMap).sort(
      (a: any, b: any) => b.grossRevenue - a.grossRevenue
    );

    setDirectSourceDetails(sourceArray);
  };

  const handleDirectClick = () => {
    fetchDirectSourceDetails();
    setShowDirectDialog(true);
  };

  const fetchOccupancyDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    // Get all units
    const { data: units } = await supabase
      .from('units')
      .select('id, name, unit_number')
      .eq('location', 'ICONIA')
      .order('unit_number');

    // Calculate days in period
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

    const details = await Promise.all(
      (units || []).map(async (unit) => {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('nights')
          .eq('unit_id', unit.id)
          .neq('status', 'Cancelled')
          .gte('check_in_date', startDate)
          .lte('check_in_date', endDate);

        const nightsBooked = reservations?.reduce((sum, r) => sum + (r.nights || 0), 0) || 0;
        const nightsAvailable = days;
        const occupancyRate = nightsAvailable > 0 ? (nightsBooked / nightsAvailable) * 100 : 0;

        return {
          unitName: unit.name,
          unitNumber: unit.unit_number || 'N/A',
          nightsBooked,
          nightsAvailable,
          occupancyRate,
        };
      })
    );

    setOccupancyDetails(details);
  };

  const fetchBookingsDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await supabase
      .from('reservations')
      .select('guest_names, check_in_date, check_out_date, nights, number_of_guests, source, units(name)')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)
      .order('check_in_date', { ascending: false });

    const details = (data || []).map((r: any) => ({
      guestNames: r.guest_names.join(', '),
      unitName: r.units?.name || 'N/A',
      checkIn: format(new Date(r.check_in_date), 'MMM dd, yyyy'),
      checkOut: format(new Date(r.check_out_date), 'MMM dd, yyyy'),
      nights: r.nights || 0,
      guests: r.number_of_guests,
      source: r.source,
    }));

    setBookingsDetails(details);
  };

  const fetchGuestsDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await supabase
      .from('reservations')
      .select('guest_names, number_of_guests, check_in_date, check_out_date, units(name)')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)
      .order('number_of_guests', { ascending: false });

    const details = (data || []).map((r: any) => ({
      guestNames: r.guest_names.join(', '),
      numberOfGuests: r.number_of_guests,
      unitName: r.units?.name || 'N/A',
      checkIn: format(new Date(r.check_in_date), 'MMM dd, yyyy'),
      checkOut: format(new Date(r.check_out_date), 'MMM dd, yyyy'),
    }));

    setGuestsDetails(details);
  };

  const fetchSourcesDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await supabase
      .from('reservations')
      .select('source, total_price, commission_amount, net_revenue')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate);

    // Group by source
    const sourceMap: Record<string, any> = {};
    
    (data || []).forEach((reservation: any) => {
      const source = reservation.source || 'Unknown';
      
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          count: 0,
          grossRevenue: 0,
          commission: 0,
          netRevenue: 0,
        };
      }
      
      sourceMap[source].count += 1;
      sourceMap[source].grossRevenue += reservation.total_price || 0;
      sourceMap[source].commission += reservation.commission_amount || 0;
      sourceMap[source].netRevenue += reservation.net_revenue || 0;
    });

    const sourceArray = Object.values(sourceMap).sort(
      (a: any, b: any) => b.grossRevenue - a.grossRevenue
    );

    setDirectSourceDetails(sourceArray);
  };

  const handleOccupancyClick = () => {
    fetchOccupancyDetails();
    setShowOccupancyDialog(true);
  };

  const handleBookingsClick = () => {
    fetchBookingsDetails();
    setShowBookingsDialog(true);
  };

  const handleGuestsClick = () => {
    fetchGuestsDetails();
    setShowGuestsDialog(true);
  };

  const handleSourcesClick = () => {
    fetchSourcesDetails();
    setShowSourcesDialog(true);
  };

  const fetchTotalRevenueDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data: units } = await supabase
      .from('units')
      .select('id, name, unit_number')
      .eq('location', 'ICONIA')
      .order('unit_number');

    const details = await Promise.all(
      (units || []).map(async (unit) => {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('total_price')
          .eq('unit_id', unit.id)
          .neq('status', 'Cancelled')
          .gte('check_in_date', startDate)
          .lte('check_in_date', endDate);

        const grossRevenue = reservations?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
        const bookings = reservations?.length || 0;
        const landlordShare = grossRevenue * (landlordPercentage / 100);
        const suitespotShare = grossRevenue * ((100 - landlordPercentage) / 100);

        return {
          unitName: unit.name,
          unitNumber: unit.unit_number || 'N/A',
          bookings,
          grossRevenue,
          landlordShare,
          suitespotShare,
        };
      })
    );

    setTotalRevenueDetails(details.filter(d => d.bookings > 0));
  };

  const fetchNetRevenueDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data: units } = await supabase
      .from('units')
      .select('id, name, unit_number')
      .eq('location', 'ICONIA')
      .order('unit_number');

    const details = await Promise.all(
      (units || []).map(async (unit) => {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('total_price, commission_amount, net_revenue')
          .eq('unit_id', unit.id)
          .neq('status', 'Cancelled')
          .gte('check_in_date', startDate)
          .lte('check_in_date', endDate);

        const grossRevenue = reservations?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
        const commission = reservations?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
        const netRevenue = reservations?.reduce((sum, r) => sum + (r.net_revenue || 0), 0) || 0;
        const landlordShare = netRevenue * (landlordPercentage / 100);
        const suitespotShare = netRevenue * ((100 - landlordPercentage) / 100);

        return {
          unitName: unit.name,
          unitNumber: unit.unit_number || 'N/A',
          grossRevenue,
          commission,
          netRevenue,
          landlordShare,
          suitespotShare,
        };
      })
    );

    setNetRevenueDetails(details.filter(d => d.grossRevenue > 0));
  };

  const getDisplayCommissionRate = (source: string): number => {
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes('booking.com') || sourceLower.includes('booking com')) {
      return 17.4;
    }
    return 10;
  };

  const fetchCommissionDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await supabase
      .from('reservations')
      .select('source, total_price, commission_amount, commission_rate')
      .neq('status', 'Cancelled')
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate);

    const sourceMap: Record<string, any> = {};
    
    (data || []).forEach((reservation) => {
      const source = reservation.source || 'Unknown';
      
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          bookings: 0,
          grossRevenue: 0,
          commissionAmount: 0,
          commissionRate: getDisplayCommissionRate(source),
        };
      }
      
      sourceMap[source].bookings += 1;
      sourceMap[source].grossRevenue += reservation.total_price || 0;
      sourceMap[source].commissionAmount += reservation.commission_amount || 0;
    });

    const sourceArray = Object.values(sourceMap).sort(
      (a: any, b: any) => b.grossRevenue - a.grossRevenue
    );

    setCommissionDetails(sourceArray);
  };


  const handleTotalRevenueClick = () => {
    fetchTotalRevenueDetails();
    setShowTotalRevenueDialog(true);
  };

  const handleNetRevenueClick = () => {
    fetchNetRevenueDetails();
    setShowNetRevenueDialog(true);
  };

  const handleCommissionClick = () => {
    fetchCommissionDetails();
    setShowCommissionDialog(true);
  };

  const getExportData = () => {
    const adr = totalNights > 0 ? (revenueStats.totalRevenue / totalNights) : 0;
    const revpar = totalAvailableRooms > 0 ? (revenueStats.totalRevenue / totalAvailableRooms) : 0;
    
    return [
      {
        'Metric': 'Period',
        'Value': getFormattedDateRange(),
      },
      {},
      {
        'Metric': 'Occupancy Rate',
        'Value': `${occupancyRate.toFixed(1)}%`,
      },
      {
        'Metric': 'Total Bookings',
        'Value': totalBookings,
      },
      {
        'Metric': 'Total Guests',
        'Value': totalGuests,
      },
      {
        'Metric': 'Total Nights',
        'Value': totalNights,
      },
      {},
      {
        'Metric': 'Direct Bookings',
        'Value': `${bookingSources.direct} (${totalBookings > 0 ? ((bookingSources.direct / totalBookings) * 100).toFixed(1) : 0}%)`,
      },
      {
        'Metric': 'Indirect Bookings',
        'Value': `${bookingSources.indirect} (${totalBookings > 0 ? ((bookingSources.indirect / totalBookings) * 100).toFixed(1) : 0}%)`,
      },
      {},
      {
        'Metric': 'ADR (Average Daily Rate)',
        'Value': `$${adr.toFixed(2)}`,
      },
      {
        'Metric': 'RevPAR (Revenue per Available Room)',
        'Value': `$${revpar.toFixed(2)}`,
      },
      {},
      {
        'Metric': 'Total Revenue (Gross)',
        'Value': `$${revenueStats.totalRevenue.toFixed(2)}`,
      },
      {
        'Metric': 'Total Commission',
        'Value': `$${revenueStats.totalCommission.toFixed(2)}`,
      },
      {
        'Metric': 'Total Revenue (Net)',
        'Value': `$${revenueStats.netRevenue.toFixed(2)}`,
      },
      {},
      {
        'Metric': 'Direct Commission',
        'Value': `$${directCommission.toFixed(2)}`,
      },
      {
        'Metric': 'Booking.com Commission',
        'Value': `$${bookingComCommission.toFixed(2)}`,
      },
      {},
      {
        'Metric': `Landlord Revenue (${landlordPercentage}%)`,
        'Value': `$${landlordNetRevenue.toFixed(2)}`,
      },
      {
        'Metric': `SuiteSpot Revenue (${100 - landlordPercentage}%)`,
        'Value': `$${suitespotNetRevenue.toFixed(2)}`,
      },
    ];
  };

  const handleExportExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('No analytics data to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Revenue Analytics');
    
    const filename = `revenue_analytics_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success('Analytics data exported to Excel');
  };

  const handleExportCSV = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('No analytics data to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `revenue_analytics_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    link.click();
    toast.success('Analytics data exported to CSV');
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
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Revenue Analytics" />
          <div className="flex items-center gap-4 mt-4 justify-between">
            <div className="flex items-center gap-4">
              <SlideMenu userRole={userRole} />
              
              {/* Mobile back button - icon only */}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="md:hidden"
                size="icon"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              {/* Desktop back button with text */}
              <Button 
                variant="ghost" 
                onClick={() => navigate('/admin')}
                className="hidden md:flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              
              <h1 className="text-xl font-bold">SuiteSpot Analytics</h1>
            </div>
            
            {/* Export buttons */}
            <div className="flex gap-2">
              <Button variant="default" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
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
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleOccupancyClick}>
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

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleBookingsClick}>
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

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleGuestsClick}>
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

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleSourcesClick}>
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
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleTotalRevenueClick}>
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

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleNetRevenueClick}>
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

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleCommissionClick}>
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
                <div className="flex justify-between text-xs group">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDirectClick(); }}
                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    Direct
                    <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <span className="font-semibold">
                    ${directCommission.toFixed(2)} ({revenueStats.totalCommission > 0 ? ((directCommission / revenueStats.totalCommission) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Booking.com</span>
                  <span className="font-semibold">
                    ${bookingComCommission.toFixed(2)} ({revenueStats.totalCommission > 0 ? ((bookingComCommission / revenueStats.totalCommission) * 100).toFixed(1) : 0}%)
                  </span>
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

      {/* Occupancy Rate Dialog */}
      <Dialog open={showOccupancyDialog} onOpenChange={setShowOccupancyDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Occupancy Rate Breakdown</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Unit</TableHead>
                  <TableHead className="font-semibold">Room #</TableHead>
                  <TableHead className="text-right font-semibold">Nights Booked</TableHead>
                  <TableHead className="text-right font-semibold">Available Nights</TableHead>
                  <TableHead className="text-right font-semibold">Occupancy Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupancyDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No occupancy data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {occupancyDetails.map((unit, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{unit.unitName}</TableCell>
                        <TableCell>{unit.unitNumber}</TableCell>
                        <TableCell className="text-right">{unit.nightsBooked}</TableCell>
                        <TableCell className="text-right">{unit.nightsAvailable}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            "font-semibold",
                            unit.occupancyRate >= 80 ? "text-green-600" :
                            unit.occupancyRate >= 50 ? "text-yellow-600" :
                            "text-red-600"
                          )}>
                            {unit.occupancyRate.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        {occupancyDetails.reduce((sum, u) => sum + u.nightsBooked, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {occupancyDetails.reduce((sum, u) => sum + u.nightsAvailable, 0)}
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        {occupancyRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Total Bookings Dialog */}
      <Dialog open={showBookingsDialog} onOpenChange={setShowBookingsDialog}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Total Bookings Breakdown</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Guest Name(s)</TableHead>
                  <TableHead className="font-semibold">Unit</TableHead>
                  <TableHead className="font-semibold">Check-in</TableHead>
                  <TableHead className="font-semibold">Check-out</TableHead>
                  <TableHead className="text-right font-semibold">Nights</TableHead>
                  <TableHead className="text-right font-semibold">Guests</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingsDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No bookings found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {bookingsDetails.map((booking, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{booking.guestNames}</TableCell>
                        <TableCell>{booking.unitName}</TableCell>
                        <TableCell>{booking.checkIn}</TableCell>
                        <TableCell>{booking.checkOut}</TableCell>
                        <TableCell className="text-right">{booking.nights}</TableCell>
                        <TableCell className="text-right">{booking.guests}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            booking.source.toLowerCase().includes('direct') 
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          )}>
                            {booking.source}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={4}>Total</TableCell>
                      <TableCell className="text-right">
                        {bookingsDetails.reduce((sum, b) => sum + b.nights, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {bookingsDetails.reduce((sum, b) => sum + b.guests, 0)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Guests Dialog */}
      <Dialog open={showGuestsDialog} onOpenChange={setShowGuestsDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guests Breakdown</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Guest Name(s)</TableHead>
                  <TableHead className="text-right font-semibold">Number of Guests</TableHead>
                  <TableHead className="font-semibold">Unit</TableHead>
                  <TableHead className="font-semibold">Check-in</TableHead>
                  <TableHead className="font-semibold">Check-out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guestsDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No guest data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {guestsDetails.map((guest, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{guest.guestNames}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-teal-600">
                            {guest.numberOfGuests}
                          </span>
                        </TableCell>
                        <TableCell>{guest.unitName}</TableCell>
                        <TableCell>{guest.checkIn}</TableCell>
                        <TableCell>{guest.checkOut}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total Guests</TableCell>
                      <TableCell className="text-right text-teal-600">
                        {guestsDetails.reduce((sum, g) => sum + g.numberOfGuests, 0)}
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Sources Dialog */}
      <Dialog open={showSourcesDialog} onOpenChange={setShowSourcesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking Sources Breakdown</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="text-right font-semibold">Bookings</TableHead>
                  <TableHead className="text-right font-semibold">Gross Revenue</TableHead>
                  <TableHead className="text-right font-semibold">Commission</TableHead>
                  <TableHead className="text-right font-semibold">Net Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directSourceDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No booking sources found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {directSourceDetails.map((source) => (
                      <TableRow key={source.source}>
                        <TableCell className="font-medium">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            source.source.toLowerCase().includes('direct') 
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          )}>
                            {source.source}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{source.count}</TableCell>
                        <TableCell className="text-right">
                          ${source.grossRevenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-amber-600">
                          ${source.commission.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          ${source.netRevenue.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {directSourceDetails.reduce((sum, s) => sum + s.count, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${directSourceDetails.reduce((sum, s) => sum + s.grossRevenue, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        ${directSourceDetails.reduce((sum, s) => sum + s.commission, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${directSourceDetails.reduce((sum, s) => sum + s.netRevenue, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Total Revenue Dialog */}
      <Dialog open={showTotalRevenueDialog} onOpenChange={setShowTotalRevenueDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Total Revenue Breakdown</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Unit</TableHead>
                  <TableHead className="font-semibold">Room #</TableHead>
                  <TableHead className="text-right font-semibold">Bookings</TableHead>
                  <TableHead className="text-right font-semibold">Gross Revenue</TableHead>
                  <TableHead className="text-right font-semibold">Landlord Share</TableHead>
                  <TableHead className="text-right font-semibold">SuiteSpot Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totalRevenueDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No revenue data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {totalRevenueDetails.map((unit, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{unit.unitName}</TableCell>
                        <TableCell>{unit.unitNumber}</TableCell>
                        <TableCell className="text-right">{unit.bookings}</TableCell>
                        <TableCell className="text-right">${unit.grossRevenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${unit.landlordShare.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${unit.suitespotShare.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        {totalRevenueDetails.reduce((sum, u) => sum + u.bookings, 0)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        ${totalRevenueDetails.reduce((sum, u) => sum + u.grossRevenue, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${totalRevenueDetails.reduce((sum, u) => sum + u.landlordShare, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${totalRevenueDetails.reduce((sum, u) => sum + u.suitespotShare, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Net Revenue Dialog */}
      <Dialog open={showNetRevenueDialog} onOpenChange={setShowNetRevenueDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Net Revenue Breakdown</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Unit</TableHead>
                  <TableHead className="font-semibold">Room #</TableHead>
                  <TableHead className="text-right font-semibold">Gross Revenue</TableHead>
                  <TableHead className="text-right font-semibold">Commission</TableHead>
                  <TableHead className="text-right font-semibold">Net Revenue</TableHead>
                  <TableHead className="text-right font-semibold">Landlord</TableHead>
                  <TableHead className="text-right font-semibold">SuiteSpot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {netRevenueDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No net revenue data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {netRevenueDetails.map((unit, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{unit.unitName}</TableCell>
                        <TableCell>{unit.unitNumber}</TableCell>
                        <TableCell className="text-right">${unit.grossRevenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-amber-600">${unit.commission.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">${unit.netRevenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${unit.landlordShare.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${unit.suitespotShare.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right">
                        ${netRevenueDetails.reduce((sum, u) => sum + u.grossRevenue, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-amber-600">
                        ${netRevenueDetails.reduce((sum, u) => sum + u.commission, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${netRevenueDetails.reduce((sum, u) => sum + u.netRevenue, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${netRevenueDetails.reduce((sum, u) => sum + u.landlordShare, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${netRevenueDetails.reduce((sum, u) => sum + u.suitespotShare, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commission Paid Dialog */}
      <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Commission Breakdown by Source</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Booking Source</TableHead>
                  <TableHead className="text-right font-semibold">Bookings</TableHead>
                  <TableHead className="text-right font-semibold">Gross Revenue</TableHead>
                  <TableHead className="text-right font-semibold">Commission Rate</TableHead>
                  <TableHead className="text-right font-semibold">Commission Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No commission data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {commissionDetails.map((source, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-full",
                            source.source.toLowerCase().includes('direct') 
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          )}>
                            {source.source}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{source.bookings}</TableCell>
                        <TableCell className="text-right">${source.grossRevenue.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{source.commissionRate}%</TableCell>
                        <TableCell className="text-right text-amber-600 font-semibold">
                          ${source.commissionAmount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {commissionDetails.reduce((sum, s) => sum + s.bookings, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${commissionDetails.reduce((sum, s) => sum + s.grossRevenue, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right text-amber-600">
                        ${commissionDetails.reduce((sum, s) => sum + s.commissionAmount, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Direct Sources Commission Dialog */}
      <Dialog open={showDirectDialog} onOpenChange={setShowDirectDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Direct Booking Sources</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Commission Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right font-semibold">Net Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directSourceDetails.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No direct booking sources found for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {directSourceDetails.map((source) => (
                      <TableRow key={source.source}>
                        <TableCell className="font-medium">{source.source}</TableCell>
                        <TableCell className="text-right">{source.count}</TableCell>
                        <TableCell className="text-right">
                          ${source.grossRevenue.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{source.commissionRate}%</TableCell>
                        <TableCell className="text-right text-amber-600">
                          ${source.commission.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          ${source.netRevenue.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {directSourceDetails.reduce((sum, s) => sum + s.count, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${directSourceDetails.reduce((sum, s) => sum + s.grossRevenue, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right text-amber-600">
                        ${directSourceDetails.reduce((sum, s) => sum + s.commission, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ${directSourceDetails.reduce((sum, s) => sum + s.netRevenue, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            <p>* Commission rate: 10% for direct bookings</p>
            <p>* Net Revenue = Gross Revenue - Commission</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Analytics;

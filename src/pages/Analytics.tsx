import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { useProperty } from '@/lib/propertyContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, TrendingUp, Calendar as CalendarIcon, BarChart3, Users, ChevronRight, ChevronDown, Download, FileSpreadsheet } from 'lucide-react';
import { SlideMenu } from '@/components/SlideMenu';
import { AdminBreadcrumb } from '@/components/AdminBreadcrumb';
import { RevenueBySource } from '@/components/RevenueBySource';
import { RevenueByRoom } from '@/components/RevenueByRoom';
import { RevenueByGuests } from '@/components/RevenueByGuests';
import { RevenueByNationality } from '@/components/RevenueByNationality';
import { CancellationAnalytics } from '@/components/analytics/CancellationAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, differenceInDays, addDays, startOfDay } from 'date-fns';
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

const formatCurrency = (value: number): string => {
  return Math.ceil(value).toLocaleString('en-US');
};

const Analytics = () => {
  const { userRole, loading } = useAuth();
  const propertyId = usePropertyId();
  const { activeProperty, refreshProperties } = useProperty();
  const navigate = useNavigate();

  const savedLandlordPercentage = Number((activeProperty as any)?.landlord_share_percentage ?? 70);

  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });
  const [occupancyRate, setOccupancyRate] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [bookingSources, setBookingSources] = useState({ 
    direct: { count: 0, revenue: 0 }, 
    indirect: { count: 0, revenue: 0 } 
  });
  const [totalGuests, setTotalGuests] = useState(0);
  const [landlordPercentage, setLandlordPercentage] = useState(savedLandlordPercentage);
  const [savingShare, setSavingShare] = useState(false);
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
  const [isDirectExpanded, setIsDirectExpanded] = useState(false);
  const [sourcesData, setSourcesData] = useState<{
    bookingCom: { count: number; grossRevenue: number; commission: number; netRevenue: number };
    direct: { count: number; grossRevenue: number; commission: number; netRevenue: number };
    directBreakdown: Array<{ source: string; count: number; grossRevenue: number; commission: number; netRevenue: number }>;
  }>({
    bookingCom: { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 },
    direct: { count: 0, grossRevenue: 0, commission: 0, netRevenue: 0 },
    directBreakdown: [],
  });
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
    paymentMethod: string;
    currency: string;
  }>>([]);
  const [guestsDetails, setGuestsDetails] = useState<Array<{
    guestNames: string;
    numberOfGuests: number;
    unitName: string;
    checkIn: string;
    checkOut: string;
    paymentMethod: string;
    currency: string;
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
  }, [userRole, timePeriod, customDateRange, propertyId]);

  // Sync slider to saved value when active property changes / refreshes
  useEffect(() => {
    setLandlordPercentage(savedLandlordPercentage);
  }, [savedLandlordPercentage]);

  const handleSaveShare = async () => {
    if (!propertyId) return;
    setSavingShare(true);
    const { error } = await (supabase.from('properties') as any)
      .update({ landlord_share_percentage: landlordPercentage })
      .eq('id', propertyId);
    setSavingShare(false);
    if (error) {
      toast.error('Could not save revenue share. Please try again.');
    } else {
      toast.success('Revenue share saved');
      await refreshProperties();
    }
  };

  const getDateRange = () => {
    if (customDateRange?.from && customDateRange?.to) {
      return { 
        startDate: format(customDateRange.from, 'yyyy-MM-dd'), 
        endDate: format(customDateRange.to, 'yyyy-MM-dd') 
      };
    }
    
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
        startDate = new Date(2025, 0, 1);
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
    setCustomDateRange(undefined);
  };

  const isMonthSelected = (monthDate: Date): boolean => {
    if (!customDateRange?.from || !customDateRange?.to) return false;
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    return isSameMonth(customDateRange.from, monthStart) && 
           isSameMonth(customDateRange.to, monthEnd) &&
           customDateRange.from.getDate() === 1 &&
           customDateRange.to.getDate() === monthEnd.getDate();
  };

  const fetchAllStats = async () => {
    const { startDate, endDate } = getDateRange();
    
    // Fetch revenue stats
    const { data: revenueData } = await withPropertyFilter(supabase
      .from('reservations')
      .select('total_price, net_revenue, commission_amount, channel, source')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate), propertyId);

    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.total_price || 0), 0) || 0;
    const netRevenue = revenueData?.reduce((sum, r) => sum + ((r.total_price || 0) - (r.commission_amount || 0)), 0) || 0;
    const totalCommission = revenueData?.reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    const bookingComCommissionAmount = revenueData
      ?.filter(r => r.source?.toLowerCase().includes('booking.com'))
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;
    const directCommissionAmount = revenueData
      ?.filter(r => !r.source?.toLowerCase().includes('booking.com'))
      .reduce((sum, r) => sum + (r.commission_amount || 0), 0) || 0;

    setRevenueStats({ totalRevenue, netRevenue, totalCommission });
    setDirectCommission(directCommissionAmount);
    setBookingComCommission(bookingComCommissionAmount);
    
    // Fetch total bookings
    const { data: bookingsData, count } = await withPropertyFilter(supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate), propertyId);
      
    setTotalBookings(count || 0);
    
    // Calculate total guests
    const { data: guestsData } = await withPropertyFilter(supabase
      .from('reservations')
      .select('number_of_guests')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate), propertyId);
    
    const totalGuestsCount = guestsData?.reduce((sum, r) => sum + (r.number_of_guests || 0), 0) || 0;
    setTotalGuests(totalGuestsCount);
    
    // Calculate booking sources
    const indirectReservations = revenueData?.filter(r => 
      r.source?.toLowerCase().includes('booking.com')
    ) || [];
    const directReservations = revenueData?.filter(r => 
      !r.source?.toLowerCase().includes('booking.com')
    ) || [];
    
    const directRevenue = directReservations.reduce((sum, r) => sum + (r.total_price || 0), 0);
    const indirectRevenue = indirectReservations.reduce((sum, r) => sum + (r.total_price || 0), 0);
    
    setBookingSources({ 
      direct: { count: directReservations.length, revenue: directRevenue }, 
      indirect: { count: indirectReservations.length, revenue: indirectRevenue } 
    });
    
    // Calculate occupancy rate - filter to active property units
    const { data: units } = await withPropertyFilter(supabase
      .from('units')
      .select('id')
      .eq('status', 'available'), propertyId);
      
    const totalUnits = units?.length || 1;
    
    const { data: reservations } = await withPropertyFilter(supabase
      .from('reservations')
      .select('check_in_date, check_out_date, nights, unit_id')
      .in('status', ['confirmed', 'checked-in', 'checked-out', 'completed'])
      .is('cancelled_at', null)
      .lte('check_in_date', endDate)
      .gte('check_out_date', startDate), propertyId);
    
    const start = startOfDay(new Date(startDate));
    const end = startOfDay(new Date(endDate));
    const days = differenceInDays(end, start) + 1;
    
    const unitIdSet = new Set(units?.map(u => u.id) || []);
    let totalNights = 0;

    reservations?.forEach(r => {
      if (!r.unit_id || !unitIdSet.has(r.unit_id)) return;
      
      const checkIn = startOfDay(new Date(r.check_in_date));
      const checkOut = startOfDay(new Date(r.check_out_date));
      
      const overlapStart = checkIn > start ? checkIn : start;
      const overlapEnd = checkOut <= end ? checkOut : addDays(end, 1);
      
      if (overlapStart < overlapEnd) {
        const nightsInPeriod = differenceInDays(overlapEnd, overlapStart);
        totalNights += nightsInPeriod;
      }
    });

    setTotalNights(totalNights);

    const { count: totalBlockedNights } = await supabase
      .from('blocked_dates')
      .select('*', { count: 'exact', head: true })
      .in('unit_id', units?.map(u => u.id) || [])
      .gte('blocked_date', startDate)
      .lte('blocked_date', endDate);
    
    const totalAvailableNights = (totalUnits * days) - (totalBlockedNights || 0);
    const occupancy = totalAvailableNights > 0 ? (totalNights / totalAvailableNights) * 100 : 0;
    
    setOccupancyRate(occupancy);
    setTotalAvailableRooms(totalAvailableNights);
  };

  const fetchDirectSourceDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await withPropertyFilter(supabase
      .from('reservations')
      .select('source, total_price, commission_amount, net_revenue')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate), propertyId);

    const directData = data?.filter(r => 
      r.source?.toLowerCase() === 'direct' || 
      r.source?.toLowerCase() !== 'booking.com'
    ) || [];

    const sourceMap: Record<string, any> = {};
    
    directData.forEach((reservation) => {
      const source = reservation.source || 'Unknown';
      if (source.toLowerCase().includes('booking')) return;
      
      if (!sourceMap[source]) {
        sourceMap[source] = {
          source,
          count: 0,
          grossRevenue: 0,
          commissionRate: 10.0,
          commission: 0,
          netRevenue: 0,
        };
      }
      
      sourceMap[source].count += 1;
      sourceMap[source].grossRevenue += reservation.total_price || 0;
      sourceMap[source].commission += reservation.commission_amount || 0;
      sourceMap[source].netRevenue += (reservation.total_price || 0) - (reservation.commission_amount || 0);
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
    
    const { data: units } = await withPropertyFilter(supabase
      .from('units')
      .select('id, name, unit_number')
      .order('unit_number'), propertyId);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const details = await Promise.all(
      (units || []).map(async (unit) => {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('nights')
          .eq('unit_id', unit.id)
          .neq('status', 'Cancelled')
          .is('cancelled_at', null)
          .gte('check_in_date', startDate)
          .lte('check_in_date', endDate);

        const { count: blockedNights } = await supabase
          .from('blocked_dates')
          .select('*', { count: 'exact', head: true })
          .eq('unit_id', unit.id)
          .gte('blocked_date', startDate)
          .lte('blocked_date', endDate);

        const nightsBooked = reservations?.reduce((sum, r) => sum + (r.nights || 0), 0) || 0;
        const nightsAvailable = days - (blockedNights || 0);
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

  const formatPaymentMethod = (method: string | null): string => {
    if (!method) return '-';
    return method.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getCurrencyLabel = (currency: string | null): string => {
    switch (currency) {
      case 'USD': return 'USD';
      case 'EGP': return 'EGP';
      case 'AED': return 'AED';
      case 'SAR': return 'SAR';
      default: return currency || '-';
    }
  };

  const fetchBookingsDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await withPropertyFilter(supabase
      .from('reservations')
      .select('guest_names, check_in_date, check_out_date, nights, number_of_guests, source, payment_method, currency, units!unit_id(name)')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)
      .order('check_in_date', { ascending: false }), propertyId);

    const details = (data || []).map((r: any) => ({
      guestNames: r.guest_names.join(', '),
      unitName: r.units?.name || 'N/A',
      checkIn: format(new Date(r.check_in_date), 'MMM dd, yyyy'),
      checkOut: format(new Date(r.check_out_date), 'MMM dd, yyyy'),
      nights: r.nights || 0,
      guests: r.number_of_guests,
      source: r.source,
      paymentMethod: formatPaymentMethod(r.payment_method),
      currency: getCurrencyLabel(r.currency),
    }));

    setBookingsDetails(details);
  };

  const fetchGuestsDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await withPropertyFilter(supabase
      .from('reservations')
      .select('guest_names, number_of_guests, check_in_date, check_out_date, payment_method, currency, units!unit_id(name)')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate)
      .order('number_of_guests', { ascending: false }), propertyId);

    const details = (data || []).map((r: any) => ({
      guestNames: r.guest_names.join(', '),
      numberOfGuests: r.number_of_guests,
      unitName: r.units?.name || 'N/A',
      checkIn: format(new Date(r.check_in_date), 'MMM dd, yyyy'),
      checkOut: format(new Date(r.check_out_date), 'MMM dd, yyyy'),
      paymentMethod: formatPaymentMethod(r.payment_method),
      currency: getCurrencyLabel(r.currency),
    }));

    setGuestsDetails(details);
  };

  const fetchSourcesDetails = async () => {
    const { startDate, endDate } = getDateRange();
    
    const { data } = await withPropertyFilter(supabase
      .from('reservations')
      .select('source, total_price, commission_amount, net_revenue')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate), propertyId);

    const bookingComData = (data || []).filter(r => 
      r.source?.toLowerCase().includes('booking.com')
    );
    const directData = (data || []).filter(r => 
      !r.source?.toLowerCase().includes('booking.com')
    );

    const bookingComTotals = {
      count: bookingComData.length,
      grossRevenue: bookingComData.reduce((sum, r) => sum + (r.total_price || 0), 0),
      commission: bookingComData.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
      netRevenue: bookingComData.reduce((sum, r) => sum + (r.net_revenue || 0), 0),
    };

    const directSourceMap: Record<string, any> = {};
    directData.forEach((reservation: any) => {
      const source = reservation.source || 'Unknown';
      if (!directSourceMap[source]) {
        directSourceMap[source] = {
          source,
          count: 0,
          grossRevenue: 0,
          commission: 0,
          netRevenue: 0,
        };
      }
      directSourceMap[source].count += 1;
      directSourceMap[source].grossRevenue += reservation.total_price || 0;
      directSourceMap[source].commission += reservation.commission_amount || 0;
      directSourceMap[source].netRevenue += (reservation.total_price || 0) - (reservation.commission_amount || 0);
    });

    const directBreakdown = Object.values(directSourceMap).sort(
      (a: any, b: any) => b.grossRevenue - a.grossRevenue
    );

    const directTotals = {
      count: directData.length,
      grossRevenue: directData.reduce((sum, r) => sum + (r.total_price || 0), 0),
      commission: directData.reduce((sum, r) => sum + (r.commission_amount || 0), 0),
      netRevenue: directData.reduce((sum, r) => sum + ((r.total_price || 0) - (r.commission_amount || 0)), 0),
    };

    setSourcesData({
      bookingCom: bookingComTotals,
      direct: directTotals,
      directBreakdown,
    });
    
    setIsDirectExpanded(false);
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
    
    const { data: units } = await withPropertyFilter(supabase
      .from('units')
      .select('id, name, unit_number')
      .order('unit_number'), propertyId);

    const details = await Promise.all(
      (units || []).map(async (unit) => {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('total_price')
          .eq('unit_id', unit.id)
          .neq('status', 'Cancelled')
          .is('cancelled_at', null)
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
    
    const { data: units } = await withPropertyFilter(supabase
      .from('units')
      .select('id, name, unit_number')
      .order('unit_number'), propertyId);

    const details = await Promise.all(
      (units || []).map(async (unit) => {
        const { data: reservations } = await supabase
          .from('reservations')
          .select('total_price, commission_amount, net_revenue')
          .eq('unit_id', unit.id)
          .neq('status', 'Cancelled')
          .is('cancelled_at', null)
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
    
    const { data } = await withPropertyFilter(supabase
      .from('reservations')
      .select('source, total_price, commission_amount, commission_rate')
      .neq('status', 'Cancelled')
      .is('cancelled_at', null)
      .gte('check_in_date', startDate)
      .lte('check_in_date', endDate), propertyId);

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
        'Metric': 'Booked Nights',
        'Value': totalNights,
      },
      {
        'Metric': 'Available Room-Nights',
        'Value': totalAvailableRooms,
      },
      {},
      {
        'Metric': 'Total Bookings',
        'Value': totalBookings,
      },
      {
        'Metric': 'Total Guests',
        'Value': totalGuests,
      },
      {},
      {
        'Metric': 'Gross Revenue',
        'Value': formatCurrency(revenueStats.totalRevenue),
      },
      {
        'Metric': 'Net Revenue',
        'Value': formatCurrency(revenueStats.netRevenue),
      },
      {
        'Metric': 'Total Commission',
        'Value': formatCurrency(revenueStats.totalCommission),
      },
      {},
      {
        'Metric': 'ADR (Average Daily Rate)',
        'Value': formatCurrency(adr),
      },
      {
        'Metric': 'RevPAR (Revenue per Available Room)',
        'Value': formatCurrency(revpar),
      },
      {},
      {
        'Metric': `Landlord Share (${landlordPercentage}%)`,
        'Value': formatCurrency(revenueStats.netRevenue * (landlordPercentage / 100)),
      },
      {
        'Metric': `Suitespot Share (${100 - landlordPercentage}%)`,
        'Value': formatCurrency(revenueStats.netRevenue * ((100 - landlordPercentage) / 100)),
      },
      {},
      {
        'Metric': 'Direct Bookings',
        'Value': bookingSources.direct.count,
      },
      {
        'Metric': 'Direct Revenue',
        'Value': formatCurrency(bookingSources.direct.revenue),
      },
      {
        'Metric': 'OTA Bookings',
        'Value': bookingSources.indirect.count,
      },
      {
        'Metric': 'OTA Revenue',
        'Value': formatCurrency(bookingSources.indirect.revenue),
      },
    ];
  };

  const handleExportExcel = () => {
    const exportData = getExportData();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
    
    const dateRange = getFormattedDateRange().replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, `analytics_${dateRange}.xlsx`);
    toast.success('Analytics exported successfully');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const adr = totalNights > 0 ? (revenueStats.totalRevenue / totalNights) : 0;
  const revpar = totalAvailableRooms > 0 ? (revenueStats.totalRevenue / totalAvailableRooms) : 0;
  const { startDate, endDate } = getDateRange();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <AdminBreadcrumb section="ICONIA" currentPage="Analytics" />
          <div className="flex items-center gap-4 mb-2">
            <SlideMenu userRole={userRole} />
            <Button variant="ghost" onClick={() => navigate('/admin')} className="md:hidden" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin')} className="hidden md:flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <span className="text-sm text-muted-foreground">Back to Dashboard</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Analytics & Reporting</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Period selector */}
        <div className="flex items-center gap-4 flex-wrap">
          <Tabs value={customDateRange ? '' : timePeriod} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="week">7 Days</TabsTrigger>
              <TabsTrigger value="month">30 Days</TabsTrigger>
              <TabsTrigger value="quarter">90 Days</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2", customDateRange && "border-primary text-primary")}>
                <CalendarIcon className="h-4 w-4" />
                {customDateRange?.from ? (
                  customDateRange.to ? (
                    `${format(customDateRange.from, 'MMM d')} - ${format(customDateRange.to, 'MMM d, yyyy')}`
                  ) : (
                    format(customDateRange.from, 'MMM d, yyyy')
                  )
                ) : (
                  'Custom Range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 border-b space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Quick Select Month</p>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 6 }, (_, i) => {
                    const monthDate = addMonths(new Date(), -i);
                    const selected = isMonthSelected(monthDate);
                    return (
                      <Button
                        key={i}
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          setCustomDateRange({
                            from: startOfMonth(monthDate),
                            to: endOfMonth(monthDate),
                          });
                        }}
                      >
                        {format(monthDate, 'MMM yyyy')}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={customDateRange?.from}
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">{getFormattedDateRange()}</span>
        </div>

        {/* Revenue Share Slider */}
        <Card className="bg-gradient-to-r from-card to-card/80">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium whitespace-nowrap">Revenue Share:</span>
              <div className="flex-1 min-w-[200px] max-w-[400px]">
                <Slider
                  value={[landlordPercentage]}
                  onValueChange={(values) => setLandlordPercentage(values[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Landlord: <strong>{landlordPercentage}%</strong></span>
                <span className="text-muted-foreground">Suitespot: <strong>{100 - landlordPercentage}%</strong></span>
                <Button
                  size="sm"
                  onClick={handleSaveShare}
                  disabled={savingShare || landlordPercentage === savedLandlordPercentage}
                >
                  {savingShare ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Occupancy */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleOccupancyClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{occupancyRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {totalNights} nights / {totalAvailableRooms} available
              </p>
            </CardContent>
          </Card>

          {/* Total Bookings */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleBookingsClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalBookings}</div>
              <p className="text-xs text-muted-foreground">reservations</p>
            </CardContent>
          </Card>

          {/* Total Guests */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleGuestsClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Guests</CardTitle>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGuests}</div>
              <p className="text-xs text-muted-foreground">
                Direct: {bookingSources.direct.count} | OTA: {bookingSources.indirect.count}
              </p>
            </CardContent>
          </Card>

          {/* Booking Sources */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleSourcesClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sources</CardTitle>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatCurrency(bookingSources.direct.revenue + bookingSources.indirect.revenue)}</div>
              <p className="text-xs text-muted-foreground">
                Direct: ${formatCurrency(bookingSources.direct.revenue)} | OTA: ${formatCurrency(bookingSources.indirect.revenue)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Total Revenue */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleTotalRevenueClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatCurrency(revenueStats.totalRevenue)}</div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Landlord ({landlordPercentage}%): ${formatCurrency(revenueStats.totalRevenue * (landlordPercentage / 100))}</p>
                <p>Suitespot ({100 - landlordPercentage}%): ${formatCurrency(revenueStats.totalRevenue * ((100 - landlordPercentage) / 100))}</p>
              </div>
            </CardContent>
          </Card>

          {/* Net Revenue */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleNetRevenueClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatCurrency(revenueStats.netRevenue)}</div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>Landlord ({landlordPercentage}%): ${formatCurrency(revenueStats.netRevenue * (landlordPercentage / 100))}</p>
                <p>Suitespot ({100 - landlordPercentage}%): ${formatCurrency(revenueStats.netRevenue * ((100 - landlordPercentage) / 100))}</p>
              </div>
            </CardContent>
          </Card>

          {/* Commission */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleCommissionClick}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission</CardTitle>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatCurrency(revenueStats.totalCommission)}</div>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); handleDirectClick(); }}>
                  Direct: ${formatCurrency(directCommission)}
                </p>
                <p>Booking.com: ${formatCurrency(bookingComCommission)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ADR & RevPAR */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">ADR (Average Daily Rate)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatCurrency(adr)}</div>
              <p className="text-xs text-muted-foreground">Per occupied room night</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">RevPAR</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${formatCurrency(revpar)}</div>
              <p className="text-xs text-muted-foreground">Revenue per available room</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <RevenueBySource mainDateRange={{ from: new Date(startDate), to: new Date(endDate) }} />
          <RevenueByRoom mainDateRange={{ from: new Date(startDate), to: new Date(endDate) }} />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <RevenueByGuests mainDateRange={{ from: new Date(startDate), to: new Date(endDate) }} />
          <RevenueByNationality mainDateRange={{ from: new Date(startDate), to: new Date(endDate) }} />
        </div>

        {/* Cancellation Analytics */}
        <CancellationAnalytics startDate={startDate} endDate={endDate} />

        {/* Dialogs */}
        {/* Occupancy Dialog */}
        <Dialog open={showOccupancyDialog} onOpenChange={setShowOccupancyDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Occupancy by Room</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Unit #</TableHead>
                  <TableHead className="text-right">Nights Booked</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupancyDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.unitName}</TableCell>
                    <TableCell>{d.unitNumber}</TableCell>
                    <TableCell className="text-right">{d.nightsBooked}</TableCell>
                    <TableCell className="text-right">{d.nightsAvailable}</TableCell>
                    <TableCell className="text-right font-medium">{d.occupancyRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Bookings Dialog */}
        <Dialog open={showBookingsDialog} onOpenChange={setShowBookingsDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Nights</TableHead>
                  <TableHead>Guests</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookingsDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.guestNames}</TableCell>
                    <TableCell>{d.unitName}</TableCell>
                    <TableCell>{d.checkIn}</TableCell>
                    <TableCell>{d.checkOut}</TableCell>
                    <TableCell>{d.nights}</TableCell>
                    <TableCell>{d.guests}</TableCell>
                    <TableCell>{d.source}</TableCell>
                    <TableCell>{d.paymentMethod}</TableCell>
                    <TableCell>{d.currency}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Guests Dialog */}
        <Dialog open={showGuestsDialog} onOpenChange={setShowGuestsDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Guest Details</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead># Guests</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Currency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guestsDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.guestNames}</TableCell>
                    <TableCell>{d.numberOfGuests}</TableCell>
                    <TableCell>{d.unitName}</TableCell>
                    <TableCell>{d.checkIn}</TableCell>
                    <TableCell>{d.checkOut}</TableCell>
                    <TableCell>{d.paymentMethod}</TableCell>
                    <TableCell>{d.currency}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Sources Dialog */}
        <Dialog open={showSourcesDialog} onOpenChange={setShowSourcesDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Revenue by Source</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Booking.com */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-2">Booking.com (OTA)</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Bookings</p>
                    <p className="font-bold">{sourcesData.bookingCom.count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gross Revenue</p>
                    <p className="font-bold">${formatCurrency(sourcesData.bookingCom.grossRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Commission</p>
                    <p className="font-bold text-red-500">${formatCurrency(sourcesData.bookingCom.commission)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net Revenue</p>
                    <p className="font-bold text-green-600">${formatCurrency(sourcesData.bookingCom.netRevenue)}</p>
                  </div>
                </div>
              </div>

              {/* Direct */}
              <div className="border rounded-lg p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setIsDirectExpanded(!isDirectExpanded)}
                >
                  <h4 className="font-semibold text-sm">Direct (All Other Sources)</h4>
                  {isDirectExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm mt-2">
                  <div>
                    <p className="text-muted-foreground">Bookings</p>
                    <p className="font-bold">{sourcesData.direct.count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gross Revenue</p>
                    <p className="font-bold">${formatCurrency(sourcesData.direct.grossRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Commission</p>
                    <p className="font-bold text-red-500">${formatCurrency(sourcesData.direct.commission)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Net Revenue</p>
                    <p className="font-bold text-green-600">${formatCurrency(sourcesData.direct.netRevenue)}</p>
                  </div>
                </div>

                {isDirectExpanded && sourcesData.directBreakdown.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Gross</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                          <TableHead className="text-right">Net</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sourcesData.directBreakdown.map((s: any, i) => (
                          <TableRow key={i}>
                            <TableCell>{s.source}</TableCell>
                            <TableCell className="text-right">{s.count}</TableCell>
                            <TableCell className="text-right">${formatCurrency(s.grossRevenue)}</TableCell>
                            <TableCell className="text-right text-red-500">${formatCurrency(s.commission)}</TableCell>
                            <TableCell className="text-right text-green-600">${formatCurrency(s.netRevenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Total Revenue Dialog */}
        <Dialog open={showTotalRevenueDialog} onOpenChange={setShowTotalRevenueDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gross Revenue by Room</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Unit #</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Landlord ({landlordPercentage}%)</TableHead>
                  <TableHead className="text-right">Suitespot ({100 - landlordPercentage}%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totalRevenueDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.unitName}</TableCell>
                    <TableCell>{d.unitNumber}</TableCell>
                    <TableCell className="text-right">{d.bookings}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.grossRevenue)}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.landlordShare)}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.suitespotShare)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Net Revenue Dialog */}
        <Dialog open={showNetRevenueDialog} onOpenChange={setShowNetRevenueDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Net Revenue by Room</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room</TableHead>
                  <TableHead>Unit #</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net Revenue</TableHead>
                  <TableHead className="text-right">Landlord ({landlordPercentage}%)</TableHead>
                  <TableHead className="text-right">Suitespot ({100 - landlordPercentage}%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {netRevenueDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.unitName}</TableCell>
                    <TableCell>{d.unitNumber}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.grossRevenue)}</TableCell>
                    <TableCell className="text-right text-red-500">${formatCurrency(d.commission)}</TableCell>
                    <TableCell className="text-right font-medium">${formatCurrency(d.netRevenue)}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.landlordShare)}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.suitespotShare)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Commission Dialog */}
        <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Commission Breakdown</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.source}</TableCell>
                    <TableCell className="text-right">{d.bookings}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.grossRevenue)}</TableCell>
                    <TableCell className="text-right">{d.commissionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-medium">${formatCurrency(d.commissionAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>

        {/* Direct Source Details Dialog */}
        <Dialog open={showDirectDialog} onOpenChange={setShowDirectDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Direct Commission Breakdown</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {directSourceDetails.map((d, i) => (
                  <TableRow key={i}>
                    <TableCell>{d.source}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.grossRevenue)}</TableCell>
                    <TableCell className="text-right">{d.commissionRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">${formatCurrency(d.commission)}</TableCell>
                    <TableCell className="text-right text-green-600">${formatCurrency(d.netRevenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Analytics;

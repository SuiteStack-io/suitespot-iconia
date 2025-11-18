import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, LogIn, LogOut, TrendingUp, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ConflictAlert } from './ConflictAlert';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  todayArrivals: number;
  todayDepartures: number;
  inHouse: number;
  newBookings: number;
  totalRevenue: number;
  netRevenue: number;
  totalCommission: number;
}

interface Reservation {
  id: string;
  booking_reference: string;
  guest_names: string[];
  guest_types: string[] | null;
  guest_genders: string[] | null;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number;
  number_of_guests: number;
  children: number | null;
  adults: number | null;
  units: { name: string } | null;
}

const statusColors = {
  Upcoming: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  'In-House': 'bg-green-100 text-green-800 hover:bg-green-100',
  'Checked-Out': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  Cancelled: 'bg-red-100 text-red-800 hover:bg-red-100',
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    todayArrivals: 0,
    todayDepartures: 0,
    inHouse: 0,
    newBookings: 0,
    totalRevenue: 0,
    netRevenue: 0,
    totalCommission: 0,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogReservations, setDialogReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    fetchStats();
    
    // Real-time updates for reservations
    const reservationsChannel = supabase
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

    // Real-time updates for units
    const unitsChannel = supabase
      .channel('units-changes-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'units',
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(unitsChannel);
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

  const handleCardClick = async (cardType: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
    
    let query = supabase
      .from('reservations')
      .select('id, booking_reference, guest_names, guest_types, guest_genders, check_in_date, check_out_date, status, total_price, number_of_guests, children, adults, units(name)');
    
    switch (cardType) {
      case 'arrivals':
        setDialogTitle("Today's Arrivals");
        query = query.eq('check_in_date', today).neq('status', 'Cancelled');
        break;
      case 'departures':
        setDialogTitle("Today's Departures");
        query = query.eq('check_out_date', today).neq('status', 'Cancelled');
        break;
      case 'inhouse':
        setDialogTitle('In-House Now');
        query = query.eq('status', 'In-House');
        break;
      case 'newbookings':
        setDialogTitle('New Bookings (Last 24h)');
        query = query.gte('created_at', yesterday);
        break;
    }
    
    const { data } = await query.order('check_in_date', { ascending: true });
    setDialogReservations((data as any) || []);
    setDialogOpen(true);
  };

  const statCards = [
    {
      title: "Today's Arrivals",
      value: stats.todayArrivals,
      icon: LogIn,
      color: 'text-blue-600',
      isRevenue: false,
      type: 'arrivals',
    },
    {
      title: "Today's Departures",
      value: stats.todayDepartures,
      icon: LogOut,
      color: 'text-orange-600',
      isRevenue: false,
      type: 'departures',
    },
    {
      title: 'In-House Now',
      value: stats.inHouse,
      icon: Calendar,
      color: 'text-green-600',
      isRevenue: false,
      type: 'inhouse',
    },
    {
      title: 'New Bookings (24h)',
      value: stats.newBookings,
      icon: TrendingUp,
      color: 'text-purple-600',
      isRevenue: false,
      type: 'newbookings',
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleCardClick(stat.type)}
            >
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

      {/* Conflict Alert */}
      <div className="mt-6">
        <ConflictAlert />
      </div>

      {/* Availability Calendar */}
      <div className="mt-6">
        <AvailabilityCalendar />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {dialogReservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No reservations found</p>
            ) : (
              dialogReservations.map((reservation) => (
                <Card 
                  key={reservation.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    setDialogOpen(false);
                    navigate(`/reservation/${reservation.id}`);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{reservation.booking_reference}</p>
                          <Badge 
                            variant="outline" 
                            className={statusColors[reservation.status as keyof typeof statusColors]}
                          >
                            {reservation.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {reservation.guest_names.map((name, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <p className="text-sm text-muted-foreground">{name}</p>
                              {reservation.guest_types && reservation.guest_types[idx] && (
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {reservation.guest_types[idx]}
                                </Badge>
                              )}
                              {reservation.guest_genders && reservation.guest_genders[idx] && (
                                <Badge variant="outline" className="text-xs">
                                  {reservation.guest_genders[idx]}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span>{reservation.number_of_guests} {reservation.number_of_guests === 1 ? 'guest' : 'guests'}</span>
                          {reservation.children !== null && reservation.children > 0 && (
                            <>
                              <span>•</span>
                              <span>{reservation.children} {reservation.children === 1 ? 'child' : 'children'}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm">
                          {reservation.units?.name || 'No unit assigned'}
                        </p>
                      </div>
                      <div className="text-sm space-y-1">
                        <p>Check-in: {format(new Date(reservation.check_in_date), 'MMM dd, yyyy')}</p>
                        <p>Check-out: {format(new Date(reservation.check_out_date), 'MMM dd, yyyy')}</p>
                        <p className="font-semibold">${reservation.total_price.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
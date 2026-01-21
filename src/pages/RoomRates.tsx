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
import { Loader2, Building2 } from 'lucide-react';

interface Unit {
  id: string;
  name: string;
  unit_number: string | null;
  booking_com_name: string | null;
  unit_size: string | null;
  view: string | null;
  price_per_night: number | null;
  weekend_rate: number | null;
}

interface GroupedUnits {
  [roomType: string]: Unit[];
}

const RoomRates = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name, unit_number, booking_com_name, unit_size, view, price_per_night, weekend_rate')
        .eq('location', 'ICONIA')
        .order('booking_com_name')
        .order('unit_number');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate weekend rate if not set (10% higher, rounded to nearest $5)
  const getWeekendRate = (weekdayRate: number | null, weekendRate: number | null): number | null => {
    if (weekendRate !== null) return weekendRate;
    if (weekdayRate === null) return null;
    const calculated = weekdayRate * 1.1;
    return Math.ceil(calculated / 5) * 5;
  };

  // Format currency
  const formatCurrency = (amount: number | null): string => {
    if (amount === null) return '—';
    return `$${amount.toLocaleString()}`;
  };

  // Group units by booking_com_name (room type)
  const groupedUnits: GroupedUnits = units.reduce((acc, unit) => {
    const roomType = unit.booking_com_name || 'Other';
    if (!acc[roomType]) {
      acc[roomType] = [];
    }
    acc[roomType].push(unit);
    return acc;
  }, {} as GroupedUnits);

  // Sort room types alphabetically
  const sortedRoomTypes = Object.keys(groupedUnits).sort();

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
        </div>
        <div className="px-4 pb-3">
          <AdminBreadcrumb section="ICONIA" currentPage="Room Rates" />
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Room Type</TableHead>
                <TableHead className="font-semibold">Room Size</TableHead>
                <TableHead className="font-semibold">View</TableHead>
                <TableHead className="font-semibold text-right">Weekday Rate</TableHead>
                <TableHead className="font-semibold text-right">Weekend Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRoomTypes.map((roomType) => {
                const roomUnits = groupedUnits[roomType];
                return (
                  <React.Fragment key={roomType}>
                    {/* Group Header */}
                    <TableRow className="bg-muted/30 hover:bg-muted/40">
                      <TableCell colSpan={5} className="py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-foreground">
                            {roomType}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            ({roomUnits.length})
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Room Rows */}
                    {roomUnits.map((unit) => (
                      <TableRow key={unit.id} className="hover:bg-muted/20">
                        <TableCell className="pl-10">
                          <span className="text-foreground">
                            {unit.name}
                            {unit.unit_number && (
                              <span className="text-muted-foreground ml-1">
                                #{unit.unit_number}
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {unit.unit_size || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {unit.view || '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(unit.price_per_night)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(getWeekendRate(unit.price_per_night, unit.weekend_rate))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })}
              
              {units.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No rooms found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default RoomRates;

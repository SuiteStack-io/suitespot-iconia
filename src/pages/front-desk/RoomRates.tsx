import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Maximize2, DollarSign, ImageIcon } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface RoomTypeData {
  name: string;
  area: string | null;
  maxGuests: number | null;
  features: string[];
  photos: string[];
  weekdayRate: number | null;
  weekendRate: number | null;
  currency: string;
  ratePlanName: string | null;
  channelRates: Array<{ channel: string; weekday: number; weekend: number; markup: number }>;
}

export default function FrontDeskRoomRates() {
  const { userRole } = useAuth();

  const { data: roomTypes, isLoading } = useQuery({
    queryKey: ['front-desk-room-rates'],
    queryFn: async () => {
      // Fetch units, rate plans, and channel markups
      const [unitsRes, rpRes, markupsRes] = await Promise.all([
        supabase
          .from('units')
          .select('booking_com_name, unit_size, max_guests, features, photos')
          .eq('location', 'ICONIA')
          .not('booking_com_name', 'is', null),
        supabase
          .from('rate_plans')
          .select('id, name, is_default, currency, room_type, rate_plan_prices(room_type, weekday_rate, weekend_rate, unit_id)')
          .eq('is_active', true)
          .order('priority', { ascending: false }),
        supabase
          .from('channel_markup_settings')
          .select('channel_name, markup_percentage')
          .eq('is_active', true),
      ]);

      const { data: units, error: unitsError } = unitsRes;
      if (unitsError) throw unitsError;

      const { data: ratePlans, error: rpError } = rpRes;
      if (rpError) throw rpError;

      const channelMarkups = (markupsRes.data as any[]) || [];

      // Group units by booking_com_name
      const grouped = new Map<string, { area: string | null; maxGuests: number | null; features: string[]; photos: string[] }>();

      for (const unit of units || []) {
        const name = unit.booking_com_name!;
        if (!grouped.has(name)) {
          grouped.set(name, {
            area: unit.unit_size,
            maxGuests: unit.max_guests,
            features: (unit.features as string[]) || [],
            photos: (unit.photos as string[]) || [],
          });
        } else {
          const existing = grouped.get(name)!;
          if (unit.max_guests && (!existing.maxGuests || unit.max_guests > existing.maxGuests)) {
            existing.maxGuests = unit.max_guests;
          }
          const unitPhotos = (unit.photos as string[]) || [];
          if (unitPhotos.length > existing.photos.length) {
            existing.photos = unitPhotos;
          }
          const unitFeatures = (unit.features as string[]) || [];
          if (unitFeatures.length > existing.features.length) {
            existing.features = unitFeatures;
          }
        }
      }

      // Build room type data with rates
      const result: RoomTypeData[] = [];

      for (const [name, data] of grouped) {
        let weekdayRate: number | null = null;
        let weekendRate: number | null = null;
        let currency = 'USD';
        let ratePlanName: string | null = null;

        // Find best matching rate plan: prefer default, then highest priority
        for (const rp of ratePlans || []) {
          const prices = rp.rate_plan_prices || [];
          // Find type-level price (no unit_id) matching this room type
          const match = prices.find(
            (p: any) => p.room_type === name && !p.unit_id
          );
          if (match) {
            weekdayRate = match.weekday_rate;
            weekendRate = match.weekend_rate;
            currency = rp.currency || 'USD';
            ratePlanName = rp.name;
            if (rp.is_default) break; // default wins
          }
        }

        // Build channel rates from markups
        const channelRates = weekdayRate != null
          ? channelMarkups.map((cm: any) => ({
              channel: cm.channel_name,
              weekday: Math.round(weekdayRate! * (1 + cm.markup_percentage / 100)),
              weekend: Math.round((weekendRate || weekdayRate!) * (1 + cm.markup_percentage / 100)),
              markup: cm.markup_percentage,
            }))
          : [];

        result.push({
          name,
          area: data.area,
          maxGuests: data.maxGuests,
          features: data.features,
          photos: data.photos,
          weekdayRate,
          weekendRate,
          currency,
          ratePlanName,
          channelRates,
        });
      }

      return result.sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const formatCurrency = (amount: number, currency: string) => {
    return currency === 'USD' ? `$${amount}` : `${amount} ${currency}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <SlideMenu userRole={userRole} />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Room Rates</h1>
          <p className="text-sm text-muted-foreground">
            Current rates and room information — updated automatically
          </p>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-40 w-full rounded-md" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !roomTypes?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            No room types found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roomTypes.map((room) => (
              <Card key={room.name} className="overflow-hidden">
                {/* Photo */}
                <AspectRatio ratio={16 / 10}>
                  {room.photos?.length > 0 ? (
                    <img
                      src={room.photos[0]}
                      alt={room.name}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                    </div>
                  )}
                </AspectRatio>

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{room.name}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Rates */}
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    {room.weekdayRate != null ? (
                      <div className="text-sm">
                        <span className="font-semibold">
                          {formatCurrency(room.weekdayRate, room.currency)}
                        </span>
                        <span className="text-muted-foreground"> weekday</span>
                        {room.weekendRate != null && room.weekendRate !== room.weekdayRate && (
                          <>
                            <span className="mx-1 text-muted-foreground">/</span>
                            <span className="font-semibold">
                              {formatCurrency(room.weekendRate, room.currency)}
                            </span>
                            <span className="text-muted-foreground"> weekend</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No rate configured</span>
                    )}
                  </div>

                  {/* Channel sell rates */}
                  {room.channelRates?.length > 0 && (
                    <div className="space-y-0.5">
                      {room.channelRates.map(cr => (
                        <div key={cr.channel} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>→ {cr.channel}:</span>
                          <span className="font-medium">
                            {formatCurrency(cr.weekday, room.currency)}
                            {cr.weekend !== cr.weekday && ` / ${formatCurrency(cr.weekend, room.currency)}`}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">+{cr.markup}%</Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Area & Occupancy */}
                  <div className="flex flex-wrap gap-4 text-sm">
                    {room.area && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Maximize2 className="h-4 w-4" />
                        <span>{room.area.includes('m') ? room.area : `${room.area} m²`}</span>
                      </div>
                    )}
                    {room.maxGuests && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Up to {room.maxGuests} guests</span>
                      </div>
                    )}
                  </div>

                  {/* Amenities */}
                  {room.features?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {room.features.map((f) => (
                        <Badge key={f} variant="secondary" className="text-xs font-normal">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No amenities listed</p>
                  )}

                  {/* Rate plan name */}
                  {room.ratePlanName && (
                    <p className="text-xs text-muted-foreground">
                      Rate plan: {room.ratePlanName}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

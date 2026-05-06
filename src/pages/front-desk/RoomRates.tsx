import { useState, useEffect, useCallback } from 'react';
import SuiteLightbox from '@/components/SuiteLightbox';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SlideMenu } from '@/components/SlideMenu';
import { useAuth } from '@/lib/auth';
import { usePropertyId, withPropertyFilter } from '@/hooks/usePropertyFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Maximize2, DollarSign, ImageIcon } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuickRateGrid } from '@/components/pms/QuickRateGrid';
import { RatesCalendarView } from '@/components/pms/RatesCalendarView';

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

function RoomPhotoCard({ photos, name }: { photos: string[]; name: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <>
      <div
        className="relative w-full h-full cursor-pointer group"
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={photos[0]}
          alt={`${name} cover`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        {photos.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            1/{photos.length}
          </div>
        )}
      </div>
      <SuiteLightbox
        photos={photos}
        initialIndex={0}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}

export default function FrontDeskRoomRates() {
  const { userRole, hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole && userRole !== 'admin' && !hasPermission('can_access_front_desk')) {
      navigate('/admin');
    }
  }, [userRole, hasPermission, navigate]);

  const propertyId = usePropertyId();

  const { data: roomTypes, isLoading } = useQuery({
    queryKey: ['front-desk-room-rates', propertyId],
    queryFn: async () => {
      const [unitsRes, rpRes, markupsRes, rtPhotosRes] = await Promise.all([
        withPropertyFilter(
          supabase
            .from('units')
            .select('booking_com_name, unit_size, max_guests, features, photos')
            .not('booking_com_name', 'is', null),
          propertyId
        ),
        withPropertyFilter(
          supabase
            .from('rate_plans')
            .select('id, name, is_default, currency, room_type, rate_plan_prices(room_type, weekday_rate, weekend_rate, unit_id)')
            .eq('is_active', true)
            .order('priority', { ascending: false }),
          propertyId
        ),
        withPropertyFilter(
          supabase
            .from('channel_markup_settings')
            .select('channel_name, markup_percentage')
            .eq('is_active', true),
          propertyId
        ),
        propertyId
          ? supabase
              .from('room_type_photos')
              .select('room_type_name, photo_url, display_order, is_cover')
              .eq('property_id', propertyId)
              .order('display_order')
          : Promise.resolve({ data: [], error: null }),
      ]);

      const { data: units, error: unitsError } = unitsRes;
      if (unitsError) throw unitsError;

      const { data: ratePlans, error: rpError } = rpRes;
      if (rpError) throw rpError;

      const channelMarkups = (markupsRes.data as any[]) || [];
      const rtPhotos = (rtPhotosRes.data as any[]) || [];

      // Group room_type_photos by room_type_name, cover first
      const photosByType = new Map<string, string[]>();
      for (const p of rtPhotos) {
        if (!photosByType.has(p.room_type_name)) {
          photosByType.set(p.room_type_name, []);
        }
        const arr = photosByType.get(p.room_type_name)!;
        if (p.is_cover) {
          arr.unshift(p.photo_url);
        } else {
          arr.push(p.photo_url);
        }
      }

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

        for (const rp of ratePlans || []) {
          const prices = rp.rate_plan_prices || [];
          const match = prices.find(
            (p: any) => p.room_type === name && !p.unit_id
          );
          if (match) {
            weekdayRate = match.weekday_rate;
            weekendRate = match.weekend_rate;
            currency = rp.currency || 'USD';
            ratePlanName = rp.name;
            if (rp.is_default) break;
          }
        }

        const channelRates = weekdayRate != null
          ? channelMarkups.map((cm: any) => ({
              channel: cm.channel_name,
              weekday: Math.round(weekdayRate! * (1 + cm.markup_percentage / 100)),
              weekend: Math.round((weekendRate || weekdayRate!) * (1 + cm.markup_percentage / 100)),
              markup: cm.markup_percentage,
            }))
          : [];

        // Resolve photos: room_type_photos > legacy unit photos
        const resolvedPhotos = photosByType.get(name) || data.photos;

        result.push({
          name,
          area: data.area,
          maxGuests: data.maxGuests,
          features: data.features,
          photos: resolvedPhotos,
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
        <Tabs defaultValue="room-cards">
          <TabsList className="mb-4">
            <TabsTrigger value="room-cards">Room Cards</TabsTrigger>
            <TabsTrigger value="rate-calendar">Rates List View</TabsTrigger>
            <TabsTrigger value="rates-calendar-view">Rates Calendar View</TabsTrigger>
          </TabsList>

          <TabsContent value="room-cards">
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
                    <AspectRatio ratio={16 / 10}>
                      <RoomPhotoCard photos={room.photos} name={room.name} />
                    </AspectRatio>

                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{room.name}</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
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
          </TabsContent>

          <TabsContent value="rate-calendar">
            <QuickRateGrid readOnly />
          </TabsContent>

          <TabsContent value="rates-calendar-view">
            <RatesCalendarView readOnly />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

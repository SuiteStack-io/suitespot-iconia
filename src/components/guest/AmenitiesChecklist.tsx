import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Amenity {
  id: string;
  name: string;
  category: string;
  location: string;
  is_available: boolean;
  notes: string | null;
}

interface AmenitiesChecklistProps {
  unitId: string;
}

export function AmenitiesChecklist({ unitId }: AmenitiesChecklistProps) {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAmenities = async () => {
      const { data, error } = await supabase
        .from("property_amenities")
        .select("*")
        .eq("unit_id", unitId)
        .order("category", { ascending: true });

      if (error) {
        console.error("Error fetching amenities:", error);
      } else {
        setAmenities(data || []);
      }
      setLoading(false);
    };

    fetchAmenities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("amenities-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "property_amenities",
          filter: `unit_id=eq.${unitId}`,
        },
        () => {
          fetchAmenities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId]);

  const groupedAmenities = amenities.reduce((acc, amenity) => {
    if (!acc[amenity.category]) {
      acc[amenity.category] = [];
    }
    acc[amenity.category].push(amenity);
    return acc;
  }, {} as Record<string, Amenity[]>);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Property Amenities</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {Object.entries(groupedAmenities).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                  {category}
                </h3>
                <div className="space-y-2">
                  {items.map((amenity) => (
                    <div
                      key={amenity.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {amenity.name}
                          </span>
                          {amenity.is_available ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {amenity.location}
                        </div>
                        {amenity.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {amenity.notes}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={amenity.is_available ? "default" : "secondary"}
                        className="ml-2"
                      >
                        {amenity.is_available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

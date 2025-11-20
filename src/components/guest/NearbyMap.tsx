import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Map as MapIcon } from "lucide-react";

interface NearbyMapProps {
  unitId: string;
}

interface Amenity {
  id: string;
  name: string;
  type: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  website: string | null;
}

const NearbyMap = ({ unitId }: NearbyMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [unitLocation, setUnitLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    fetchData();
  }, [unitId]);

  const fetchData = async () => {
    try {
      const [amenitiesRes, unitRes] = await Promise.all([
        supabase.from("nearby_amenities").select("*").eq("unit_id", unitId),
        supabase.from("units").select("latitude, longitude").eq("id", unitId).single(),
      ]);

      if (amenitiesRes.data) setAmenities(amenitiesRes.data);
      if (unitRes.data?.latitude && unitRes.data?.longitude) {
        setUnitLocation({ lat: unitRes.data.latitude, lng: unitRes.data.longitude });
      }
    } catch (error) {
      console.error("Error fetching map data:", error);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || !unitLocation) return;

    const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (!mapboxToken) {
      console.error("Mapbox token not found");
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [unitLocation.lng, unitLocation.lat],
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Add property marker
    new mapboxgl.Marker({ color: "#FF0000" })
      .setLngLat([unitLocation.lng, unitLocation.lat])
      .setPopup(new mapboxgl.Popup().setHTML("<h3>Your Property</h3>"))
      .addTo(map.current);

    // Add amenity markers
    amenities.forEach((amenity) => {
      if (amenity.latitude && amenity.longitude) {
        const color = getMarkerColor(amenity.type);
        const popup = new mapboxgl.Popup().setHTML(`
          <div class="p-2">
            <h3 class="font-bold">${amenity.name}</h3>
            <p class="text-sm text-gray-600">${amenity.type}</p>
            <p class="text-sm mt-1">${amenity.description}</p>
            ${amenity.phone ? `<p class="text-sm mt-1">📞 ${amenity.phone}</p>` : ""}
            ${amenity.website ? `<a href="${amenity.website}" target="_blank" class="text-sm text-blue-600">Visit website</a>` : ""}
          </div>
        `);

        new mapboxgl.Marker({ color })
          .setLngLat([amenity.longitude, amenity.latitude])
          .setPopup(popup)
          .addTo(map.current!);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [unitLocation, amenities]);

  const getMarkerColor = (type: string) => {
    const colors: Record<string, string> = {
      restaurant: "#FFA500",
      cafe: "#8B4513",
      grocery: "#32CD32",
      pharmacy: "#00CED1",
      attraction: "#9370DB",
    };
    return colors[type] || "#808080";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapIcon className="h-5 w-5" />
          Nearby Places
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="h-[400px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
};

export default NearbyMap;

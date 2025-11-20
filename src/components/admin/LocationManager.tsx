import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Save } from "lucide-react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

interface LocationManagerProps {
  unitId: string;
  unitName: string;
}

const LocationManager = ({ unitId, unitName }: LocationManagerProps) => {
  const [unit, setUnit] = useState<any>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapDescription, setMapDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUnitLocation();
  }, [unitId]);

  const fetchUnitLocation = async () => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("latitude, longitude, map_description, address")
        .eq("id", unitId)
        .single();

      if (error) throw error;
      
      if (data) {
        setUnit(data);
        setLatitude(data.latitude?.toString() || "");
        setLongitude(data.longitude?.toString() || "");
        setMapDescription(data.map_description || "");
      }
    } catch (error) {
      console.error("Error fetching location:", error);
    }
  };

  const handleSaveLocation = async () => {
    if (!latitude || !longitude) {
      toast.error("Please enter both latitude and longitude");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("units")
        .update({
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          map_description: mapDescription,
        })
        .eq("id", unitId);

      if (error) throw error;

      toast.success("Location updated successfully");
      fetchUnitLocation();
    } catch (error: any) {
      console.error("Error updating location:", error);
      toast.error(error.message || "Failed to update location");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setLatitude(e.latLng.lat().toString());
      setLongitude(e.latLng.lng().toString());
    }
  };

  const center = {
    lat: parseFloat(latitude) || 30.0444,
    lng: parseFloat(longitude) || 31.2357,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Manage Location - {unitName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="30.0444"
            />
          </div>
          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="31.2357"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="mapDescription">Map Description</Label>
          <Textarea
            id="mapDescription"
            value={mapDescription}
            onChange={(e) => setMapDescription(e.target.value)}
            placeholder="Brief description of the property location..."
            rows={2}
          />
        </div>

        <div className="h-[400px] rounded-lg overflow-hidden">
          <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}>
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={center}
              zoom={15}
              onClick={handleMapClick}
              options={{
                streetViewControl: true,
                mapTypeControl: true,
              }}
            >
              {latitude && longitude && (
                <Marker
                  position={{
                    lat: parseFloat(latitude),
                    lng: parseFloat(longitude),
                  }}
                  draggable
                  onDragEnd={(e) => {
                    if (e.latLng) {
                      setLatitude(e.latLng.lat().toString());
                      setLongitude(e.latLng.lng().toString());
                    }
                  }}
                />
              )}
            </GoogleMap>
          </LoadScript>
        </div>

        <p className="text-sm text-muted-foreground">
          Click on the map or drag the marker to set the location
        </p>

        <Button onClick={handleSaveLocation} disabled={loading} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Saving..." : "Save Location"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LocationManager;

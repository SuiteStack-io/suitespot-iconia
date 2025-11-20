import { useState, useCallback } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow } from "@react-google-maps/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Phone, Mail } from "lucide-react";

interface Property {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  unit_number: string;
  beds: number;
  baths: number;
  price_per_night: number;
  photos: string[];
}

interface InteractivePropertyMapProps {
  properties: Property[];
  onPropertySelect?: (property: Property) => void;
  selectedPropertyId?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const InteractivePropertyMap = ({
  properties,
  onPropertySelect,
  selectedPropertyId,
  center = { lat: 30.0444, lng: 31.2357 }, // Cairo default
  zoom = 12,
}: InteractivePropertyMapProps) => {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const mapContainerStyle = {
    width: "100%",
    height: "100%",
    minHeight: "500px",
    borderRadius: "0.5rem",
  };

  const handleMarkerClick = useCallback((property: Property) => {
    setSelectedProperty(property);
    onPropertySelect?.(property);
  }, [onPropertySelect]);

  const handleDirections = (property: Property) => {
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`;
    window.open(directionsUrl, "_blank");
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Property Locations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[500px]">
          <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={zoom}
              options={{
                streetViewControl: true,
                mapTypeControl: true,
                fullscreenControl: true,
                zoomControl: true,
              }}
            >
              {properties
                .filter(p => p.latitude && p.longitude)
                .map((property) => (
                  <Marker
                    key={property.id}
                    position={{ lat: property.latitude, lng: property.longitude }}
                    onClick={() => handleMarkerClick(property)}
                    icon={{
                      url: selectedPropertyId === property.id
                        ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
                        : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                    }}
                  />
                ))}

              {selectedProperty && (
                <InfoWindow
                  position={{
                    lat: selectedProperty.latitude,
                    lng: selectedProperty.longitude,
                  }}
                  onCloseClick={() => setSelectedProperty(null)}
                >
                  <div className="p-3 max-w-xs">
                    {selectedProperty.photos?.[0] && (
                      <img
                        src={selectedProperty.photos[0]}
                        alt={selectedProperty.name}
                        className="w-full h-32 object-cover rounded-md mb-2"
                      />
                    )}
                    <h3 className="font-bold text-lg mb-1">{selectedProperty.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedProperty.address}
                    </p>
                    <div className="flex gap-4 text-sm mb-2">
                      <span>{selectedProperty.beds} Beds</span>
                      <span>{selectedProperty.baths} Baths</span>
                    </div>
                    <p className="text-lg font-semibold text-primary mb-3">
                      ${selectedProperty.price_per_night}/night
                    </p>
                    <Button
                      onClick={() => handleDirections(selectedProperty)}
                      size="sm"
                      className="w-full"
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Get Directions
                    </Button>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractivePropertyMap;

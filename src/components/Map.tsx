import React from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';

const Map = () => {
  const [showInfo, setShowInfo] = useState(false);
  
  const center = {
    lat: 30.0664,
    lng: 31.2186
  };

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '0.5rem'
  };

  const mapOptions = {
    zoom: 16,
    center: center,
    streetViewControl: true,
    mapTypeControl: true,
    fullscreenControl: true,
  };

  const handleGetDirections = () => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${center.lat},${center.lng}`, '_blank');
  };

  return (
    <div className="relative w-full h-full flex flex-col gap-4">
      <div className="flex-1 min-h-[400px]">
        <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={16}
            options={mapOptions}
          >
            <Marker 
              position={center}
              onClick={() => setShowInfo(true)}
            />
            
            {showInfo && (
              <InfoWindow
                position={center}
                onCloseClick={() => setShowInfo(false)}
              >
                <div className="p-2">
                  <h3 className="font-bold mb-1">ICONIA Zamalek</h3>
                  <p className="text-sm">16 Mohammed Thakeb St, Zamalek<br />Cairo, Egypt</p>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>
      
      <Button 
        onClick={handleGetDirections}
        className="w-full"
        size="lg"
      >
        <Navigation className="mr-2 h-5 w-5" />
        Get Directions
      </Button>
    </div>
  );
};

export default Map;

import React from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';

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

  return (
    <div className="relative w-full h-full">
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
  );
};

export default Map;

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [31.218, 30.069], // Zamalek coordinates [longitude, latitude]
      zoom: 15,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add marker at the exact location
    new mapboxgl.Marker({ color: '#DC2626' })
      .setLngLat([31.218, 30.069])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 })
          .setHTML(
            '<div style="padding: 8px;"><h3 style="font-weight: bold; margin-bottom: 4px;">ICONIA Zamalek</h3><p style="margin: 0; font-size: 14px;">16 Mohammed Thakeb St, Zamalek<br>Cairo, Egypt</p></div>'
          )
      )
      .addTo(map.current);

    // Disable scroll zoom (users can use ctrl/cmd + scroll or zoom controls)
    map.current.scrollZoom.disable();

    // Handle loading state
    map.current.on('load', () => {
      setLoading(false);
    });

    // Cleanup
    return () => {
      map.current?.remove();
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background rounded-lg border border-border z-10">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div 
        ref={mapContainer} 
        className="w-full h-full rounded-lg shadow-md"
      />
    </div>
  );
};

export default Map;

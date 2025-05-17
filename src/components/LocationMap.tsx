import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Calculate appropriate zoom level based on radius
function getZoomLevel(radius: number): number {
  if (radius <= 100) return 18;
  if (radius <= 200) return 17;
  if (radius <= 300) return 16;
  return 15;
}

// Component to update map view when location changes
function SetViewOnClick({ coords, radius }: { coords: [number, number]; radius: number }) {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.setView(coords, getZoomLevel(radius));
    }
  }, [coords, radius, map]);

  return null;
}

// Component to handle map clicks - this is the key addition
function MapClickHandler({ onMapClick, editable }: { onMapClick: (e: L.LeafletMouseEvent) => void; editable: boolean }) {
  useMapEvents({
    click: (e) => {
      if (editable) {
        onMapClick(e);
      }
    },
  });

  return null;
}

interface LocationMapProps {
  position: [number, number] | null;
  radius: number;
  onPositionChange?: (lat: number, lng: number) => void;
  editable?: boolean;
}

const LocationMap: React.FC<LocationMapProps> = ({ position, radius, onPositionChange, editable = false }) => {
  const [mapPosition, setMapPosition] = useState<[number, number]>(position || [-6.2088, 106.8456]); // Default to Jakarta

  // Update internal position when external position changes
  useEffect(() => {
    if (position) {
      setMapPosition(position);
    }
  }, [position]);

  // Handle map click for position selection
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    const { lat, lng } = e.latlng;
    setMapPosition([lat, lng]);

    if (onPositionChange) {
      onPositionChange(lat, lng);
    }
  };

  return (
    <div className="w-full h-64 rounded-lg overflow-hidden border border-slate-700/70">
      {/* Only render map after position is available to prevent errors */}
      <MapContainer center={mapPosition} zoom={getZoomLevel(radius)} style={{ height: "100%", width: "100%" }} attributionControl={false} zoomControl={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />

        {mapPosition && (
          <>
            <Marker position={mapPosition} />
            <Circle
              center={mapPosition}
              radius={radius}
              pathOptions={{
                fillColor: "blue",
                fillOpacity: 0.1,
                weight: 2,
                color: "#4d7cff",
              }}
            />
          </>
        )}

        <SetViewOnClick coords={mapPosition} radius={radius} />

        {/* This is the important addition - proper click handler */}
        <MapClickHandler onMapClick={handleMapClick} editable={editable} />
      </MapContainer>
    </div>
  );
};

export default LocationMap;

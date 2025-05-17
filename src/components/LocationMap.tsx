import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, useMap, useMapEvents, Rectangle, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Konstanta untuk grid
const GRID_SIZE_METERS = 100;
const ZOOM_LEVEL = 16; // Zoom level tetap

// Component to update map view when location changes
function SetViewOnClick({ coords }: { coords: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (coords) {
      map.setView(coords, ZOOM_LEVEL);
    }
  }, [coords, map]);

  return null;
}

// Component to handle map clicks
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

// Komponen untuk menampilkan grid
function GridOverlay({ position }: { position: [number, number] }) {
  // Bulatkan koordinat ke grid
  const gridLat = Math.round(position[0] * 1000) / 1000;
  const gridLng = Math.round(position[1] * 1000) / 1000;

  // Perkiraan kasar untuk grid 100m
  const latDelta = 0.0009; // ~100m vertikal
  const lngDelta = 0.0011; // ~100m horizontal (bervariasi tergantung latitude)

  // Batas grid
  const bounds: L.LatLngBoundsExpression = [
    [gridLat - latDelta / 2, gridLng - lngDelta / 2], // Southwest
    [gridLat + latDelta / 2, gridLng + lngDelta / 2], // Northeast
  ];

  return (
    <>
      <Rectangle
        bounds={bounds}
        pathOptions={{
          color: "#4d7cff",
          fillColor: "blue",
          fillOpacity: 0.1,
          weight: 2,
        }}
      />
      <Marker position={[gridLat, gridLng]} opacity={0.8}>
        <Tooltip permanent direction="top" className="grid-tooltip">
          Grid: {gridLat.toFixed(3)},{gridLng.toFixed(3)}
        </Tooltip>
      </Marker>
    </>
  );
}

interface LocationMapProps {
  position: [number, number] | null;
  radius?: number; // Optional, karena sekarang kita pakai grid tetap
  onPositionChange?: (lat: number, lng: number) => void;
  editable?: boolean;
}

const LocationMap: React.FC<LocationMapProps> = ({ position, radius = GRID_SIZE_METERS, onPositionChange, editable = false }) => {
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
      <MapContainer center={mapPosition} zoom={ZOOM_LEVEL} style={{ height: "100%", width: "100%" }} attributionControl={false} zoomControl={true}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />

        {mapPosition && (
          <>
            {/* Marker lokasi yang dipilih */}
            <Marker position={mapPosition} />

            {/* Tunjukkan grid (kotak 100m x 100m) */}
            <GridOverlay position={mapPosition} />

            {/* Tampilkan juga lingkaran radius jika diinginkan */}
            <Circle
              center={mapPosition}
              radius={radius}
              pathOptions={{
                fillColor: "transparent",
                weight: 1,
                color: "#4d7cff",
                dashArray: "5, 5",
                opacity: 0.6,
              }}
            />
          </>
        )}

        <SetViewOnClick coords={mapPosition} />
        <MapClickHandler onMapClick={handleMapClick} editable={editable} />
      </MapContainer>
    </div>
  );
};

export default LocationMap;

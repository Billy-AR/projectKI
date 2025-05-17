import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { toast } from "react-toastify";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { MapPin, Lock } from "lucide-react";
import type { GeoLocationKeyProps } from "../Types";

interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const GeoLocationKeyGenerator: React.FC<GeoLocationKeyProps> = ({ onKeyGenerated, disabled = false, mode = "encode" }) => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationState | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [radius, setRadius] = useState<number>(100);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedLocations, setSavedLocations] = useState<Array<{ name: string; lat: number; lng: number; radius: number }>>([]);
  const [locationKey, setLocationKey] = useState<string>("");
  const [mapInitialized, setMapInitialized] = useState<boolean>(false);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  // Memuat library Leaflet saat komponen dimuat
  useEffect(() => {
    // Cek apakah script Leaflet sudah dimuat
    if (!window.L && !document.getElementById("leaflet-script")) {
      const script = document.createElement("script");
      script.id = "leaflet-script";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "";
      script.async = true;
      script.onload = () => console.log("Leaflet library loaded successfully");
      script.onerror = () => console.error("Failed to load Leaflet library");
      document.head.appendChild(script);
    }

    // Cek apakah CSS Leaflet sudah dimuat
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }
  }, []);

  // Load saved locations on component mount
  useEffect(() => {
    const storedLocations = localStorage.getItem("stegoLocations");
    if (storedLocations) {
      try {
        setSavedLocations(JSON.parse(storedLocations));
      } catch (e) {
        console.error("Error parsing saved locations:", e);
      }
    }
  }, []);

  // Initialize map when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initMap();
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [dialogOpen]);

  // Initialize map
  const initMap = () => {
    if (!mapRef.current || !window.L || mapInitialized) return;

    try {
      console.log("Initializing map...");

      // Clear any existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const L = window.L;

      // Default center (Jakarta)
      const defaultCenter: L.LatLngExpression = [-6.2088, 106.8456]; // Example coordinates (Jakarta)

      // Create map with explicit height
      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: 15,
      });

      // Add tile layer (OpenStreetMap)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Create marker
      const marker = L.marker(defaultCenter, {
        draggable: mode === "encode",
        title: "Lokasi Target",
      }).addTo(map);

      // Create radius circle
      const circle = L.circle(defaultCenter, {
        radius: radius,
        color: "#4f46e5",
        fillColor: "#4f46e5",
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);

      // Store references
      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      setTargetLocation({ lat: defaultCenter[0], lng: defaultCenter[1] });

      // Add marker drag event (hanya untuk mode encode)
      if (mode === "encode") {
        marker.on("dragend", () => {
          const position = marker.getLatLng();
          setTargetLocation({ lat: position.lat, lng: position.lng });
          circle.setLatLng(position);
        });
      }

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        map.invalidateSize();
        console.log("Map invalidateSize called");
      }, 200);

      setMapInitialized(true);
      getCurrentLocation();
    } catch (error) {
      console.error("Error initializing map:", error);
      toast.error("Gagal menampilkan peta. Harap refresh halaman.");
    }
  };

  // Update circle radius
  useEffect(() => {
    if (circleRef.current && mapInitialized) {
      circleRef.current.setRadius(radius);
    }
  }, [radius, mapInitialized]);

  // Get current location
  const getCurrentLocation = () => {
    setIsLoading(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log("Got current location:", latitude, longitude);
          setCurrentLocation({ latitude, longitude, accuracy });

          if (mapInstanceRef.current && markerRef.current && circleRef.current) {
            // Dalam mode encode, pindahkan marker ke lokasi user
            if (mode === "encode") {
              markerRef.current.setLatLng([latitude, longitude]);
              circleRef.current.setLatLng([latitude, longitude]);
              setTargetLocation({ lat: latitude, lng: longitude });
            }

            // Selalu pindahkan peta ke lokasi user
            mapInstanceRef.current.panTo([latitude, longitude]);
          }

          setIsLoading(false);

          // Jika mode decode, otomatis cek lokasi
          if (mode === "decode") {
            checkLocationForKey();
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          toast.error("Tidak dapat mengakses lokasi Anda: " + error.message);
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast.error("Browser Anda tidak mendukung geolokasi");
      setIsLoading(false);
    }
  };

  // Save the location
  const handleSaveLocation = () => {
    if (!targetLocation || !locationName.trim()) {
      toast.error("Harap isi nama lokasi");
      return;
    }

    const newLocation = {
      name: locationName,
      lat: targetLocation.lat,
      lng: targetLocation.lng,
      radius,
    };

    // Save to local storage
    const updatedLocations = [...savedLocations, newLocation];
    setSavedLocations(updatedLocations);
    localStorage.setItem("stegoLocations", JSON.stringify(updatedLocations));

    // Generate key for saved location
    const locationSeed = `${newLocation.lat.toFixed(6)}-${newLocation.lng.toFixed(6)}-${newLocation.name}`;
    const key = generateConsistentKey(locationSeed);

    setLocationKey(key);
    onKeyGenerated(key);

    toast.success(`Lokasi "${locationName}" disimpan dan kunci dibuat`);
    setDialogOpen(false);
  };

  // Check location key
  const checkLocationForKey = () => {
    if (!currentLocation) {
      getCurrentLocation();
      return;
    }

    if (savedLocations.length === 0) {
      toast.error("Tidak ada lokasi tersimpan");
      return;
    }

    let isWithinAnyRadius = false;
    let matchedLocation = null;

    for (const location of savedLocations) {
      const distance = calculateDistance(currentLocation.latitude, currentLocation.longitude, location.lat, location.lng);

      console.log(`Distance to ${location.name}: ${distance}m (radius: ${location.radius}m)`);

      if (distance <= location.radius) {
        isWithinAnyRadius = true;
        matchedLocation = location;
        break;
      }
    }

    if (isWithinAnyRadius && matchedLocation) {
      // Generate a consistent key based on the location
      const locationSeed = `${matchedLocation.lat.toFixed(6)}-${matchedLocation.lng.toFixed(6)}-${matchedLocation.name}`;
      const key = generateConsistentKey(locationSeed);

      // Set state and pass key to parent
      setLocationKey(key);
      onKeyGenerated(key);

      // Jika moda decoding, tampilkan lokasi terdeteksi di map
      if (mode === "decode" && markerRef.current && circleRef.current && mapInstanceRef.current) {
        markerRef.current.setLatLng([matchedLocation.lat, matchedLocation.lng]);
        circleRef.current.setLatLng([matchedLocation.lat, matchedLocation.lng]);
        circleRef.current.setRadius(matchedLocation.radius);
        mapInstanceRef.current.panTo([matchedLocation.lat, matchedLocation.lng]);
      }

      toast.success(`Kunci lokasi ditemukan untuk: ${matchedLocation.name}`);
      setDialogOpen(false);
    } else {
      toast.error("Anda tidak berada dalam radius lokasi yang tersimpan");
    }
  };

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Generate a consistent key from location data
  const generateConsistentKey = (seed: string): string => {
    // Simple deterministic hash function
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Use absolute value of hash as seed for random generator
    const seedValue = Math.abs(hash);

    // Generate key with specific characters
    let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "";

    // Use a predictable algorithm to generate the same key for the same seed
    for (let i = 0; i < 16; i++) {
      const charIndex = (seedValue + i * 7919) % chars.length; // Use prime number 7919 for better distribution
      key += chars.charAt(charIndex);
    }

    return key;
  };

  // Direct access key
  const generateDirectKey = () => {
    if (!currentLocation) {
      getCurrentLocation();
      return;
    }

    const defaultName = locationName.trim() || "Lokasi Saat Ini";
    const seed = `${currentLocation.latitude.toFixed(6)}-${currentLocation.longitude.toFixed(6)}-${defaultName}`;
    const key = generateConsistentKey(seed);

    setLocationKey(key);
    onKeyGenerated(key);
    toast.success(`Kunci lokasi dibuat: ${defaultName}`);
    setDialogOpen(false);
  };

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setMapInitialized(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="whitespace-nowrap bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:border-blue-500/50 hover:text-blue-200" disabled={disabled}>
          {mode === "encode" ? <MapPin className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
          {mode === "encode" ? "Buat Kunci Lokasi" : "Periksa Kunci Lokasi"}
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-slate-800 border-slate-700 rounded-xl max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-blue-100">{mode === "encode" ? "Buat Kunci Berbasis Lokasi" : "Periksa Kunci Berbasis Lokasi"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="h-64 w-full bg-slate-700 rounded-lg overflow-hidden">
            <div ref={mapRef} style={{ width: "100%", height: "100%", zIndex: 1 }} className="leaflet-container"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bagian khusus untuk encode */}
            {mode === "encode" && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="location-name" className="text-blue-100 mb-1 block">
                    Nama Lokasi
                  </Label>
                  <Input id="location-name" placeholder="Kantor, Rumah, dll." value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-slate-700/50 border-slate-600 focus:border-blue-500 text-white" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-blue-100">Radius (meter)</Label>
                    <span className="text-sm font-mono bg-slate-700/60 px-2 py-0.5 rounded text-blue-300">{radius}m</span>
                  </div>
                  <Slider value={[radius]} min={50} max={500} step={10} onValueChange={(value) => setRadius(value[0])} className="py-1" />
                </div>

                <div className="flex gap-2">
                  <Button onClick={getCurrentLocation} className="flex-1 bg-slate-700 hover:bg-slate-600" disabled={isLoading}>
                    {isLoading ? "Mencari..." : "Lokasi Saya"}
                  </Button>
                  <Button onClick={handleSaveLocation} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!targetLocation || !locationName.trim()}>
                    Simpan & Gunakan
                  </Button>
                </div>

                <Button onClick={generateDirectKey} className="w-full bg-green-600 hover:bg-green-700" disabled={!currentLocation}>
                  Gunakan Lokasi Ini Langsung
                </Button>
              </div>
            )}

            {/* Bagian untuk kedua mode */}
            <div className={`space-y-4 ${mode === "decode" ? "col-span-2" : ""}`}>
              <Label className="text-blue-100 block">{mode === "encode" ? "Lokasi Tersimpan" : "Informasi Lokasi"}</Label>

              <div className="bg-slate-700/50 rounded-lg border border-slate-600 h-32 overflow-auto">
                {savedLocations.length > 0 ? (
                  <div className="p-2">
                    {savedLocations.map((loc, index) => (
                      <div key={index} className="flex justify-between items-center p-2 hover:bg-slate-600/30 rounded">
                        <span className="text-blue-200">{loc.name}</span>
                        <span className="text-xs text-slate-400">{loc.radius}m</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400">{mode === "encode" ? "Belum ada lokasi tersimpan" : "Tidak ada lokasi tersimpan untuk diperiksa"}</div>
                )}
              </div>

              {mode === "decode" && (
                <>
                  <Button onClick={getCurrentLocation} className="w-full bg-slate-700 hover:bg-slate-600" disabled={isLoading}>
                    {isLoading ? "Mencari..." : "Dapatkan Lokasi Saya"}
                  </Button>

                  <Button onClick={checkLocationForKey} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700" disabled={isLoading || savedLocations.length === 0}>
                    Periksa Kunci Lokasi
                  </Button>
                </>
              )}

              {/* Menampilkan kunci yang dihasilkan */}
              {locationKey && (
                <div className="mt-2 p-2 bg-slate-700/70 rounded-lg border border-blue-500/30">
                  <p className="text-xs text-blue-200 mb-1">{mode === "encode" ? "Kunci Lokasi Baru:" : "Kunci Lokasi Terdeteksi:"}</p>
                  <p className="font-mono text-sm text-blue-300 break-all">{locationKey}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GeoLocationKeyGenerator;

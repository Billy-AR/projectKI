import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Slider } from "./ui/slider";
import { toast } from "react-toastify";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { MapPin, List } from "lucide-react";
import LocationMap from "./LocationMap"; // Import our new component
import type { GeoLocationKeyProps } from "../Types";

interface SavedLocation {
  name: string;
  key: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: string;
}

// Helper to display safe key preview
const getKeyPreview = (key?: string) => {
  if (!key) return "Tidak ada kunci";
  return `${key.substring(0, 8)}...`;
};

const GeoLocationKeyGenerator: React.FC<GeoLocationKeyProps> = ({ onKeyGenerated, disabled = false, mode = "encode" }) => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [savedLocationsDialogOpen, setSavedLocationsDialogOpen] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [radius, setRadius] = useState<number>(100);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  // Load saved locations on component mount
  useEffect(() => {
    try {
      const storedLocations = localStorage.getItem("stegoLocations");
      if (storedLocations) {
        const parsedLocations = JSON.parse(storedLocations);
        // Filter invalid locations
        const validLocations = parsedLocations.filter((loc: any) => loc && typeof loc === "object" && loc.key && loc.name);
        setSavedLocations(validLocations);
      }
    } catch (e) {
      console.error("Error parsing saved locations:", e);
      localStorage.removeItem("stegoLocations");
    }
  }, []);

  // Get current location
  const getCurrentLocation = () => {
    setIsLoading(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          console.log("Got current location:", latitude, longitude);
          setCurrentLocation({ latitude, longitude, accuracy });
          setIsLoading(false);
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

  // Manual location selection from map
  const handleMapPositionChange = (lat: number, lng: number) => {
    setCurrentLocation({
      latitude: lat,
      longitude: lng,
      accuracy: 10, // Default accuracy when manually selected
    });
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

  // Save the location
  const handleSaveLocation = () => {
    if (!currentLocation || !locationName.trim()) {
      toast.error("Harap isi nama lokasi dan dapatkan lokasi Anda");
      return;
    }

    // Generate a key based on location and name
    const locationSeed = `${currentLocation.latitude.toFixed(6)}-${currentLocation.longitude.toFixed(6)}-${locationName}`;
    const key = generateConsistentKey(locationSeed);

    if (!key) {
      toast.error("Gagal membuat kunci lokasi");
      return;
    }

    // Create new location object
    const newLocation: SavedLocation = {
      name: locationName,
      key: key,
      lat: currentLocation.latitude,
      lng: currentLocation.longitude,
      radius: radius,
      createdAt: new Date().toISOString(),
    };

    // Save to state and local storage
    const updatedLocations = [...savedLocations, newLocation];
    setSavedLocations(updatedLocations);
    localStorage.setItem("stegoLocations", JSON.stringify(updatedLocations));

    // Set the key and notify parent
    onKeyGenerated(key);

    toast.success(`Lokasi "${locationName}" disimpan dan kunci dibuat`);
    setDialogOpen(false);
  };

  // Select an existing location
  const selectLocation = (location: SavedLocation) => {
    if (!location || !location.key) {
      toast.error("Kunci lokasi tidak valid");
      return;
    }

    onKeyGenerated(location.key);
    toast.success(`Kunci lokasi "${location.name}" dipilih`);
    setSavedLocationsDialogOpen(false);
  };

  // Delete a location
  const deleteLocation = (index: number) => {
    const updatedLocations = [...savedLocations];
    updatedLocations.splice(index, 1);
    setSavedLocations(updatedLocations);
    localStorage.setItem("stegoLocations", JSON.stringify(updatedLocations));
    toast.info("Lokasi dihapus");
  };

  return (
    <div className="flex gap-2">
      {/* Button to create new location */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex-1 whitespace-nowrap bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30 hover:border-blue-500/50 hover:text-blue-200" disabled={disabled}>
            <MapPin className="mr-2 h-4 w-4" />
            {mode === "encode" ? "Buat Kunci Lokasi" : "Buat Kunci Lokasi"}
          </Button>
        </DialogTrigger>

        <DialogContent className="bg-slate-800 border-slate-700 rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-blue-100">Buat Kunci Berbasis Lokasi</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="location-name" className="text-blue-100 mb-1 block">
                Nama Lokasi
              </Label>
              <Input id="location-name" placeholder="Kantor, Rumah, dll." value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-slate-700/50 border-slate-600 focus:border-blue-500 text-white" />
            </div>

            {/* Map View - New Addition */}
            <div className="space-y-2">
              <Label className="text-blue-100">Pilih Lokasi di Peta</Label>
              <LocationMap position={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null} radius={radius} editable={true} onPositionChange={handleMapPositionChange} />
              <p className="text-xs text-slate-400">Klik pada peta untuk memilih lokasi, atau gunakan tombol di bawah untuk mendapatkan lokasi saat ini</p>
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
                {isLoading ? "Mencari..." : "Dapatkan Lokasi"}
              </Button>
              <Button onClick={handleSaveLocation} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!currentLocation || !locationName.trim()}>
                Simpan & Gunakan
              </Button>
            </div>

            {currentLocation && (
              <div className="bg-slate-700/30 p-3 rounded-md">
                <p className="text-xs text-blue-200">Lokasi saat ini:</p>
                <p className="text-xs text-slate-400">Lat: {currentLocation.latitude.toFixed(6)}</p>
                <p className="text-xs text-slate-400">Lng: {currentLocation.longitude.toFixed(6)}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Button to select from saved locations */}
      <Dialog open={savedLocationsDialogOpen} onOpenChange={setSavedLocationsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex-1 whitespace-nowrap bg-slate-700/20 border-slate-600/30 text-slate-300 hover:bg-slate-700/30 hover:text-slate-200" disabled={disabled || savedLocations.length === 0}>
            <List className="mr-2 h-4 w-4" />
            Lokasi Tersimpan
          </Button>
        </DialogTrigger>

        <DialogContent className="bg-slate-800 border-slate-700 rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-blue-100">Pilih Lokasi Tersimpan</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {savedLocations.length > 0 ? (
              <div className="space-y-4 max-h-80 overflow-auto pr-2">
                {savedLocations.map((location, index) => (
                  <div key={index} className="bg-slate-700/30 p-3 rounded-md border border-slate-600/50 hover:border-blue-500/30 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-blue-400 mr-2" />
                          <p className="text-blue-200 font-medium">{location.name}</p>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Radius: {location.radius}m</p>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">{getKeyPreview(location.key)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => selectLocation(location)} size="sm" className="bg-blue-600 hover:bg-blue-700 text-sm">
                          Pilih
                        </Button>
                        <Button onClick={() => deleteLocation(index)} size="sm" variant="destructive" className="bg-red-600/20 hover:bg-red-700/30 border-red-500/30 text-red-300 text-sm">
                          Hapus
                        </Button>
                      </div>
                    </div>

                    {/* Small map preview for each saved location */}
                    <LocationMap position={[location.lat, location.lng]} radius={location.radius} editable={false} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <p>Belum ada lokasi tersimpan</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GeoLocationKeyGenerator;

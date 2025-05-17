import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { toast } from "react-toastify";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { MapPin, List } from "lucide-react";
import LocationMap from "./LocationMap";
import { generateLocationKey } from "../lib/steganography";
import type { GeoLocationKeyProps } from "../Types";

// Radius tetap (tidak bisa diubah)
const FIXED_RADIUS = 100;

interface SavedLocation {
  name: string;
  key: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: string;
}

// Helper untuk menampilkan preview key dengan aman
const getKeyPreview = (key?: string) => {
  if (!key) return "Tidak ada kunci";
  return `${key.substring(0, 8)}...`;
};

const GeoLocationKeyGenerator: React.FC<GeoLocationKeyProps> = ({ onKeyGenerated, disabled = false, mode = "encode" }) => {
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [savedLocationsDialogOpen, setSavedLocationsDialogOpen] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationName, setLocationName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [currentKey, setCurrentKey] = useState<string>("");

  // Load saved locations on component mount
  useEffect(() => {
    try {
      const storedLocations = localStorage.getItem("stegoLocations");
      if (storedLocations) {
        const parsedLocations = JSON.parse(storedLocations);
        // Filter lokasi yang tidak valid
        const validLocations = parsedLocations.filter((loc: any) => loc && typeof loc === "object" && loc.key && loc.name);
        setSavedLocations(validLocations);
      }
    } catch (e) {
      console.error("Error parsing saved locations:", e);
      localStorage.removeItem("stegoLocations");
    }
  }, []);

  // Update key ketika lokasi berubah
  useEffect(() => {
    if (currentLocation) {
      const key = generateLocationKey(currentLocation.latitude, currentLocation.longitude);
      setCurrentKey(key);
    }
  }, [currentLocation]);

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

  // Save the location
  const handleSaveLocation = () => {
    if (!currentLocation || !locationName.trim()) {
      toast.error("Harap isi nama lokasi dan dapatkan lokasi Anda");
      return;
    }

    // Gunakan fungsi generateLocationKey (dari steganography.ts)
    const key = generateLocationKey(currentLocation.latitude, currentLocation.longitude);

    if (!key) {
      toast.error("Gagal membuat kunci lokasi");
      return;
    }

    // Bulatkan koordinat untuk tampilan grid
    const gridLat = Math.round(currentLocation.latitude * 1000) / 1000;
    const gridLng = Math.round(currentLocation.longitude * 1000) / 1000;

    // Create new location object dengan grid coordinates
    const newLocation: SavedLocation = {
      name: locationName,
      key: key,
      lat: gridLat, // Simpan koordinat grid, bukan koordinat asli
      lng: gridLng,
      radius: FIXED_RADIUS, // Selalu tetap 100m
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

            {/* Map View */}
            <div className="space-y-2">
              <Label className="text-blue-100">Pilih Lokasi di Peta</Label>
              <LocationMap position={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : null} radius={FIXED_RADIUS} editable={true} onPositionChange={handleMapPositionChange} />
              <p className="text-xs text-slate-400">Klik pada peta untuk memilih lokasi, atau gunakan tombol di bawah untuk mendapatkan lokasi saat ini</p>
            </div>

            {/* Fixed radius info */}
            <div className="flex justify-between bg-slate-700/40 px-3 py-2 rounded-md">
              <Label className="text-blue-100">Radius</Label>
              <span className="text-sm font-mono bg-slate-700/60 px-2 py-0.5 rounded text-blue-300">{FIXED_RADIUS}m (tetap)</span>
            </div>

            <div className="flex gap-2">
              <Button onClick={getCurrentLocation} className="flex-1 bg-slate-700 hover:bg-slate-600" disabled={isLoading}>
                {isLoading ? "Mencari..." : "Dapatkan Lokasi"}
              </Button>
              <Button onClick={handleSaveLocation} className="flex-1 bg-blue-600 hover:bg-blue-700" disabled={!currentLocation || !locationName.trim()}>
                Simpan & Gunakan
              </Button>
            </div>

            {/* Grid info and debug info */}
            {currentLocation && (
              <div className="bg-slate-700/30 p-3 rounded-md">
                <p className="text-xs text-blue-200 font-semibold mb-2">Informasi Lokasi:</p>
                <p className="text-xs text-slate-400">
                  Grid Koordinat: {Math.round(currentLocation.latitude * 1000) / 1000}, {Math.round(currentLocation.longitude * 1000) / 1000}
                </p>
                <p className="text-xs text-slate-400">
                  Kunci yang dihasilkan: <span className="text-blue-300 font-mono">{currentKey}</span>
                </p>
                <p className="text-xs text-slate-500 mt-2">Lokasi dalam grid yang sama akan menghasilkan kunci yang sama</p>
              </div>
            )}

            {/* Grid explanation */}
            <div className="bg-slate-700/20 p-3 rounded-md">
              <p className="text-xs text-blue-200 font-semibold mb-1">Tentang Grid Lokasi:</p>
              <p className="text-xs text-slate-400">• Koordinat dibulatkan ke grid 100m x 100m</p>
              <p className="text-xs text-slate-400">• Lokasi dalam grid yang sama menghasilkan kunci yang sama</p>
              <p className="text-xs text-slate-400">• Grid ditampilkan sebagai kotak pada peta</p>
            </div>
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
                        <p className="text-xs text-slate-400 mt-1">
                          Koordinat: {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
                        </p>
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

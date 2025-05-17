import { useState } from "react";
import { Button } from "./ui/button";
// import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Slider } from "./ui/slider";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
// import LocationKeyGenerator from "./LocationKeyGenerator";
import ImageHandler from "./ImageHandler";
import { encodeMessage } from "../lib/steganography";
import type { SteganographyAlgorithm, SteganographySettings } from "../Types";
import GeoLocationKeyGenerator from "./GeoLocationGenerator";

const Encoder = () => {
  const [message, setMessage] = useState<string>("");
  const [locationKey, setLocationKey] = useState<string>("");
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [encodedImage, setEncodedImage] = useState<string | null>(null);
  const [isEncoding, setIsEncoding] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [algorithm, setAlgorithm] = useState<SteganographyAlgorithm>("DCT");
  const [quality, setQuality] = useState<number>(80);
  //   const downloadRef = useRef<HTMLAnchorElement | null>(null);

  const handleImageUpload = (file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target?.result) {
        setOriginalImage(e.target.result as string);
        setEncodedImage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEncode = async () => {
    if (!originalImage) {
      toast.error("Silakan pilih gambar terlebih dahulu");
      return;
    }

    if (!message) {
      toast.error("Pesan tidak boleh kosong");
      return;
    }

    if (!locationKey) {
      toast.error("Kunci lokasi tidak boleh kosong");
      return;
    }

    setIsEncoding(true);
    setProgress(0);

    try {
      // Create settings object based on selected algorithm
      const settings: SteganographySettings = {
        algorithm,
        quality: algorithm === "DCT" ? quality : undefined,
      };

      // Process encoding
      const result = await encodeMessage(originalImage, message, locationKey, (progress: number) => setProgress(progress), settings);

      setProgress(100);
      setEncodedImage(result);

      toast.success("Pesan berhasil disisipkan pada gambar");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyisipkan pesan");
    } finally {
      setTimeout(() => setIsEncoding(false), 500);
    }
  };

  const handleDownload = () => {
    if (!encodedImage) return;

    const link = document.createElement("a");
    link.href = encodedImage;
    const fileExtension = algorithm === "DCT" ? "jpg" : "png";
    link.download = `steganografi_image.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="upload-image" className="text-blue-100 font-medium mb-2 block">
                Unggah Gambar
              </Label>
              <ImageHandler onImageSelected={handleImageUpload} imagePreview={originalImage} disabled={isEncoding} />
            </div>

            <div>
              <Label htmlFor="message" className="text-blue-100 font-medium mb-2 block">
                Pesan
              </Label>
              <Textarea
                id="message"
                placeholder="Masukkan pesan rahasia di sini..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isEncoding}
                className="h-32 bg-slate-700/50 border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-white placeholder-slate-400"
              />
              <p className="text-xs text-slate-400 mt-1.5">{message.length} karakter</p>
            </div>

            <div>
              <Label htmlFor="algorithm" className="text-blue-100 font-medium mb-2 block">
                Algoritma Steganografi
              </Label>
              <RadioGroup defaultValue="DCT" value={algorithm} onValueChange={(value) => setAlgorithm(value as SteganographyAlgorithm)} className="flex gap-6 mb-4" disabled={isEncoding}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PVD" id="r2" />
                  <Label htmlFor="r2">PVD</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DCT" id="r3" />
                  <Label htmlFor="r3">DCT</Label>
                </div>
              </RadioGroup>

              {algorithm === "DCT" && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <Label className="text-sm text-blue-200">Kualitas JPEG</Label>
                    <span className="text-sm font-mono bg-slate-700/60 px-2 py-0.5 rounded text-blue-300">{quality}%</span>
                  </div>
                  <Slider value={[quality]} min={50} max={95} step={5} onValueChange={(value) => setQuality(value[0])} disabled={isEncoding} className="py-1" />
                  <p className="text-xs text-slate-400">Nilai lebih tinggi = kualitas lebih baik, tapi kapasitas pesan lebih kecil</p>
                </div>
              )}

              <div className="mt-4">
                <div className="flex gap-2">
                  <div className="mt-4">
                    jsx
                    <div className="mt-4">
                      <Label htmlFor="locationKey" className="text-blue-100 font-medium mb-2 block">
                        Kunci Lokasi
                      </Label>

                      <div className="flex gap-2 items-center">
                        <GeoLocationKeyGenerator onKeyGenerated={setLocationKey} disabled={isEncoding} mode="encode" />

                        {/* Display the current key */}
                        {locationKey && (
                          <div className="flex-1 bg-slate-700/30 rounded-md flex items-center px-3 py-2 overflow-hidden">
                            <span className="font-mono text-blue-300 text-sm truncate">{locationKey}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button
              onClick={handleEncode}
              disabled={isEncoding || !originalImage || !message || !locationKey}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-lg transition-all"
            >
              {isEncoding ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Proses...
                </span>
              ) : (
                "Sisipkan Pesan"
              )}
            </Button>

            {isEncoding && (
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 to-indigo-400" />
                <p className="text-xs text-slate-400 text-right">{progress}%</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-blue-100 font-medium mb-2 block">Hasil Steganografi</Label>
              <div className="mt-2 border border-slate-600/70 rounded-lg overflow-hidden aspect-video flex items-center justify-center bg-slate-700/30">
                {encodedImage ? (
                  <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={encodedImage} alt="Encoded" className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-center py-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-slate-500/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-slate-500">Hasil akan muncul di sini</p>
                  </div>
                )}
              </div>
            </div>

            {encodedImage && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-700/30 rounded-lg">
                  <AlertDescription className="text-blue-100">
                    <div className="space-y-2">
                      <p>
                        Pesan berhasil disisipkan menggunakan algoritma <span className="font-semibold">{algorithm}</span>!
                      </p>
                      <p>Simpan kunci lokasi Anda:</p>
                      <span className="font-mono bg-slate-800/80 px-3 py-1 rounded text-xs text-blue-300 inline-block">{locationKey}</span>
                    </div>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleDownload}
                  className="w-full mt-4 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Unduh Gambar
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Encoder;

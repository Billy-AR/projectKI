import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import ImageHandler from "./ImageHandler";
import { decodeMessage } from "../lib/steganography";
import GeoLocationKeyGenerator from "./GeoLocationGenerator";

const Decoder = () => {
  const [locationKey, setLocationKey] = useState<string>("");
  const [stegoImage, setStegoImage] = useState<string | null>(null);
  const [extractedMessage, setExtractedMessage] = useState<string>("");
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [errorDetails, setErrorDetails] = useState<string>("");

  const handleImageUpload = (file: File) => {
    if (!file) return;

    // Validate image format
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan PNG, JPG, atau WebP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (e.target?.result) {
        setStegoImage(e.target.result as string);
        setExtractedMessage("");
        setErrorDetails("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDecode = async () => {
    if (!stegoImage) {
      toast.error("Silakan pilih gambar terlebih dahulu");
      return;
    }

    if (!locationKey) {
      toast.error("Kunci lokasi diperlukan untuk ekstraksi");
      return;
    }

    setIsDecoding(true);
    setProgress(0);
    setErrorDetails("");

    try {
      // Add more user feedback
      toast.info("Mengekstrak pesan menggunakan kunci lokasi...");

      // Process decoding with improved algorithm
      const message = await decodeMessage(stegoImage, locationKey, (progress: number) => setProgress(progress));

      setProgress(100);

      if (message && message.length > 0) {
        setExtractedMessage(message);
        toast.success("Pesan berhasil diekstrak");
      } else {
        setErrorDetails("Tidak dapat menemukan pesan dalam gambar. Kemungkinan penyebab: kunci lokasi salah, gambar tidak mengandung pesan, atau format gambar tidak sesuai.");
        toast.warn("Tidak ada pesan terdeteksi atau kunci lokasi salah");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Gagal mengekstrak pesan";
      setErrorDetails(`Error: ${errorMessage}`);
      toast.error(errorMessage);
    } finally {
      setTimeout(() => setIsDecoding(false), 500);
    }
  };

  const handleRetry = () => {
    setExtractedMessage("");
    setErrorDetails("");
    setStegoImage(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="upload-stego" className="text-blue-100 font-medium mb-2 block">
                Unggah Gambar Steganografi
              </Label>
              <ImageHandler onImageSelected={handleImageUpload} imagePreview={stegoImage} disabled={isDecoding} />

              {stegoImage && <p className="text-xs text-slate-400 mt-1">Format: {stegoImage.substring(5, stegoImage.indexOf(";"))} • Kualitas lebih baik pada format PNG</p>}
            </div>

            <div>
              <Label htmlFor="decode-key" className="text-blue-100 font-medium mb-2 block">
                Kunci Lokasi
              </Label>
              <GeoLocationKeyGenerator onKeyGenerated={setLocationKey} disabled={isDecoding} mode="decode" />

              {locationKey && (
                <div className="bg-slate-700/30 rounded-md flex items-center px-3 py-2 overflow-hidden mt-2">
                  <span className="font-mono text-blue-300 text-sm truncate">{locationKey}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleDecode}
              disabled={isDecoding || !stegoImage || !locationKey}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 rounded-lg transition-all"
            >
              {isDecoding ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Proses...
                </span>
              ) : (
                "Ekstrak Pesan"
              )}
            </Button>

            {isDecoding && (
              <div className="space-y-1">
                <Progress value={progress} className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 to-indigo-400" />
                <p className="text-xs text-slate-400 text-right">{progress}%</p>
              </div>
            )}

            {errorDetails && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert className="bg-gradient-to-r from-red-900/40 to-orange-900/40 border border-red-700/30 rounded-lg">
                  <AlertDescription className="text-red-100">
                    <div className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p>{errorDetails}</p>
                        <Button onClick={handleRetry} size="sm" className="mt-2 bg-red-600/20 hover:bg-red-600/40 text-red-200">
                          Coba Lagi
                        </Button>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-blue-100 font-medium mb-2 block">Pesan Terekstrak</Label>
              <div className="border border-slate-600/70 rounded-lg p-6 h-60 overflow-auto bg-slate-700/30">
                {extractedMessage ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-green-300 font-mono break-words">{extractedMessage}</p>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-slate-500/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-slate-500">Pesan terekstrak akan muncul di sini</p>
                  </div>
                )}
              </div>
            </div>

            {extractedMessage && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert className="bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/30 rounded-lg">
                  <AlertDescription className="text-green-100">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pesan berhasil diekstrak menggunakan algoritma berbasis lokasi!
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
              <h3 className="text-blue-300 font-medium mb-2">Tips Ekstraksi Pesan</h3>
              <ul className="text-xs text-slate-400 space-y-1.5">
                <li className="flex items-start">
                  <span className="text-blue-400 mr-1.5">•</span>
                  Pastikan menggunakan kunci lokasi yang sama dengan saat pesan disisipkan
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-1.5">•</span>
                  Gunakan gambar asli tanpa kompresi untuk hasil terbaik
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-1.5">•</span>
                  Jika lokasi tidak dapat ditemukan, gunakan tombol "Lokasi Tersimpan"
                </li>
                <li className="flex items-start">
                  <span className="text-blue-400 mr-1.5">•</span>
                  Format PNG lebih stabil untuk steganografi daripada JPG
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Decoder;

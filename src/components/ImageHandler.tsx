import { useState, useRef } from "react";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import type { ImageHandlerProps } from "../Types/index";

interface FileInfoProps {
  name: string;
  type: string;
  size: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

const ImageHandler: React.FC<ImageHandlerProps> = ({ onImageSelected, imagePreview, disabled = false }) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileInfo, setFileInfo] = useState<FileInfoProps | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (file: File) => {
    // Validate image type
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan PNG, JPG, atau WebP.");
      return;
    }

    // For steganography, recommend PNG format
    if (file.type !== "image/png") {
      toast.info("Format PNG direkomendasikan untuk hasil steganografi terbaik");
    }

    // Check file size
    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      toast.warn("Ukuran file besar (>10MB) mungkin memerlukan waktu pemrosesan yang lebih lama");
    }

    // Simpan informasi file
    setFileInfo({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    onImageSelected(file);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Helper function untuk mendapatkan nama format yang lebih user-friendly
  const getFormatName = (mimeType: string): string => {
    switch (mimeType) {
      case "image/png":
        return "PNG";
      case "image/jpeg":
      case "image/jpg":
        return "JPG";
      case "image/webp":
        return "WebP";
      case "image/gif":
        return "GIF";
      default:
        return mimeType.split("/")[1]?.toUpperCase() || mimeType;
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl transition-all duration-300 aspect-video flex flex-col items-center justify-center cursor-pointer ${
          isDragging ? "border-blue-400 bg-blue-500/10" : imagePreview ? "border-transparent shadow-lg" : "border-slate-600/70 hover:border-blue-500/50 hover:bg-slate-800/30"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleButtonClick}
      >
        {imagePreview ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full h-full relative group">
            <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg w-full h-full" />
            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg">
              <p className="text-white text-sm font-medium">Klik untuk mengubah gambar</p>
            </div>
          </motion.div>
        ) : (
          <div className="text-center p-8">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-blue-400/60 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </motion.div>
            <p className="text-slate-300 mb-1">Drag & drop gambar</p>
            <p className="text-sm text-slate-400">atau klik untuk memilih</p>
            <p className="text-xs text-slate-500 mt-2">PNG direkomendasikan untuk hasil terbaik</p>
          </div>
        )}
        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" disabled={disabled} />
      </div>

      {/* Informasi file yang diunggah */}
      {imagePreview && fileInfo && (
        <div className="bg-slate-800/40 rounded-md p-2 text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-200">Informasi Gambar:</span>
            <Button variant="outline" size="sm" onClick={handleButtonClick} disabled={disabled} className="h-6 py-0 px-2 text-xs border-slate-600/80 text-slate-300 hover:bg-slate-700/50">
              Ganti
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="text-slate-400 truncate">Nama:</div>
            <div className="text-slate-300 truncate font-mono">{fileInfo.name}</div>

            <div className="text-slate-400">Format:</div>
            <div className="text-slate-300">
              <span className={`px-1.5 py-0.5 rounded text-xs ${fileInfo.type === "image/png" ? "bg-green-900/30 text-green-300" : "bg-yellow-900/30 text-yellow-300"}`}>{getFormatName(fileInfo.type)}</span>
              {fileInfo.type !== "image/png" && <span className="text-yellow-400 ml-1.5 text-[10px]">(PNG disarankan)</span>}
            </div>

            <div className="text-slate-400">Ukuran:</div>
            <div className="text-slate-300">{formatFileSize(fileInfo.size)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageHandler;

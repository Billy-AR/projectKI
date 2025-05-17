// Types.ts

export interface LocationKeyOptions {
  length: number;
  includeUppercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
}

export interface PixelPosition {
  x: number;
  y: number;
}

export interface ImageHandlerProps {
  onImageSelected: (file: File) => void;
  imagePreview: string | null;
  disabled?: boolean;
}

export interface LocationKeyGeneratorProps {
  onKeyGenerated: (key: string) => void;
  disabled?: boolean;
}

export type ProgressCallback = (progress: number) => void;

// New types for steganography algorithm selection
export type SteganographyAlgorithm = "LSB" | "PVD" | "DCT";

// Settings for steganography process
export interface SteganographySettings {
  algorithm: SteganographyAlgorithm;
  quality?: number; // For DCT algorithm
}

// Hapus definisi duplikat
export interface GeoLocationKeyProps {
  onKeyGenerated: (key: string) => void;
  disabled?: boolean;
  mode: "encode" | "decode"; // Tambahkan mode untuk membedakan encoder dan decoder
}

// Tambahkan interface untuk lokasi tersimpan
export interface SavedLocation {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

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

// Define SteganographyAlgorithm type correctly
export type SteganographyAlgorithm = "LocationBased";

// Settings for steganography process
export interface SteganographySettings {
  algorithm: SteganographyAlgorithm;
  quality?: number; // For backward compatibility
}

export interface GeoLocationKeyProps {
  onKeyGenerated: (key: string) => void;
  disabled?: boolean;
  mode?: "encode" | "decode";
}

export interface SavedLocation {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

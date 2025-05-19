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
  key: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: string;
}

export interface ImageHandlerProps {
  onImageSelected: (file: File) => void;
  imagePreview: string | null;
  disabled?: boolean;
}

// Tambahkan ke existing types
export interface PVDRange {
  min: number;
  max: number;
  capacity: number;
}

export interface PixelPair {
  pos1: PixelPosition;
  pos2: PixelPosition;
}

export interface PVDEmbedResult {
  newPixel1: number;
  newPixel2: number;
  actualDiff: number; // Tambahkan untuk debugging
}

export interface ImageAnalysis {
  averageComplexity: number;
  textureMap: number[][];
  edgeMap: boolean[][];
}

// Enhanced existing PixelPosition if needed
export interface PixelPosition {
  x: number;
  y: number;
}

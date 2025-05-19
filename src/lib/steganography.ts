import type { PixelPosition, ProgressCallback, PVDRange, PixelPair, PVDEmbedResult } from "../Types";

// PVD Range Table - tingkat kapasitas berdasarkan perbedaan nilai pixel
const PVD_RANGE_TABLE: readonly PVDRange[] = [
  { min: 0, max: 7, capacity: 3 }, // 2^3 = 8 levels
  { min: 8, max: 15, capacity: 3 }, // 2^3 = 8 levels
  { min: 16, max: 31, capacity: 4 }, // 2^4 = 16 levels
  { min: 32, max: 63, capacity: 5 }, // 2^5 = 32 levels
  { min: 64, max: 127, capacity: 6 }, // 2^6 = 64 levels
  { min: 128, max: 255, capacity: 7 }, // 2^7 = 128 levels
] as const;

// Existing text conversion functions (unchanged)
const textToBinary = (text: string): string => {
  return text
    .split("")
    .map((char: string) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
};

const binaryToText = (binary: string): string => {
  const bytes: string[] = binary.match(/.{1,8}/g) || [];
  return bytes.map((byte: string) => String.fromCharCode(parseInt(byte, 2))).join("");
};

// Get range information based on pixel difference
const getRangeInfo = (diff: number): PVDRange => {
  const absDiff: number = Math.abs(diff);

  for (const range of PVD_RANGE_TABLE) {
    if (absDiff >= range.min && absDiff <= range.max) {
      return range;
    }
  }

  // Fallback to last range
  return PVD_RANGE_TABLE[PVD_RANGE_TABLE.length - 1];
};

// Generate pixel pairs based on location key
const generatePixelPairs = (locationKey: string, width: number, height: number): PixelPair[] => {
  const pairs: PixelPair[] = [];
  let seed: number = Array.from(locationKey).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

  // PRNG function
  const prng = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const maxPairs: number = Math.min(5000, Math.floor((width * height) / 8));

  for (let i = 0; i < maxPairs; i++) {
    const x1: number = Math.floor(prng() * (width - 1));
    const y1: number = Math.floor(prng() * height);
    const x2: number = Math.min(x1 + 1, width - 1); // Adjacent horizontal pixel
    const y2: number = y1;

    pairs.push({
      pos1: { x: x1, y: y1 },
      pos2: { x: x2, y: y2 },
    });
  }

  return pairs;
};

// Embed message bits into pixel pair using PVD algorithm
const embedInPixelPair = (pixel1: number, pixel2: number, messageBits: string, rangeInfo: PVDRange): PVDEmbedResult => {
  const diff: number = pixel1 - pixel2;

  // Convert message bits to decimal value
  const messageValue: number = parseInt(messageBits, 2);

  // Calculate new difference based on embedded message
  const newAbsDiff: number = rangeInfo.min + messageValue;
  const newDiff: number = diff >= 0 ? newAbsDiff : -newAbsDiff;

  // Calculate new pixel values to achieve target difference
  let newPixel1: number;
  let newPixel2: number;

  if (Math.abs(newDiff - diff) % 2 === 0) {
    // Adjust both pixels equally
    const adjustment: number = Math.floor((newDiff - diff) / 2);
    newPixel1 = pixel1 + adjustment;
    newPixel2 = pixel2 - adjustment;
  } else {
    // Adjust pixel1 by +1 more to handle odd differences
    const adjustment: number = Math.floor((newDiff - diff) / 2);
    newPixel1 = pixel1 + adjustment + Math.sign(newDiff - diff);
    newPixel2 = pixel2 - adjustment;
  }

  // Clamp pixel values to valid range [0, 255]
  newPixel1 = Math.max(0, Math.min(255, newPixel1));
  newPixel2 = Math.max(0, Math.min(255, newPixel2));

  return { newPixel1, newPixel2 };
};

// Extract message bits from pixel pair
const extractFromPixelPair = (pixel1: number, pixel2: number): string => {
  const diff: number = pixel1 - pixel2;
  const absDiff: number = Math.abs(diff);
  const rangeInfo: PVDRange = getRangeInfo(diff);

  // Calculate the embedded value
  const embeddedValue: number = absDiff - rangeInfo.min;

  // Convert to binary with proper padding
  const binaryValue: string = embeddedValue.toString(2).padStart(rangeInfo.capacity, "0");

  return binaryValue;
};

// PVD-based encoding algorithm
const encodePVDLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, messageBinary: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      // Generate pixel pairs berdasarkan location key
      const pixelPairs: PixelPair[] = generatePixelPairs(locationKey, canvas.width, canvas.height);

      // Prepare message with header and length
      const headerPattern: string = "1010101010101010";
      const lengthBinary: string = messageBinary.length.toString(2).padStart(16, "0");
      const totalMessage: string = headerPattern + lengthBinary + messageBinary;

      let messageIndex: number = 0;
      let processedPairs: number = 0;

      for (let pairIndex = 0; pairIndex < pixelPairs.length && messageIndex < totalMessage.length; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];
        const pos1: PixelPosition = pair.pos1;
        const pos2: PixelPosition = pair.pos2;

        // Get pixel indices (blue channel for consistency with LSB version)
        const pixelIndex1: number = (pos1.y * canvas.width + pos1.x) * 4 + 2;
        const pixelIndex2: number = (pos2.y * canvas.width + pos2.x) * 4 + 2;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        // Get embedding capacity for this pixel pair
        const diff: number = pixel1 - pixel2;
        const rangeInfo: PVDRange = getRangeInfo(diff);

        // Handle remaining bits if not enough message left
        if (messageIndex + rangeInfo.capacity > totalMessage.length) {
          const remainingBits: number = totalMessage.length - messageIndex;
          if (remainingBits > 0) {
            const messageBits: string = totalMessage.substring(messageIndex, messageIndex + remainingBits);
            const paddedBits: string = messageBits.padEnd(rangeInfo.capacity, "0");
            const result: PVDEmbedResult = embedInPixelPair(pixel1, pixel2, paddedBits, rangeInfo);

            data[pixelIndex1] = result.newPixel1;
            data[pixelIndex2] = result.newPixel2;
          }
          break;
        }

        // Extract message bits for this pair
        const messageBits: string = totalMessage.substring(messageIndex, messageIndex + rangeInfo.capacity);

        // Embed bits dalam pixel pair
        const result: PVDEmbedResult = embedInPixelPair(pixel1, pixel2, messageBits, rangeInfo);

        // Update pixel values
        data[pixelIndex1] = result.newPixel1;
        data[pixelIndex2] = result.newPixel2;

        messageIndex += rangeInfo.capacity;
        processedPairs++;

        // Update progress
        if (processedPairs % 50 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((messageIndex / totalMessage.length) * 100)));
        }
      }

      // Apply changes to canvas
      ctx.putImageData(imageData, 0, 0);

      if (onProgress) onProgress(100);
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// PVD-based decoding algorithm
const decodePVDLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      // Generate same pixel pairs using the location key
      const pixelPairs: PixelPair[] = generatePixelPairs(locationKey, canvas.width, canvas.height);

      let extractedBinary: string = "";
      let processedPairs: number = 0;

      // Extract header (16 bits) and message length (16 bits) first
      for (let pairIndex = 0; pairIndex < pixelPairs.length && extractedBinary.length < 32; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];
        const pos1: PixelPosition = pair.pos1;
        const pos2: PixelPosition = pair.pos2;

        // Get pixel values
        const pixelIndex1: number = (pos1.y * canvas.width + pos1.x) * 4 + 2;
        const pixelIndex2: number = (pos2.y * canvas.width + pos2.x) * 4 + 2;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        // Extract bits from this pair
        const extractedBits: string = extractFromPixelPair(pixel1, pixel2);
        extractedBinary += extractedBits;

        processedPairs++;
      }

      // Validate header pattern
      const header: string = extractedBinary.substring(0, 16);
      const expectedHeader: string = "1010101010101010";
      let headerMatch: number = 0;

      for (let i = 0; i < 16; i++) {
        if (header[i] === expectedHeader[i]) headerMatch++;
      }

      // If header doesn't match (less than 75%), wrong key
      if (headerMatch < 12) {
        resolve("");
        return;
      }

      // Extract message length
      const lengthBinary: string = extractedBinary.substring(16, 32);
      let messageLength: number = parseInt(lengthBinary, 2);

      // Validate message length
      if (isNaN(messageLength) || messageLength <= 0 || messageLength > 50000) {
        messageLength = Math.min(1000, (pixelPairs.length - processedPairs) * 3); // Fallback
      }

      // Extract the actual message
      const totalBitsNeeded: number = 32 + messageLength;

      for (let pairIndex = processedPairs; pairIndex < pixelPairs.length && extractedBinary.length < totalBitsNeeded; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];
        const pos1: PixelPosition = pair.pos1;
        const pos2: PixelPosition = pair.pos2;

        const pixelIndex1: number = (pos1.y * canvas.width + pos1.x) * 4 + 2;
        const pixelIndex2: number = (pos2.y * canvas.width + pos2.x) * 4 + 2;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        const extractedBits: string = extractFromPixelPair(pixel1, pixel2);
        extractedBinary += extractedBits;

        // Update progress
        if (pairIndex % 50 === 0 && onProgress) {
          onProgress(Math.floor((extractedBinary.length / totalBitsNeeded) * 100));
        }
      }

      // Extract actual message binary
      const messageBinary: string = extractedBinary.substring(32, 32 + messageLength);
      const extractedText: string = binaryToText(messageBinary);

      if (onProgress) onProgress(100);

      // Check for START/END markers
      const startIndex: number = extractedText.indexOf("START");
      const endIndex: number = extractedText.indexOf("END");

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        resolve(extractedText.substring(startIndex + 5, endIndex));
      } else {
        // Return cleaned text up to reasonable limit
        const cleanText: string = extractedText.replace(/[^\x20-\x7E]/g, ""); // Remove non-printable chars
        resolve(cleanText.substring(0, Math.min(200, cleanText.length)));
      }
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// Enhanced location key generation (unchanged from previous)
export const generateLocationKey = (latitude: number, longitude: number): string => {
  // Round coordinates to 3 decimal places (~100m grid)
  const gridLat: number = Math.round(latitude * 1000) / 1000;
  const gridLng: number = Math.round(longitude * 1000) / 1000;

  // Create deterministic seed from coordinates
  const locationSeed: string = `${gridLat},${gridLng}`;

  // Simple hash implementation
  let hash: number = 0;
  for (let i = 0; i < locationSeed.length; i++) {
    const char: number = locationSeed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Generate key with allowed characters
  const chars: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key: string = "";

  // Ensure hash is always positive
  const positiveHash: number = Math.abs(hash);

  // Generate deterministic key
  for (let i = 0; i < 16; i++) {
    const position: number = (positiveHash + i * 13) % chars.length;
    key += chars.charAt(position);
  }

  return key;
};

// Main encode function with PVD
export const encodeMessage = (imageDataUrl: string, message: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      // Input validation
      if (!imageDataUrl || !message || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar, pesan, dan kunci lokasi diperlukan"));
        return;
      }

      // Log for debugging
      console.log("PVD Encoding with:", {
        messageLength: message.length,
        keyLength: locationKey.length,
        algorithm: "PVD",
      });

      const image: HTMLImageElement = new Image();

      image.onload = (): void => {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Tidak dapat membuat context canvas"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        // Convert message to binary with START/END markers
        const messageBinary: string = textToBinary("START" + message + "END");
        console.log("Binary message length:", messageBinary.length);

        // Use PVD algorithm for encoding
        encodePVDLocationBased(canvas, ctx, messageBinary, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (): void => {
        console.error("Image load error");
        reject(new Error("Gagal memuat gambar"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      console.error("Encoding error:", error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// Main decode function with PVD
export const decodeMessage = (imageDataUrl: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      // Input validation
      if (!imageDataUrl || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar dan kunci lokasi diperlukan"));
        return;
      }

      // Log for debugging
      console.log("PVD Decoding with:", {
        keyLength: locationKey.length,
        algorithm: "PVD",
      });

      const image: HTMLImageElement = new Image();

      image.onload = (): void => {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Tidak dapat membuat context canvas"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        // Use PVD algorithm for decoding
        decodePVDLocationBased(canvas, ctx, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (): void => {
        console.error("Image load error");
        reject(new Error("Gagal memuat gambar"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      console.error("Decoding error:", error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

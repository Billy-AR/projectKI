import type { PixelPosition, ProgressCallback, PVDRange, PixelPair, PVDEmbedResult } from "../Types";

// PVD Range Table yang diperbaiki
const PVD_RANGE_TABLE: readonly PVDRange[] = [
  { min: 0, max: 7, capacity: 3 }, // 0-7: 3 bits
  { min: 8, max: 15, capacity: 3 }, // 8-15: 3 bits
  { min: 16, max: 31, capacity: 4 }, // 16-31: 4 bits
  { min: 32, max: 63, capacity: 5 }, // 32-63: 5 bits
  { min: 64, max: 127, capacity: 6 }, // 64-127: 6 bits
  { min: 128, max: 255, capacity: 7 }, // 128-255: 7 bits
] as const;

// Text conversion functions
const textToBinary = (text: string): string => {
  return text
    .split("")
    .map((char: string) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");
};

const binaryToText = (binary: string): string => {
  const bytes: string[] = binary.match(/.{1,8}/g) || [];
  return bytes
    .map((byte: string) => {
      const charCode = parseInt(byte, 2);
      // Filter non-printable characters
      if (charCode >= 32 && charCode <= 126) {
        return String.fromCharCode(charCode);
      }
      return "";
    })
    .join("");
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

// Generate pixel pairs berdasarkan location key
const generatePixelPairs = (locationKey: string, width: number, height: number): PixelPair[] => {
  const pairs: PixelPair[] = [];
  let seed: number = Array.from(locationKey).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

  // PRNG function yang sama dengan LSB version
  const prng = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const maxPairs: number = Math.min(8000, Math.floor((width * height) / 4));

  for (let i = 0; i < maxPairs; i++) {
    const x1: number = Math.floor(prng() * (width - 1));
    const y1: number = Math.floor(prng() * height);

    // Ensure adjacent pixel is within bounds
    const x2: number = Math.min(x1 + 1, width - 1);
    const y2: number = y1;

    // Skip if pixels are the same
    if (x1 !== x2) {
      pairs.push({
        pos1: { x: x1, y: y1 },
        pos2: { x: x2, y: y2 },
      });
    }
  }

  return pairs;
};

// PVD Embedding Function - DIPERBAIKI
const embedInPixelPair = (pixel1: number, pixel2: number, messageBits: string, rangeInfo: PVDRange): PVDEmbedResult => {
  const originalDiff: number = pixel1 - pixel2;
  const isPositive: boolean = originalDiff >= 0;

  // Convert message bits to decimal
  const messageValue: number = parseInt(messageBits, 2);

  // Calculate new absolute difference
  const newAbsDiff: number = rangeInfo.min + messageValue;

  // Calculate target difference (maintain sign)
  const targetDiff: number = isPositive ? newAbsDiff : -newAbsDiff;

  // Calculate adjustment needed
  const adjustment: number = targetDiff - originalDiff;

  // Distribute adjustment between pixels
  let newPixel1: number = pixel1;
  let newPixel2: number = pixel2;

  if (Math.abs(adjustment) <= 1) {
    // Small adjustment - modify one pixel
    if (adjustment > 0) {
      newPixel1 = pixel1 + 1;
    } else if (adjustment < 0) {
      newPixel1 = pixel1 - 1;
    }
  } else {
    // Larger adjustment - distribute between both pixels
    const halfAdjust: number = Math.floor(Math.abs(adjustment) / 2);
    if (adjustment > 0) {
      newPixel1 = pixel1 + halfAdjust;
      newPixel2 = pixel2 - (Math.abs(adjustment) - halfAdjust);
    } else {
      newPixel1 = pixel1 - halfAdjust;
      newPixel2 = pixel2 + (Math.abs(adjustment) - halfAdjust);
    }
  }

  // Ensure pixel values are in valid range [0, 255]
  newPixel1 = Math.max(0, Math.min(255, newPixel1));
  newPixel2 = Math.max(0, Math.min(255, newPixel2));

  // Verify the new difference
  const actualDiff: number = newPixel1 - newPixel2;

  return {
    newPixel1,
    newPixel2,
    actualDiff,
  };
};

// PVD Extraction Function - DIPERBAIKI
const extractFromPixelPair = (pixel1: number, pixel2: number): string => {
  const diff: number = pixel1 - pixel2;
  const absDiff: number = Math.abs(diff);
  const rangeInfo: PVDRange = getRangeInfo(diff);

  // Extract embedded value
  const embeddedValue: number = Math.max(0, absDiff - rangeInfo.min);

  // Ensure embedded value doesn't exceed capacity
  const maxValue: number = Math.pow(2, rangeInfo.capacity) - 1;
  const clampedValue: number = Math.min(embeddedValue, maxValue);

  // Convert to binary with proper padding
  const binaryValue: string = clampedValue.toString(2).padStart(rangeInfo.capacity, "0");

  return binaryValue;
};

// PVD-based encoding algorithm - DIPERBAIKI
const encodePVDLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, messageBinary: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      // Generate pixel pairs berdasarkan location key
      const pixelPairs: PixelPair[] = generatePixelPairs(locationKey, canvas.width, canvas.height);

      if (pixelPairs.length === 0) {
        reject(new Error("Tidak dapat menggenerate pixel pairs"));
        return;
      }

      // Prepare message dengan header dan length
      const headerPattern: string = "1010101010101010";
      const lengthBinary: string = messageBinary.length.toString(2).padStart(16, "0");
      const totalMessage: string = headerPattern + lengthBinary + messageBinary;

      let messageIndex: number = 0;
      let processedPairs: number = 0;
      let totalCapacity: number = 0;

      // Calculate total capacity available
      for (let i = 0; i < Math.min(pixelPairs.length, 100); i++) {
        const pair = pixelPairs[i];
        const pixelIndex1 = (pair.pos1.y * canvas.width + pair.pos1.x) * 4 + 2;
        const pixelIndex2 = (pair.pos2.y * canvas.width + pair.pos2.x) * 4 + 2;
        const pixel1 = data[pixelIndex1];
        const pixel2 = data[pixelIndex2];
        const diff = pixel1 - pixel2;
        const rangeInfo = getRangeInfo(diff);
        totalCapacity += rangeInfo.capacity;
      }

      console.log(`Total message bits: ${totalMessage.length}, Estimated capacity: ${totalCapacity * (pixelPairs.length / 100)}`);

      // Embed message
      for (let pairIndex = 0; pairIndex < pixelPairs.length && messageIndex < totalMessage.length; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];
        const pos1: PixelPosition = pair.pos1;
        const pos2: PixelPosition = pair.pos2;

        // Get pixel indices (blue channel)
        const pixelIndex1: number = (pos1.y * canvas.width + pos1.x) * 4 + 2;
        const pixelIndex2: number = (pos2.y * canvas.width + pos2.x) * 4 + 2;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        // Get embedding capacity for this pixel pair
        const diff: number = pixel1 - pixel2;
        const rangeInfo: PVDRange = getRangeInfo(diff);

        // Handle remaining bits
        const remainingBits: number = totalMessage.length - messageIndex;
        if (remainingBits <= 0) break;

        const bitsToEmbed: number = Math.min(rangeInfo.capacity, remainingBits);
        const messageBits: string = totalMessage.substring(messageIndex, messageIndex + bitsToEmbed);
        const paddedBits: string = messageBits.padEnd(rangeInfo.capacity, "0");

        // Embed bits dalam pixel pair
        const result: PVDEmbedResult = embedInPixelPair(pixel1, pixel2, paddedBits, rangeInfo);

        // Update pixel values
        data[pixelIndex1] = result.newPixel1;
        data[pixelIndex2] = result.newPixel2;

        messageIndex += bitsToEmbed;
        processedPairs++;

        // Update progress
        if (processedPairs % 100 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((messageIndex / totalMessage.length) * 100)));
        }
      }

      console.log(`Embedded ${messageIndex} bits in ${processedPairs} pairs`);

      // Apply changes to canvas
      ctx.putImageData(imageData, 0, 0);

      if (onProgress) onProgress(100);
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error("PVD Encoding error:", error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// PVD-based decoding algorithm - DIPERBAIKI
const decodePVDLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      // Generate same pixel pairs using the location key
      const pixelPairs: PixelPair[] = generatePixelPairs(locationKey, canvas.width, canvas.height);

      if (pixelPairs.length === 0) {
        resolve("");
        return;
      }

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

      console.log(`Header match: ${headerMatch}/16`);

      // If header doesn't match (less than 75%), wrong key
      if (headerMatch < 12) {
        console.log("Header validation failed");
        resolve("");
        return;
      }

      // Extract message length
      const lengthBinary: string = extractedBinary.substring(16, 32);
      let messageLength: number = parseInt(lengthBinary, 2);

      console.log(`Message length: ${messageLength} bits`);

      // Validate message length
      if (isNaN(messageLength) || messageLength <= 0 || messageLength > 50000) {
        console.log("Invalid message length, using fallback");
        messageLength = Math.min(2000, (pixelPairs.length - processedPairs) * 4);
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
        if (pairIndex % 100 === 0 && onProgress) {
          onProgress(Math.floor((extractedBinary.length / totalBitsNeeded) * 100));
        }
      }

      // Extract actual message binary
      const messageBinary: string = extractedBinary.substring(32, 32 + messageLength);
      const extractedText: string = binaryToText(messageBinary);

      console.log(`Extracted text length: ${extractedText.length}`);

      if (onProgress) onProgress(100);

      // Check for START/END markers
      const startIndex: number = extractedText.indexOf("START");
      const endIndex: number = extractedText.indexOf("END");

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        const finalMessage = extractedText.substring(startIndex + 5, endIndex);
        console.log(`Final message: "${finalMessage}"`);
        resolve(finalMessage);
      } else {
        // Clean up text and return reasonable portion
        const cleanText: string = extractedText
          .replace(/[^\x20-\x7E]/g, "") // Remove non-printable characters
          .trim();

        console.log(`Cleaned text: "${cleanText}"`);
        resolve(cleanText.substring(0, Math.min(500, cleanText.length)));
      }
    } catch (error) {
      console.error("PVD Decoding error:", error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// Location key generation function (unchanged)
export const generateLocationKey = (latitude: number, longitude: number): string => {
  const gridLat: number = Math.round(latitude * 1000) / 1000;
  const gridLng: number = Math.round(longitude * 1000) / 1000;
  const locationSeed: string = `${gridLat},${gridLng}`;

  let hash: number = 0;
  for (let i = 0; i < locationSeed.length; i++) {
    const char: number = locationSeed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  const chars: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key: string = "";
  const positiveHash: number = Math.abs(hash);

  for (let i = 0; i < 16; i++) {
    const position: number = (positiveHash + i * 13) % chars.length;
    key += chars.charAt(position);
  }

  return key;
};

// Main encode function dengan PVD
export const encodeMessage = (imageDataUrl: string, message: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      if (!imageDataUrl || !message || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar, pesan, dan kunci lokasi diperlukan"));
        return;
      }

      console.log("PVD Encoding:", {
        messageLength: message.length,
        keyLength: locationKey.length,
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

        const messageBinary: string = textToBinary("START" + message + "END");

        encodePVDLocationBased(canvas, ctx, messageBinary, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (): void => {
        reject(new Error("Gagal memuat gambar"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// Main decode function dengan PVD
export const decodeMessage = (imageDataUrl: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      if (!imageDataUrl || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar dan kunci lokasi diperlukan"));
        return;
      }

      console.log("PVD Decoding:", { keyLength: locationKey.length });

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

        decodePVDLocationBased(canvas, ctx, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (): void => {
        reject(new Error("Gagal memuat gambar"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

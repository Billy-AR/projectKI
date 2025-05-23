import type { ProgressCallback, PVDRange, PixelPair, PVDEmbedResult } from "../Types";

// Simplified and proven PVD Range Table
const PVD_RANGE_TABLE: readonly PVDRange[] = [
  { min: 0, max: 7, capacity: 3 }, // Very smooth
  { min: 8, max: 15, capacity: 3 }, // Smooth
  { min: 16, max: 31, capacity: 4 }, // Medium
  { min: 32, max: 63, capacity: 4 }, // Edge
  { min: 64, max: 127, capacity: 5 }, // High edge
  { min: 128, max: 255, capacity: 5 }, // Very high edge
] as const;

// Simple text conversion
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
      if (charCode >= 32 && charCode <= 126) {
        return String.fromCharCode(charCode);
      }
      return "";
    })
    .join("")
    .replace(/\0/g, ""); // Remove null characters
};

// Get range info for difference
const getRangeInfo = (diff: number): PVDRange => {
  const absDiff: number = Math.abs(diff);

  for (const range of PVD_RANGE_TABLE) {
    if (absDiff >= range.min && absDiff <= range.max) {
      return range;
    }
  }

  return PVD_RANGE_TABLE[PVD_RANGE_TABLE.length - 1];
};

// FIXED: Simple sequential pixel pair generation based on location key
const generatePixelPairs = (locationKey: string, width: number, height: number): PixelPair[] => {
  const pairs: PixelPair[] = [];

  // Create simple hash from location key
  let seed: number = 0;
  for (let i = 0; i < locationKey.length; i++) {
    seed = (seed + locationKey.charCodeAt(i) * (i + 1)) % 65536;
  }

  // Simple deterministic pattern - scan line with fixed step
  const step = Math.max(2, (seed % 5) + 2); // Step between 2-6
  const startX = seed % Math.min(10, width - 1);
  const startY = (seed >> 4) % Math.min(10, height);

  console.log(`Pixel generation: seed=${seed}, step=${step}, start=(${startX},${startY})`);

  // Generate pairs in scan-line order with fixed step
  for (let y = startY; y < height; y += step) {
    for (let x = startX; x < width - 1; x += step) {
      if (x < width - 1 && y < height) {
        pairs.push({
          pos1: { x: x, y: y },
          pos2: { x: x + 1, y: y }, // Always horizontal neighbor
        });
      }

      // Limit pairs to prevent memory issues
      if (pairs.length >= 5000) break;
    }
    if (pairs.length >= 5000) break;
  }

  console.log(`Generated ${pairs.length} consistent pixel pairs`);
  return pairs;
};

// FIXED: Conservative embedding function
const embedInPixelPair = (pixel1: number, pixel2: number, messageBits: string, rangeInfo: PVDRange): PVDEmbedResult => {
  const originalDiff: number = pixel1 - pixel2;
  const isPositive: boolean = originalDiff >= 0;

  // Convert message to value
  const messageValue: number = parseInt(messageBits, 2);

  // Calculate new difference
  const newAbsDiff: number = rangeInfo.min + messageValue;
  const targetDiff: number = isPositive ? newAbsDiff : -newAbsDiff;

  // Calculate adjustment needed
  const adjustment: number = targetDiff - originalDiff;

  // Conservative adjustment - modify only first pixel if possible
  let newPixel1: number = pixel1;
  let newPixel2: number = pixel2;

  if (pixel1 + adjustment >= 0 && pixel1 + adjustment <= 255) {
    // Modify first pixel only
    newPixel1 = pixel1 + adjustment;
  } else {
    // Distribute adjustment
    const half = Math.floor(adjustment / 2);
    newPixel1 = Math.max(0, Math.min(255, pixel1 + half));
    newPixel2 = Math.max(0, Math.min(255, pixel2 - (adjustment - half)));
  }

  return {
    newPixel1,
    newPixel2,
    actualDiff: newPixel1 - newPixel2,
  };
};

// FIXED: Extraction function
const extractFromPixelPair = (pixel1: number, pixel2: number): string => {
  const diff: number = pixel1 - pixel2;
  const absDiff: number = Math.abs(diff);
  const rangeInfo: PVDRange = getRangeInfo(diff);

  // Extract value
  const embeddedValue: number = Math.max(0, absDiff - rangeInfo.min);
  const maxValue: number = Math.pow(2, rangeInfo.capacity) - 1;
  const clampedValue: number = Math.min(embeddedValue, maxValue);

  return clampedValue.toString(2).padStart(rangeInfo.capacity, "0");
};

// FIXED: Simple header validation
const validateHeader = (extractedBinary: string): { valid: boolean; matchPercent: number } => {
  if (extractedBinary.length < 16) return { valid: false, matchPercent: 0 };

  const header: string = extractedBinary.substring(0, 16);
  const expectedHeader: string = "1111000011110000"; // Simpler pattern

  let matches = 0;
  for (let i = 0; i < 16; i++) {
    if (header[i] === expectedHeader[i]) matches++;
  }

  const matchPercent = (matches / 16) * 100;
  return { valid: matchPercent >= 75, matchPercent };
};

// FIXED: Simplified encoding
const encodePVDLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, messageBinary: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      // Generate consistent pixel pairs
      const pixelPairs: PixelPair[] = generatePixelPairs(locationKey, canvas.width, canvas.height);

      if (pixelPairs.length === 0) {
        reject(new Error("Cannot generate pixel pairs"));
        return;
      }

      // Simple message format: header + length + message
      const headerPattern: string = "1111000011110000"; // 16 bits
      const lengthBinary: string = messageBinary.length.toString(2).padStart(16, "0"); // 16 bits
      const totalMessage: string = headerPattern + lengthBinary + messageBinary;

      console.log(`Encoding: ${totalMessage.length} bits total (${messageBinary.length} message bits)`);

      // Calculate rough capacity
      let estimatedCapacity = pixelPairs.length * 4; // Average 4 bits per pair

      if (totalMessage.length > estimatedCapacity) {
        reject(new Error(`Message too large. Capacity: ~${Math.floor(estimatedCapacity / 8)} characters`));
        return;
      }

      // Embed message
      let messageIndex: number = 0;
      let processedPairs: number = 0;

      for (let pairIndex = 0; pairIndex < pixelPairs.length && messageIndex < totalMessage.length; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];

        // Use blue channel only for consistency
        const pixelIndex1: number = (pair.pos1.y * canvas.width + pair.pos1.x) * 4 + 2;
        const pixelIndex2: number = (pair.pos2.y * canvas.width + pair.pos2.x) * 4 + 2;

        if (pixelIndex1 >= data.length || pixelIndex2 >= data.length) continue;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        // Get capacity for this pair
        const diff: number = pixel1 - pixel2;
        const rangeInfo: PVDRange = getRangeInfo(diff);

        const remainingBits: number = totalMessage.length - messageIndex;
        if (remainingBits <= 0) break;

        const bitsToEmbed: number = Math.min(rangeInfo.capacity, remainingBits);
        const messageBits: string = totalMessage.substring(messageIndex, messageIndex + bitsToEmbed);
        const paddedBits: string = messageBits.padEnd(rangeInfo.capacity, "0");

        // Embed
        const result: PVDEmbedResult = embedInPixelPair(pixel1, pixel2, paddedBits, rangeInfo);

        data[pixelIndex1] = result.newPixel1;
        data[pixelIndex2] = result.newPixel2;

        messageIndex += bitsToEmbed;
        processedPairs++;

        // Progress
        if (processedPairs % 50 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((messageIndex / totalMessage.length) * 100)));
        }
      }

      console.log(`Embedded ${messageIndex}/${totalMessage.length} bits in ${processedPairs} pairs`);

      if (messageIndex < totalMessage.length) {
        reject(new Error(`Could not embed complete message. Missing ${totalMessage.length - messageIndex} bits.`));
        return;
      }

      // Apply changes
      ctx.putImageData(imageData, 0, 0);

      if (onProgress) onProgress(100);
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      console.error("Encoding error:", error);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// FIXED: Simplified decoding
const decodePVDLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve) => {
    try {
      const imageData: ImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data: Uint8ClampedArray = imageData.data;

      // Generate same pixel pairs with same parameters
      const pixelPairs: PixelPair[] = generatePixelPairs(locationKey, canvas.width, canvas.height);

      if (pixelPairs.length === 0) {
        resolve("");
        return;
      }

      console.log(`Decoding with ${pixelPairs.length} pixel pairs`);

      let extractedBinary: string = "";
      let processedPairs: number = 0;

      // Extract header and length (32 bits total)
      for (let pairIndex = 0; pairIndex < pixelPairs.length && extractedBinary.length < 32; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];

        const pixelIndex1: number = (pair.pos1.y * canvas.width + pair.pos1.x) * 4 + 2;
        const pixelIndex2: number = (pair.pos2.y * canvas.width + pair.pos2.x) * 4 + 2;

        if (pixelIndex1 >= data.length || pixelIndex2 >= data.length) continue;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        const extractedBits: string = extractFromPixelPair(pixel1, pixel2);
        extractedBinary += extractedBits;
        processedPairs++;
      }

      // Validate header
      const { valid: headerValid, matchPercent } = validateHeader(extractedBinary);
      console.log(`Header validation: ${matchPercent.toFixed(1)}% match`);

      if (!headerValid) {
        console.log("Invalid header - wrong location key or no message");
        resolve("");
        return;
      }

      // Extract message length
      if (extractedBinary.length < 32) {
        console.log("Insufficient header data");
        resolve("");
        return;
      }

      const lengthBinary: string = extractedBinary.substring(16, 32);
      const messageLength: number = parseInt(lengthBinary, 2);

      console.log(`Message length: ${messageLength} bits`);

      if (isNaN(messageLength) || messageLength <= 0 || messageLength > 50000) {
        console.log("Invalid message length");
        resolve("");
        return;
      }

      // Extract message data
      const totalBitsNeeded: number = 32 + messageLength;

      for (let pairIndex = processedPairs; pairIndex < pixelPairs.length && extractedBinary.length < totalBitsNeeded; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];

        const pixelIndex1: number = (pair.pos1.y * canvas.width + pair.pos1.x) * 4 + 2;
        const pixelIndex2: number = (pair.pos2.y * canvas.width + pair.pos2.x) * 4 + 2;

        if (pixelIndex1 >= data.length || pixelIndex2 >= data.length) continue;

        const pixel1: number = data[pixelIndex1];
        const pixel2: number = data[pixelIndex2];

        const extractedBits: string = extractFromPixelPair(pixel1, pixel2);
        extractedBinary += extractedBits;

        // Progress
        if (pairIndex % 50 === 0 && onProgress) {
          onProgress(Math.floor((extractedBinary.length / totalBitsNeeded) * 100));
        }
      }

      if (extractedBinary.length < totalBitsNeeded) {
        console.log(`Insufficient data: ${extractedBinary.length}/${totalBitsNeeded} bits`);
        resolve("");
        return;
      }

      // Extract message
      const messageBinary: string = extractedBinary.substring(32, 32 + messageLength);
      let extractedText: string = binaryToText(messageBinary);

      console.log(`Extracted raw text: "${extractedText}"`);

      if (onProgress) onProgress(100);

      // Look for START/END markers
      const startIndex: number = extractedText.indexOf("START");
      const endIndex: number = extractedText.indexOf("END");

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        const finalMessage = extractedText.substring(startIndex + 5, endIndex);
        console.log(`Final message: "${finalMessage}"`);
        resolve(finalMessage);
      } else {
        // Clean and return
        extractedText = extractedText.trim();
        if (extractedText.length > 0) {
          console.log(`Returning cleaned text: "${extractedText}"`);
          resolve(extractedText);
        } else {
          console.log("No valid text found");
          resolve("");
        }
      }
    } catch (error) {
      console.error("Decoding error:", error);
      resolve("");
    }
  });
};

// Location key generation - simplified
export const generateLocationKey = (latitude: number, longitude: number): string => {
  const gridLat: number = Math.round(latitude * 1000) / 1000;
  const gridLng: number = Math.round(longitude * 1000) / 1000;
  const locationSeed: string = `${gridLat.toFixed(3)},${gridLng.toFixed(3)}`;

  let hash: number = 0;
  for (let i = 0; i < locationSeed.length; i++) {
    const char: number = locationSeed.charCodeAt(i);
    hash = ((hash << 5) - hash + char) & 0xffffffff;
  }

  const chars: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key: string = "";
  const positiveHash: number = Math.abs(hash) || 1;

  for (let i = 0; i < 16; i++) {
    const position: number = (positiveHash + i * 31) % chars.length;
    key += chars.charAt(position);
  }

  return key;
};

// Main encode function - simplified
export const encodeMessage = (imageDataUrl: string, message: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      if (!imageDataUrl || !message || !locationKey) {
        reject(new Error("Missing required parameters"));
        return;
      }

      console.log("Encoding with PVD:", {
        messageLength: message.length,
        locationKey: locationKey.substring(0, 8) + "...",
      });

      const image: HTMLImageElement = new Image();

      image.onload = (): void => {
        if (image.width < 100 || image.height < 100) {
          reject(new Error("Image too small. Minimum 100x100 pixels required."));
          return;
        }

        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Cannot create canvas context"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        // Add START/END markers
        const messageBinary: string = textToBinary("START" + message + "END");

        encodePVDLocationBased(canvas, ctx, messageBinary, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (): void => {
        reject(new Error("Failed to load image"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
};

// Main decode function - simplified
export const decodeMessage = (imageDataUrl: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      if (!imageDataUrl || !locationKey) {
        reject(new Error("Missing required parameters"));
        return;
      }

      console.log("Decoding with PVD:", {
        locationKey: locationKey.substring(0, 8) + "...",
      });

      const image: HTMLImageElement = new Image();

      image.onload = (): void => {
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

        if (!ctx) {
          resolve("");
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        decodePVDLocationBased(canvas, ctx, locationKey, onProgress)
          .then(resolve)
          .catch(() => resolve(""));
      };

      image.onerror = (): void => {
        resolve("");
      };

      image.src = imageDataUrl;
    } catch (error) {
      console.error("Decode error:", error);
      resolve("");
    }
  });
};

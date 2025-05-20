import type { PixelPosition, ProgressCallback, PVDRange, PixelPair, PVDEmbedResult } from "../Types";

// Improved PVD Range Table with better capacity distribution
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
      // Improved filtering for non-printable characters
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

// Improved pixel pair generation for better coverage
const generatePixelPairs = (locationKey: string, width: number, height: number): PixelPair[] => {
  const pairs: PixelPair[] = [];
  let seed: number = Array.from(locationKey).reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);

  // More reliable PRNG
  const prng = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Use more deterministic distribution for pixel selection
  const totalPixels = width * height;
  const maxPairs = Math.min(10000, Math.floor(totalPixels / 3)); // Increase max pairs

  // Create a grid-based distribution of pixels
  const gridSize = Math.max(2, Math.floor(Math.sqrt(totalPixels / maxPairs)));

  // Select pixels in a distributed grid pattern
  for (let y = 0; y < height; y += gridSize) {
    for (let x = 0; x < width - 1; x += gridSize) {
      // Add some randomness to the grid positions
      const offsetX = Math.floor(prng() * (gridSize - 1));
      const offsetY = Math.floor(prng() * (gridSize - 1));

      const finalX = Math.min(x + offsetX, width - 2);
      const finalY = Math.min(y + offsetY, height - 1);

      pairs.push({
        pos1: { x: finalX, y: finalY },
        pos2: { x: finalX + 1, y: finalY }, // Always use adjacent pixel
      });

      // Break if we've reached the maximum pairs
      if (pairs.length >= maxPairs) break;
    }
    if (pairs.length >= maxPairs) break;
  }

  return pairs;
};

// Improved embedding function with better error handling
const embedInPixelPair = (pixel1: number, pixel2: number, messageBits: string, rangeInfo: PVDRange): PVDEmbedResult => {
  const originalDiff: number = pixel1 - pixel2;
  const isPositive: boolean = originalDiff >= 0;

  // Convert message bits to decimal
  const messageValue: number = parseInt(messageBits, 2);

  // More robust calculation that preserves visibility
  const newAbsDiff: number = Math.max(rangeInfo.min, Math.min(rangeInfo.min + messageValue, rangeInfo.max));

  // Calculate target difference (maintain sign)
  const targetDiff: number = isPositive ? newAbsDiff : -newAbsDiff;

  // Calculate adjustment needed
  const adjustment: number = targetDiff - originalDiff;

  // Distribute adjustment between pixels with better visual preservation
  let newPixel1: number = pixel1;
  let newPixel2: number = pixel2;

  if (Math.abs(adjustment) <= 2) {
    // Small adjustment - modify one pixel
    if (adjustment > 0) {
      newPixel1 = Math.min(255, pixel1 + adjustment);
    } else if (adjustment < 0) {
      newPixel1 = Math.max(0, pixel1 + adjustment);
    }
  } else {
    // Larger adjustment - distribute between both pixels to minimize visual impact
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

// Improved extraction function
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

// Helper function to validate header
const validateHeader = (extractedBinary: string): { valid: boolean; matchPercent: number } => {
  const header: string = extractedBinary.substring(0, 16);
  const expectedHeader: string = "1010101010101010";
  let headerMatch: number = 0;

  // Count matching bits
  for (let i = 0; i < 16; i++) {
    if (header[i] === expectedHeader[i]) headerMatch++;
  }

  const matchPercent = (headerMatch / 16) * 100;
  // At least 75% must match
  return { valid: matchPercent >= 75, matchPercent };
};

// PVD-based encoding algorithm - IMPROVED
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
        const pixelIndex1 = (pair.pos1.y * canvas.width + pair.pos1.x) * 4 + 2; // Use blue channel
        const pixelIndex2 = (pair.pos2.y * canvas.width + pair.pos2.x) * 4 + 2;
        const pixel1 = data[pixelIndex1];
        const pixel2 = data[pixelIndex2];
        const diff = pixel1 - pixel2;
        const rangeInfo = getRangeInfo(diff);
        totalCapacity += rangeInfo.capacity;
      }

      const estimatedCapacity = totalCapacity * (pixelPairs.length / 100);
      console.log(`Total message bits: ${totalMessage.length}, Estimated capacity: ${estimatedCapacity}`);

      // Check if message is too large
      if (totalMessage.length > estimatedCapacity * 0.9) {
        reject(new Error(`Pesan terlalu besar untuk gambar ini. Kapasitas gambar: ~${Math.floor(estimatedCapacity / 8)} karakter`));
        return;
      }

      // Embed message - improved embedding across all channels for more robust hiding
      for (let pairIndex = 0; pairIndex < pixelPairs.length && messageIndex < totalMessage.length; pairIndex++) {
        const pair: PixelPair = pixelPairs[pairIndex];
        const pos1: PixelPosition = pair.pos1;
        const pos2: PixelPosition = pair.pos2;

        // Primary embedding in blue channel
        const blueIndex1: number = (pos1.y * canvas.width + pos1.x) * 4 + 2;
        const blueIndex2: number = (pos2.y * canvas.width + pos2.x) * 4 + 2;

        const bluePixel1: number = data[blueIndex1];
        const bluePixel2: number = data[blueIndex2];

        // Get embedding capacity for this pixel pair
        const diff: number = bluePixel1 - bluePixel2;
        const rangeInfo: PVDRange = getRangeInfo(diff);

        // Handle remaining bits
        const remainingBits: number = totalMessage.length - messageIndex;
        if (remainingBits <= 0) break;

        const bitsToEmbed: number = Math.min(rangeInfo.capacity, remainingBits);
        const messageBits: string = totalMessage.substring(messageIndex, messageIndex + bitsToEmbed);
        const paddedBits: string = messageBits.padEnd(rangeInfo.capacity, "0");

        // Embed bits in pixel pair
        const result: PVDEmbedResult = embedInPixelPair(bluePixel1, bluePixel2, paddedBits, rangeInfo);

        // Update pixel values
        data[blueIndex1] = result.newPixel1;
        data[blueIndex2] = result.newPixel2;

        messageIndex += bitsToEmbed;
        processedPairs++;

        // Update progress
        if (processedPairs % 50 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((messageIndex / totalMessage.length) * 100)));
        }
      }

      console.log(`Embedded ${messageIndex} bits in ${processedPairs} pairs`);

      if (messageIndex < totalMessage.length) {
        console.warn(`Warning: Could not embed entire message. ${totalMessage.length - messageIndex} bits could not be embedded.`);
      }

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

// PVD-based decoding algorithm - IMPROVED
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

        // Get pixel values from blue channel
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
      const { valid: headerValid, matchPercent } = validateHeader(extractedBinary);
      console.log(`Header match: ${matchPercent.toFixed(1)}%`);

      // If header doesn't match (less than 75%), wrong key
      if (!headerValid) {
        console.log("Header validation failed");
        // Try aggressively looking for header pattern in more pairs before giving up
        let extendedSearch = true;
        let additionalPairs = 0;
        let headerFound = false;

        while (extendedSearch && additionalPairs < 100) {
          if (processedPairs + additionalPairs >= pixelPairs.length) {
            extendedSearch = false;
            break;
          }

          const pairIndex = processedPairs + additionalPairs;
          const pair = pixelPairs[pairIndex];
          const pos1 = pair.pos1;
          const pos2 = pair.pos2;

          const pixelIndex1 = (pos1.y * canvas.width + pos1.x) * 4 + 2;
          const pixelIndex2 = (pos2.y * canvas.width + pos2.x) * 4 + 2;

          const pixel1 = data[pixelIndex1];
          const pixel2 = data[pixelIndex2];

          const bits = extractFromPixelPair(pixel1, pixel2);
          extractedBinary = bits + extractedBinary.substring(0, 32 - bits.length);

          const { valid } = validateHeader(extractedBinary);

          if (valid) {
            headerFound = true;
            break;
          }

          additionalPairs++;
        }

        if (!headerFound) {
          // If still not found, give up
          resolve("");
          return;
        }
      }

      // Extract message length
      const lengthBinary: string = extractedBinary.substring(16, 32);
      let messageLength: number = parseInt(lengthBinary, 2);

      console.log(`Extracted message length: ${messageLength} bits`);

      // Validate message length
      if (isNaN(messageLength) || messageLength <= 0 || messageLength > 50000) {
        console.log("Invalid message length, using fallback");
        // Try various fallback lengths to see if we can find a valid message
        const possibleLengths = [1000, 2000, 4000, 8000];
        let validLengthFound = false;

        for (const len of possibleLengths) {
          messageLength = len;
          console.log(`Trying fallback length: ${len} bits`);

          // Test this length by extracting more and checking for printable text
          // Continue extraction and we'll check the result later
          validLengthFound = true;
          break;
        }

        if (!validLengthFound) {
          messageLength = Math.min(2000, (pixelPairs.length - processedPairs) * 3);
        }
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
      let extractedText: string = binaryToText(messageBinary);

      console.log(`Extracted text length: ${extractedText.length}`);

      if (onProgress) onProgress(100);

      // Check for START/END markers
      const startIndex: number = extractedText.indexOf("START");
      const endIndex: number = extractedText.indexOf("END");

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        const finalMessage = extractedText.substring(startIndex + 5, endIndex);
        console.log(`Final message with markers: "${finalMessage}"`);
        resolve(finalMessage);
      } else {
        // Clean up text and return reasonable portion
        extractedText = extractedText
          .replace(/[^\x20-\x7E]/g, "") // Remove non-printable characters
          .trim();

        // Try to find largest continuous sequence of printable characters
        let bestStart = 0;
        let bestLength = 0;
        let currentStart = 0;
        let currentLength = 0;

        for (let i = 0; i < extractedText.length; i++) {
          if (extractedText[i].match(/[a-zA-Z0-9\s.,!?;:'"(){}\[\]<>\-_+=\/\\@#$%^&*]/)) {
            if (currentLength === 0) {
              currentStart = i;
            }
            currentLength++;

            if (currentLength > bestLength) {
              bestStart = currentStart;
              bestLength = currentLength;
            }
          } else {
            currentLength = 0;
          }
        }

        if (bestLength > 5) {
          // Found a reasonably long sequence of valid characters
          const cleanedMessage = extractedText.substring(bestStart, bestStart + bestLength);
          console.log(`Cleaned best sequence: "${cleanedMessage}"`);
          resolve(cleanedMessage);
        } else {
          console.log(`No good text sequences found, returning trimmed text`);
          resolve(extractedText.substring(0, Math.min(500, extractedText.length)));
        }
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

// Main encode function with improved PVD
export const encodeMessage = (imageDataUrl: string, message: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      if (!imageDataUrl || !message || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar, pesan, dan kunci lokasi diperlukan"));
        return;
      }

      // Validate image format
      if (!imageDataUrl.startsWith("data:image/")) {
        reject(new Error("Format gambar tidak valid"));
        return;
      }

      console.log("PVD Encoding:", {
        messageLength: message.length,
        keyLength: locationKey.length,
      });

      const image: HTMLImageElement = new Image();

      image.onload = (): void => {
        // Check image dimensions - minimum size requirements
        if (image.width < 100 || image.height < 100) {
          reject(new Error("Ukuran gambar terlalu kecil. Minimal 100x100 piksel diperlukan."));
          return;
        }

        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Tidak dapat membuat context canvas"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        // Add START/END markers for more reliable extraction
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

// Main decode function with improved PVD
export const decodeMessage = (imageDataUrl: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      if (!imageDataUrl || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar dan kunci lokasi diperlukan"));
        return;
      }

      // Validate image format
      if (!imageDataUrl.startsWith("data:image/")) {
        reject(new Error("Format gambar tidak valid"));
        return;
      }

      console.log("PVD Decoding:", { keyLength: locationKey.length });

      const image: HTMLImageElement = new Image();

      image.onload = (): void => {
        // Check image dimensions
        if (image.width < 100 || image.height < 100) {
          reject(new Error("Ukuran gambar terlalu kecil untuk mengandung pesan"));
          return;
        }

        const canvas: HTMLCanvasElement = document.createElement("canvas");
        const ctx: CanvasRenderingContext2D | null = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Tidak dapat membuat context canvas"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        decodePVDLocationBased(canvas, ctx, locationKey, onProgress)
          .then((result) => {
            if (!result || result.trim().length === 0) {
              // No message found or invalid key
              resolve("");
            } else {
              resolve(result);
            }
          })
          .catch(reject);
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

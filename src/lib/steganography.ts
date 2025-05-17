import type { PixelPosition, ProgressCallback } from "../Types";

// Text to binary and binary to text functions
const textToBinary = (text: string): string => {
  return text
    .split("")
    .map((char) => {
      return char.charCodeAt(0).toString(2).padStart(8, "0");
    })
    .join("");
};

const binaryToText = (binary: string): string => {
  const bytes = binary.match(/.{1,8}/g) || [];
  return bytes.map((byte) => String.fromCharCode(parseInt(byte, 2))).join("");
};

// Location key hash function - creates deterministic pixel positions from location key
const hashLocationKey = (key: string, imageWidth: number, imageHeight: number): PixelPosition[] => {
  let positions: PixelPosition[] = [];
  let seed = Array.from(key).reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // PRNG function
  const prng = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const positionsCount = Math.min((imageWidth * imageHeight) / 4, 10000);

  for (let i = 0; i < positionsCount; i++) {
    const x = Math.floor(prng() * imageWidth);
    const y = Math.floor(prng() * imageHeight);
    positions.push({ x, y });
  }

  return positions;
};

// Simple location-based steganography algorithm
const encodeLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, messageBinary: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Get pixel data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Generate pixel positions from location key
      const positions = hashLocationKey(locationKey, canvas.width, canvas.height);

      // Make sure we have enough pixels for the message
      if (positions.length < messageBinary.length + 48) {
        // 48 = header + length
        reject(new Error("Gambar terlalu kecil untuk pesan ini"));
        return;
      }

      // Add a known header pattern for validation (16 bits)
      const headerPattern = "1010101010101010";

      // First encode the header pattern
      for (let i = 0; i < headerPattern.length; i++) {
        if (i % 5 === 0 && onProgress) {
          onProgress(Math.floor((i / (messageBinary.length + 32)) * 10));
        }

        const pos = positions[i];
        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;

        // Encode bit in blue channel LSB (least visible)
        if (headerPattern[i] === "1") {
          data[pixelIndex + 2] = (data[pixelIndex + 2] & 254) | 1; // Set LSB to 1
        } else {
          data[pixelIndex + 2] = data[pixelIndex + 2] & 254; // Set LSB to 0
        }
      }

      // Encode message length as 16-bit binary after header pattern
      const lengthBinary = messageBinary.length.toString(2).padStart(16, "0");
      for (let i = 0; i < lengthBinary.length; i++) {
        const pos = positions[i + 16]; // Start after header
        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;

        if (lengthBinary[i] === "1") {
          data[pixelIndex + 2] = (data[pixelIndex + 2] & 254) | 1;
        } else {
          data[pixelIndex + 2] = data[pixelIndex + 2] & 254;
        }
      }

      // Now encode the actual message
      for (let i = 0; i < messageBinary.length; i++) {
        if (i % 20 === 0 && onProgress) {
          onProgress(10 + Math.min(85, Math.floor((i / messageBinary.length) * 90)));
        }

        const pos = positions[i + 32]; // Start after header + length
        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;

        // Simple LSB encoding in blue channel
        if (messageBinary[i] === "1") {
          data[pixelIndex + 2] = (data[pixelIndex + 2] & 254) | 1; // Set LSB to 1
        } else {
          data[pixelIndex + 2] = data[pixelIndex + 2] & 254; // Set LSB to 0
        }
      }

      // Apply changes to canvas
      ctx.putImageData(imageData, 0, 0);

      onProgress && onProgress(100);
      // Use PNG for lossless storage
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      reject(error);
    }
  });
};

// Matching decoder for location-based algorithm
const decodeLocationBased = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Get pixel positions from location key
      const positions = hashLocationKey(locationKey, canvas.width, canvas.height);

      // First, check header pattern
      const expectedHeader = "1010101010101010";
      let headerFound = "";

      for (let i = 0; i < 16 && i < positions.length; i++) {
        if (i % 5 === 0 && onProgress) {
          onProgress(Math.floor((i / 16) * 10));
        }

        const pos = positions[i];
        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;

        // Read LSB from blue channel
        headerFound += data[pixelIndex + 2] & 1 ? "1" : "0";
      }

      // Check if header matches (with tolerance)
      let headerMatchCount = 0;
      for (let i = 0; i < expectedHeader.length; i++) {
        if (expectedHeader[i] === headerFound[i]) {
          headerMatchCount++;
        }
      }

      // If less than 75% match, probably wrong key
      if (headerMatchCount < 12) {
        resolve(""); // Empty string indicates wrong key
        return;
      }

      // Extract message length
      let lengthBinary = "";
      for (let i = 0; i < 16; i++) {
        const pos = positions[i + 16];
        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;
        lengthBinary += data[pixelIndex + 2] & 1 ? "1" : "0";
      }

      // Parse message length with safety checks
      let messageLength = 0;
      try {
        messageLength = parseInt(lengthBinary, 2);
        // Sanity check
        if (isNaN(messageLength) || messageLength <= 0 || messageLength > positions.length - 48) {
          messageLength = Math.min(1000, positions.length - 48); // Fallback value
        }
      } catch (e) {
        messageLength = Math.min(1000, positions.length - 48); // Fallback value
      }

      // Extract the message
      let extractedBinary = "";
      for (let i = 0; i < messageLength; i++) {
        if (i % 50 === 0 && onProgress) {
          onProgress(10 + Math.floor((i / messageLength) * 90));
        }

        const pos = positions[i + 32]; // After header + length
        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;

        // Read from blue channel
        extractedBinary += data[pixelIndex + 2] & 1 ? "1" : "0";
      }

      // Convert binary to text
      const extractedText = binaryToText(extractedBinary);

      // Check for START and END markers (from your encodeMessage function)
      const startIndex = extractedText.indexOf("START");
      const endIndex = extractedText.indexOf("END");

      onProgress && onProgress(100);

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        resolve(extractedText.substring(startIndex + 5, endIndex));
      } else {
        // If no markers, return what we have (up to reasonable limit)
        resolve(extractedText.substring(0, Math.min(200, extractedText.length)));
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Main encode function
export const encodeMessage = (imageDataUrl: string, message: string, locationKey: string, onProgress?: ProgressCallback, settings?: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Validate input
      if (!imageDataUrl || !message || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar, pesan, dan kunci lokasi diperlukan"));
        return;
      }

      // Log input for debugging
      console.log("Encoding with:", {
        messageLength: message.length,
        keyLength: locationKey.length,
      });

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Tidak dapat membuat context canvas"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        // Add message markers for easier extraction
        const messageBinary = textToBinary("START" + message + "END");
        console.log("Binary message length:", messageBinary.length);

        // Use location-based algorithm
        encodeLocationBased(canvas, ctx, messageBinary, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (e) => {
        console.error("Image load error:", e);
        reject(new Error("Gagal memuat gambar"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      console.error("Encoding error:", error);
      reject(error);
    }
  });
};

// Main decode function
export const decodeMessage = (imageDataUrl: string, locationKey: string, onProgress?: ProgressCallback, algorithm?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Validate input
      if (!imageDataUrl || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar dan kunci lokasi diperlukan"));
        return;
      }

      // Log for debugging
      console.log("Decoding with:", {
        keyLength: locationKey.length,
      });

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Tidak dapat membuat context canvas"));
          return;
        }

        canvas.width = image.width;
        canvas.height = image.height;
        ctx.drawImage(image, 0, 0);

        // Use location-based algorithm for decoding
        decodeLocationBased(canvas, ctx, locationKey, onProgress).then(resolve).catch(reject);
      };

      image.onerror = (e) => {
        console.error("Image load error:", e);
        reject(new Error("Gagal memuat gambar"));
      };

      image.src = imageDataUrl;
    } catch (error) {
      console.error("Decoding error:", error);
      reject(error);
    }
  });
};

// Generate random location key (though you'll primarily use geolocation)
export const generateLocationKey = (length: number = 16): string => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";

  for (let i = 0; i < length; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return key;
};

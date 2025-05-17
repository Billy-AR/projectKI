import type { PixelPosition, ProgressCallback, SteganographyAlgorithm, SteganographySettings } from "../Types";

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

// Location key hash function
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

// PVD (Pixel Value Differencing) Implementation
const encodePVD = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, messageBinary: string, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Get pixel data from the image
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Get pixel positions based on location key
      const positions = hashLocationKey(locationKey, canvas.width, canvas.height);

      if (positions.length < Math.ceil(messageBinary.length / 3)) {
        reject(new Error("Gambar terlalu kecil untuk pesan ini"));
        return;
      }

      // PVD implementation
      let bitIndex = 0;
      for (let i = 0; i < positions.length && bitIndex < messageBinary.length; i++) {
        if (i % 20 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((bitIndex / messageBinary.length) * 100)));
        }

        const pos = positions[i];
        const nextPos = i < positions.length - 1 ? positions[i + 1] : { x: (pos.x + 1) % canvas.width, y: pos.y };

        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;
        const nextPixelIndex = (nextPos.y * canvas.width + nextPos.x) * 4;

        // For each RGB component
        for (let j = 0; j < 3 && bitIndex < messageBinary.length; j++) {
          // Calculate difference between pixel values
          const diff = Math.abs(data[pixelIndex + j] - data[nextPixelIndex + j]);

          // Determine how many bits we can embed
          let bitsToEmbed = 1; // Default
          if (diff > 32) bitsToEmbed = 3;
          else if (diff > 16) bitsToEmbed = 2;

          // Extract bits to embed
          const bits = messageBinary.substring(bitIndex, Math.min(bitIndex + bitsToEmbed, messageBinary.length));
          bitIndex += bits.length;

          // Determine new difference based on bits
          const newDiff = (diff & ~((1 << bits.length) - 1)) | parseInt(bits || "0", 2);

          // Adjust pixel values
          if (data[pixelIndex + j] >= data[nextPixelIndex + j]) {
            data[pixelIndex + j] = Math.min(255, Math.max(0, Math.floor(data[pixelIndex + j] + (newDiff - diff) / 2)));
            data[nextPixelIndex + j] = Math.min(255, Math.max(0, Math.floor(data[nextPixelIndex + j] - (newDiff - diff) / 2)));
          } else {
            data[pixelIndex + j] = Math.min(255, Math.max(0, Math.floor(data[pixelIndex + j] - (newDiff - diff) / 2)));
            data[nextPixelIndex + j] = Math.min(255, Math.max(0, Math.floor(data[nextPixelIndex + j] + (newDiff - diff) / 2)));
          }
        }
      }

      // Put modified pixel data back to canvas
      ctx.putImageData(imageData, 0, 0);

      onProgress && onProgress(100);
      resolve(canvas.toDataURL("image/png"));
    } catch (error) {
      reject(error);
    }
  });
};

// PVD Decoding
const decodePVD = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const positions = hashLocationKey(locationKey, canvas.width, canvas.height);

      let extractedBinary = "";
      const maxPositions = Math.min(positions.length, 10000);

      for (let i = 0; i < maxPositions; i++) {
        if (i % 50 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((i / maxPositions) * 100)));
        }

        const pos = positions[i];
        const nextPos = i < positions.length - 1 ? positions[i + 1] : { x: (pos.x + 1) % canvas.width, y: pos.y };

        const pixelIndex = (pos.y * canvas.width + pos.x) * 4;
        const nextPixelIndex = (nextPos.y * canvas.width + nextPos.x) * 4;

        // For each RGB component
        for (let j = 0; j < 3; j++) {
          const diff = Math.abs(data[pixelIndex + j] - data[nextPixelIndex + j]);

          let bitsToExtract = 1;
          if (diff > 32) bitsToExtract = 3;
          else if (diff > 16) bitsToExtract = 2;

          const bits = (diff & ((1 << bitsToExtract) - 1)).toString(2).padStart(bitsToExtract, "0");
          extractedBinary += bits;

          // Check for markers
          if (extractedBinary.length >= 40) {
            const tempText = binaryToText(extractedBinary);
            if (tempText.includes("START") && tempText.includes("END")) {
              const startIndex = tempText.indexOf("START");
              const endIndex = tempText.indexOf("END");

              if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                onProgress && onProgress(100);
                resolve(tempText.substring(startIndex + 5, endIndex));
                return;
              }
            }
          }
        }
      }

      // Process final extraction
      const extractedText = binaryToText(extractedBinary);
      const startIndex = extractedText.indexOf("START");
      const endIndex = extractedText.indexOf("END");

      onProgress && onProgress(100);

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        resolve(extractedText.substring(startIndex + 5, endIndex));
      } else {
        resolve(""); // No message found
      }
    } catch (error) {
      reject(error);
    }
  });
};

// DCT (Discrete Cosine Transform) Implementation
const encodeDCT = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, messageBinary: string, locationKey: string, onProgress?: ProgressCallback, quality: number = 75): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Simplified DCT implementation for browser environment
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Get block positions based on location key
      const positions = hashLocationKey(locationKey, Math.floor(canvas.width / 8), Math.floor(canvas.height / 8));

      if (positions.length < messageBinary.length) {
        reject(new Error("Gambar terlalu kecil untuk pesan ini"));
        return;
      }

      // Process each bit of the message
      for (let i = 0; i < messageBinary.length; i++) {
        if (i % 20 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((i / messageBinary.length) * 100)));
        }

        // Get block position (8x8 blocks for DCT)
        const blockPos = positions[i];
        const blockX = blockPos.x * 8;
        const blockY = blockPos.y * 8;

        // Use mid-frequency components (4,4) in block
        for (let dy = 3; dy <= 5; dy++) {
          for (let dx = 3; dx <= 5; dx++) {
            if (dy === 4 && dx === 4 && i < messageBinary.length) {
              const pixelIndex = ((blockY + dy) * canvas.width + (blockX + dx)) * 4;

              // Modify blue channel for less visual impact
              if (messageBinary[i] === "1") {
                // Set to odd value for 1
                if (data[pixelIndex + 2] % 2 === 0) data[pixelIndex + 2] += 1;
                if (data[pixelIndex + 2] > 254) data[pixelIndex + 2] = 253;
              } else {
                // Set to even value for 0
                if (data[pixelIndex + 2] % 2 === 1) data[pixelIndex + 2] += 1;
                if (data[pixelIndex + 2] > 254) data[pixelIndex + 2] = 254;
              }
            }
          }
        }
      }

      // Apply modified pixel data
      ctx.putImageData(imageData, 0, 0);

      onProgress && onProgress(100);
      // Use JPEG format for DCT with specified quality
      resolve(canvas.toDataURL("image/jpeg", quality / 100));
    } catch (error) {
      reject(error);
    }
  });
};

// DCT Decoding
const decodeDCT = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, locationKey: string, onProgress?: ProgressCallback): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Get block positions
      const positions = hashLocationKey(locationKey, Math.floor(canvas.width / 8), Math.floor(canvas.height / 8));

      let extractedBinary = "";
      const maxPositions = Math.min(positions.length, 20000);

      for (let i = 0; i < maxPositions; i++) {
        if (i % 50 === 0 && onProgress) {
          onProgress(Math.min(95, Math.floor((i / maxPositions) * 100)));
        }

        // Get block position
        const blockPos = positions[i];
        const blockX = blockPos.x * 8;
        const blockY = blockPos.y * 8;

        // Use same mid-frequency component
        const pixelIndex = ((blockY + 4) * canvas.width + (blockX + 4)) * 4;

        // Extract bit from blue channel
        extractedBinary += data[pixelIndex + 2] % 2 === 1 ? "1" : "0";

        // Check for message boundaries
        if (extractedBinary.length >= 24) {
          const tempText = binaryToText(extractedBinary);
          if (tempText.includes("START") && tempText.includes("END")) {
            break;
          }
        }
      }

      // Process extraction
      const extractedText = binaryToText(extractedBinary);
      const startIndex = extractedText.indexOf("START");
      const endIndex = extractedText.indexOf("END");

      onProgress && onProgress(100);

      if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        resolve(extractedText.substring(startIndex + 5, endIndex));
      } else {
        resolve(""); // No message found
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Main encode function
// Perbaikan pada fungsi encodeMessage untuk menjamin kompatibilitas kunci lokasi
export const encodeMessage = (imageDataUrl: string, message: string, locationKey: string, onProgress?: ProgressCallback, settings: SteganographySettings = { algorithm: "DCT", quality: 80 }): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Validasi input
      if (!imageDataUrl || !message || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar, pesan, dan kunci lokasi diperlukan"));
        return;
      }

      // Catat input untuk debugging
      console.log("Encoding with:", {
        messageLength: message.length,
        keyLength: locationKey.length,
        algorithm: settings.algorithm,
        quality: settings.quality,
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

        // Select encoding algorithm
        switch (settings.algorithm) {
          case "LSB":
            // Redirect to PVD
            console.log("LSB algorithm redirected to PVD");
            encodePVD(canvas, ctx, messageBinary, locationKey, onProgress).then(resolve).catch(reject);
            break;

          case "PVD":
            console.log("Using PVD algorithm");
            encodePVD(canvas, ctx, messageBinary, locationKey, onProgress).then(resolve).catch(reject);
            break;

          case "DCT":
            console.log("Using DCT algorithm with quality:", settings.quality);
            encodeDCT(canvas, ctx, messageBinary, locationKey, onProgress, settings.quality).then(resolve).catch(reject);
            break;

          default:
            reject(new Error("Algoritma tidak dikenali: " + settings.algorithm));
        }
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
export const decodeMessage = (imageDataUrl: string, locationKey: string, onProgress?: ProgressCallback, algorithm: SteganographyAlgorithm = "DCT"): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // Validasi input
      if (!imageDataUrl || !locationKey) {
        reject(new Error("Parameter tidak lengkap: gambar dan kunci lokasi diperlukan"));
        return;
      }

      // Log untuk debugging
      console.log("Decoding with:", {
        keyLength: locationKey.length,
        algorithm: algorithm,
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

        // Select decoding algorithm
        switch (algorithm) {
          case "LSB":
            console.log("LSB algorithm redirected to PVD for decoding");
            decodePVD(canvas, ctx, locationKey, onProgress).then(resolve).catch(reject);
            break;

          case "PVD":
            console.log("Using PVD algorithm for decoding");
            decodePVD(canvas, ctx, locationKey, onProgress).then(resolve).catch(reject);
            break;

          case "DCT":
            console.log("Using DCT algorithm for decoding");
            decodeDCT(canvas, ctx, locationKey, onProgress).then(resolve).catch(reject);
            break;

          default:
            reject(new Error("Algoritma tidak dikenali: " + algorithm));
        }
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

// Generate random location key
export const generateLocationKey = (length: number = 16, uppercase: boolean = true, numbers: boolean = true, symbols: boolean = false): string => {
  let chars = "abcdefghijklmnopqrstuvwxyz";
  if (uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (numbers) chars += "0123456789";
  if (symbols) chars += "!@#$%^&*()_+[]{}|;:,.<>?";

  let key = "";
  for (let i = 0; i < length; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return key;
};

// src/services/qrDecoder.js
import jsQR from 'jsqr';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Loads a File or Blob into an HTMLImageElement
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file: ' + (err?.message || 'unknown error')));
    };
    img.src = url;
  });
}

/**
 * Extracts raw RGBA ImageData from an image at a specific scale
 */
function getImageDataFromImg(img, targetWidth = null) {
  const canvas = document.createElement('canvas');
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (targetWidth && targetWidth < width) {
    const ratio = targetWidth / width;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Creates a high-contrast binarized (black and white) copy of ImageData
 */
function binarizeImageData(originalData) {
  const data = new Uint8ClampedArray(originalData.data);
  const len = data.length;

  // 1. Calculate average brightness
  let totalLum = 0;
  for (let i = 0; i < len; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    totalLum += lum;
  }
  const threshold = (totalLum / (len / 4)) * 0.95;

  // 2. Threshold pixels
  for (let i = 0; i < len; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const val = lum < threshold ? 0 : 255;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
  }

  return new ImageData(data, originalData.width, originalData.height);
}

/**
 * Multi-engine QR Code reader for uploaded image files.
 * Tries:
 *  1. Native browser BarcodeDetector API (hardware accelerated, best for crops & screenshots)
 *  2. jsQR on original resolution canvas
 *  3. jsQR on binarized / contrast-boosted canvas
 *  4. jsQR scaled (800px, 1200px)
 *  5. Html5Qrcode.scanFile with a proper non-zero offscreen DOM container
 * 
 * @param {File} file - The uploaded image file
 * @returns {Promise<string>} Decoded QR code string
 */
export async function decodeQrFromImageFile(file) {
  if (!file) throw new Error("No image file provided.");

  // Load image element
  const img = await loadImageFromFile(file);

  // Engine 1: Native BarcodeDetector (Chrome / Edge / Opera / Android)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        
        return barcodes[0].rawValue;
      }
    } catch (e) {
      
    }
  }

  // Resolve jsQR function safely across CommonJS / ESM Vite bundling
  const parseQR = typeof jsQR === 'function' ? jsQR : (jsQR?.default || jsQR);

  // Engine 2: jsQR on native canvas
  try {
    const imgData = getImageDataFromImg(img);
    if (imgData && typeof parseQR === 'function') {
      const code = parseQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        
        return code.data;
      }
    }
  } catch (e) {
    
  }

  // Engine 2b: jsQR with Top 80% Crop (for mobile pass screenshots with text/buttons below QR)
  try {
    const imgData = getImageDataFromImg(img);
    if (imgData && typeof parseQR === 'function') {
      const cropHeight = Math.floor(imgData.height * 0.8);
      const cropData = new Uint8ClampedArray(imgData.width * cropHeight * 4);
      for (let y = 0; y < cropHeight; y++) {
        for (let x = 0; x < imgData.width; x++) {
          const idx = (y * imgData.width + x) * 4;
          cropData[idx] = imgData.data[idx];
          cropData[idx + 1] = imgData.data[idx + 1];
          cropData[idx + 2] = imgData.data[idx + 2];
          cropData[idx + 3] = imgData.data[idx + 3];
        }
      }
      const code = parseQR(cropData, imgData.width, cropHeight, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        
        return code.data;
      }
    }
  } catch (e) {
    
  }

  // Engine 3: jsQR with High-Contrast Binarization
  try {
    const imgData = getImageDataFromImg(img);
    if (imgData && typeof parseQR === 'function') {
      const binarized = binarizeImageData(imgData);
      const code = parseQR(binarized.data, binarized.width, binarized.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data) {
        
        return code.data;
      }
    }
  } catch (e) {
    
  }

  // Engine 4: jsQR with Rescaling (for high-res phone screenshots or downsampled images)
  for (const scaleWidth of [800, 1200, 500]) {
    try {
      const imgData = getImageDataFromImg(img, scaleWidth);
      if (imgData && typeof parseQR === 'function') {
        const code = parseQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (code && code.data) {
          
          return code.data;
        }
      }
    } catch (e) {
      // Continue to next scale
    }
  }

  // Engine 5: Html5Qrcode with properly dimensioned offscreen container (NEVER display: none)
  try {
    let container = document.getElementById('qr-offscreen-file-scanner');
    if (!container) {
      container = document.createElement('div');
      container.id = 'qr-offscreen-file-scanner';
      // Use fixed offscreen with positive dimensions so clientWidth & clientHeight are never 0
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0px';
      container.style.width = '800px';
      container.style.height = '800px';
      container.style.overflow = 'hidden';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    }

    const html5Qr = new Html5Qrcode('qr-offscreen-file-scanner');
    let decoded = null;
    try {
      decoded = await html5Qr.scanFile(file, true);
    } catch (scanErr) {
      decoded = await html5Qr.scanFile(file, false);
    }
    try {
      html5Qr.clear();
    } catch (e) { /* ignore */ }

    if (decoded) {
      
      return decoded;
    }
  } catch (e) {
    
  }

  throw new Error("Could not detect a readable QR code from this image. Please ensure the QR code is clearly visible.");
}

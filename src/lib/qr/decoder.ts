/**
 * VISUALINK Hybrid Camera QR Code Decoder & Distance Guidance Engine
 * Uses native BarcodeDetector API when available with jsQR fallback for Safari/iOS.
 */

import jsQR from 'jsqr';

export interface QRScanResult {
  rawValue: string;
  guidanceText: string;
  qrBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Declare BarcodeDetector type for TypeScript
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export class QRFrameDecoder {
  private barcodeDetector: any = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof window !== "undefined" && window.BarcodeDetector) {
      try {
        this.barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        this.barcodeDetector = null;
      }
    }
  }

  /**
   * Decodes a video element or canvas image frame.
   */
  public async decodeFrame(video: HTMLVideoElement): Promise<QRScanResult | null> {
    if (!video || video.readyState < 2) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    // 1. Try Native BarcodeDetector API if available
    if (this.barcodeDetector) {
      try {
        const barcodes = await this.barcodeDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
          const barcode = barcodes[0];
          const bbox = barcode.boundingBox;
          const guidance = this.computeGuidance(bbox, width, height);
          return {
            rawValue: barcode.rawValue,
            guidanceText: guidance,
            qrBoundingBox: bbox
              ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
              : undefined,
          };
        }
      } catch {
        // Fallback to jsQR on detection error
      }
    }

    // 2. Fallback to jsQR Canvas decoding (Downscaled to max 640px width for 60 FPS JS decoding on mobile)
    const maxTargetWidth = 640;
    let targetWidth = width;
    let targetHeight = height;

    if (width > maxTargetWidth) {
      targetWidth = maxTargetWidth;
      targetHeight = Math.round((height * maxTargetWidth) / width);
    }

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement("canvas");
    }
    if (this.offscreenCanvas.width !== targetWidth || this.offscreenCanvas.height !== targetHeight) {
      this.offscreenCanvas.width = targetWidth;
      this.offscreenCanvas.height = targetHeight;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });
    }

    if (!this.offscreenCtx) return null;

    this.offscreenCtx.drawImage(video, 0, 0, targetWidth, targetHeight);
    const imageData = this.offscreenCtx.getImageData(0, 0, targetWidth, targetHeight);
    const code = jsQR(imageData.data, targetWidth, targetHeight, { inversionAttempts: "dontInvert" });

    if (code && code.data) {
      // Scale bounding box location back to full video frame dimensions
      const scaleX = width / targetWidth;
      const scaleY = height / targetHeight;

      const loc = code.location;
      const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x) * scaleX;
      const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x) * scaleX;
      const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y) * scaleY;
      const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y) * scaleY;

      const bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      const guidance = this.computeGuidance(bbox, width, height);

      return {
        rawValue: code.data,
        guidanceText: guidance,
        qrBoundingBox: bbox,
      };
    }

    return null;
  }

  /**
   * Returns clean stream status without fussy position/distance pinpointing warnings.
   */
  private computeGuidance(
    bbox: { x: number; y: number; width: number; height: number } | null,
    frameWidth: number,
    frameHeight: number
  ): string {
    if (!bbox) return "SCANNING OPTICAL STREAM...";
    return "[✓] OPTICAL STREAM CONNECTED — RECEIVING BLOCKS";
  }
}

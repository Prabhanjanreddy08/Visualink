/**
 * VISUALINK Adaptive Transmission Rate & QR Configuration Engine
 */

export type QRErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface AdaptiveConfig {
  targetFps: number;
  ecLevel: QRErrorCorrectionLevel;
  blockSize: number;
  qrVersion?: number;
}

export class AdaptiveRateEngine {
  private currentFps: number = 30;
  private currentEcLevel: QRErrorCorrectionLevel = "M";
  private currentBlockSize: number = 1024;
  private recentDecodeRates: number[] = [];

  constructor(initialBlockSize: number = 1024) {
    this.currentBlockSize = initialBlockSize;
  }

  public reportDecodeSample(decodeFps: number, droppedCount: number): void {
    this.recentDecodeRates.push(decodeFps);
    if (this.recentDecodeRates.length > 10) {
      this.recentDecodeRates.shift();
    }

    const avgDecodeFps = this.recentDecodeRates.reduce((a, b) => a + b, 0) / this.recentDecodeRates.length;

    // Adapt FPS based on receiver decode capability
    if (avgDecodeFps > 45) {
      this.currentFps = 60;
    } else if (avgDecodeFps > 25) {
      this.currentFps = 30;
    } else if (avgDecodeFps > 12) {
      this.currentFps = 20;
    } else {
      this.currentFps = 15;
    }

    // Adapt Error Correction Level: If high drops, boost EC level
    if (droppedCount > 20) {
      this.currentEcLevel = "H";
    } else if (droppedCount > 5) {
      this.currentEcLevel = "Q";
    } else {
      this.currentEcLevel = "M";
    }
  }

  public getConfig(): AdaptiveConfig {
    return {
      targetFps: this.currentFps,
      ecLevel: this.currentEcLevel,
      blockSize: this.currentBlockSize,
    };
  }

  public setTargetFps(fps: number): void {
    this.currentFps = fps;
  }

  public setEcLevel(level: QRErrorCorrectionLevel): void {
    this.currentEcLevel = level;
  }
}

/**
 * VISUALINK Performance Metrics Engine
 */

export interface TransferMetrics {
  captureFps: number;
  decodeFps: number;
  goodputKBps: number;
  payloadKBps: number;
  elapsedSeconds: number;
  droppedFrames: number;
  totalFrames: number;
  newPackets: number;
  duplicatePackets: number;
  redundantPackets: number;
  currentBlocks: number;
  totalBlocks: number;
  progressPercentage: number;
  bytesTransferred: number;
  totalBytes: number;
  estimatedRemainingSeconds: number;
}

export class MetricsTracker {
  private startTime: number = 0;
  private frameCount: number = 0;
  private decodedCount: number = 0;
  private droppedCount: number = 0;
  private duplicateCount: number = 0;
  private redundantCount: number = 0;
  private newPacketCount: number = 0;
  private totalBytesTransferred: number = 0;
  private totalFileBytes: number = 0;
  private lastFpsCheckTime: number = 0;
  private fpsFrameCounter: number = 0;
  private fpsDecodeCounter: number = 0;
  private currentCaptureFps: number = 0;
  private currentDecodeFps: number = 0;

  private recentBytesSamples: { time: number; bytes: number }[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.startTime = Date.now();
    this.frameCount = 0;
    this.decodedCount = 0;
    this.droppedCount = 0;
    this.duplicateCount = 0;
    this.redundantCount = 0;
    this.newPacketCount = 0;
    this.totalBytesTransferred = 0;
    this.totalFileBytes = 0;
    this.lastFpsCheckTime = Date.now();
    this.fpsFrameCounter = 0;
    this.fpsDecodeCounter = 0;
    this.currentCaptureFps = 0;
    this.currentDecodeFps = 0;
    this.recentBytesSamples = [];
  }

  public setTotalBytes(fileBytes: number): void {
    this.totalFileBytes = fileBytes;
  }

  public recordFrameRendered(): void {
    this.frameCount++;
    this.fpsFrameCounter++;
    this.updateFps();
  }

  public recordFrameScanned(success: boolean): void {
    this.frameCount++;
    this.fpsFrameCounter++;
    if (success) {
      this.decodedCount++;
      this.fpsDecodeCounter++;
    } else {
      this.droppedCount++;
    }
    this.updateFps();
  }

  public recordPacketReceived(isNew: boolean, isDuplicate: boolean, isRedundant: boolean, payloadBytes: number): void {
    if (isDuplicate) {
      this.duplicateCount++;
    } else if (isRedundant) {
      this.redundantCount++;
    } else if (isNew) {
      this.newPacketCount++;
      this.totalBytesTransferred += payloadBytes;
      this.recentBytesSamples.push({ time: Date.now(), bytes: payloadBytes });
    }
  }

  private updateFps(): void {
    const now = Date.now();
    const elapsed = (now - this.lastFpsCheckTime) / 1000;
    if (elapsed >= 1.0) {
      this.currentCaptureFps = Math.round((this.fpsFrameCounter / elapsed) * 10) / 10;
      this.currentDecodeFps = Math.round((this.fpsDecodeCounter / elapsed) * 10) / 10;
      this.fpsFrameCounter = 0;
      this.fpsDecodeCounter = 0;
      this.lastFpsCheckTime = now;
    }
  }

  public getSnapshot(currentBlocks: number, totalBlocks: number): TransferMetrics {
    const now = Date.now();
    const elapsedSec = Math.max(0.1, (now - this.startTime) / 1000);

    // Prune sliding window byte samples older than 2.5 seconds
    this.recentBytesSamples = this.recentBytesSamples.filter(s => now - s.time <= 2500);
    const windowBytes = this.recentBytesSamples.reduce((sum, s) => sum + s.bytes, 0);
    const windowSec = Math.max(0.5, Math.min(2.5, elapsedSec));

    // Live sliding-window instant speeds
    const instantKBps = (windowBytes / 1024) / windowSec;
    const overallGoodput = (this.totalBytesTransferred / 1024) / elapsedSec;
    const goodputKBps = Math.max(instantKBps, overallGoodput);
    const payloadKBps = Math.max(instantKBps, (this.totalBytesTransferred / 1024) / elapsedSec);

    const progress = totalBlocks > 0 ? Math.min(100, (currentBlocks / totalBlocks) * 100) : 0;

    let remainingSec = 0;
    if (goodputKBps > 0 && this.totalFileBytes > 0) {
      const remainingBytes = Math.max(0, this.totalFileBytes - this.totalBytesTransferred);
      remainingSec = remainingBytes / (goodputKBps * 1024);
    }

    return {
      captureFps: this.currentCaptureFps || 30,
      decodeFps: this.currentDecodeFps,
      goodputKBps: Math.round(goodputKBps * 10) / 10,
      payloadKBps: Math.round(payloadKBps * 10) / 10,
      elapsedSeconds: Math.floor(elapsedSec),
      droppedFrames: this.droppedCount,
      totalFrames: this.frameCount,
      newPackets: this.newPacketCount,
      duplicatePackets: this.duplicateCount,
      redundantPackets: this.redundantCount,
      currentBlocks,
      totalBlocks,
      progressPercentage: Math.round(progress * 10) / 10,
      bytesTransferred: this.totalBytesTransferred,
      totalBytes: this.totalFileBytes,
      estimatedRemainingSeconds: Math.round(remainingSec),
    };
  }
}

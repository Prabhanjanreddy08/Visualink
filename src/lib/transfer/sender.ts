/**
 * VISUALINK Optical Transfer Sender Session Manager
 */

import { getChunkInfo, readAllBlocks } from '../encoding/chunker';
import { FountainEncoder } from '../encoding/fountain';
import { FileMetadata, encodeMetadataPayload } from '../protocol/metadata';
import { VLPacket, PacketType, serializePacket } from '../protocol/packet';
import { computeFileSHA256 } from '../crypto/hashing';
import { deriveKeyFromPairCode, generateIV, encryptBuffer } from '../crypto/encryption';
import { MetricsTracker, TransferMetrics } from '../performance/metrics';
import { renderBinaryQRToCanvas } from '../qr/encoder';

export interface SenderConfig {
  file: File;
  pairCode?: string;
  targetFps?: number;
}

export class SenderSession {
  private file: File;
  private pairCode?: string;
  public readonly sessionId: number;
  private metadata: FileMetadata | null = null;
  private fountainEncoder: FountainEncoder | null = null;
  private metrics: MetricsTracker;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private renderFrameCount: number = 0;
  private dataBlockSequence: number = 0;
  private animFrameId: number | null = null;
  private cryptoKey: CryptoKey | null = null;
  private iv: Uint8Array | null = null;

  constructor(config: SenderConfig) {
    this.file = config.file;
    this.pairCode = config.pairCode;
    this.sessionId = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    this.metrics = new MetricsTracker();
    this.metrics.setTotalBytes(this.file.size);
  }

  /**
   * Initializes session: calculates file SHA-256, slices chunks, and sets up Fountain encoder.
   */
  public async prepare(onProgress?: (step: string, percentage: number) => void): Promise<FileMetadata> {
    if (onProgress) onProgress("Hashing file...", 10);
    const sha256 = await computeFileSHA256(this.file);

    if (onProgress) onProgress("Chunking file...", 40);
    const { totalBlocks, blockSize } = getChunkInfo(this.file.size);
    const blocks = await readAllBlocks(this.file, blockSize);

    let isEncrypted = false;
    let hexIv = "";

    if (this.pairCode && this.pairCode.trim().length > 0) {
      if (onProgress) onProgress("Encrypting blocks...", 70);
      isEncrypted = true;
      this.iv = generateIV();
      hexIv = Array.from(this.iv).map(b => b.toString(16).padStart(2, "0")).join("");
      this.cryptoKey = await deriveKeyFromPairCode(this.pairCode);

      // Encrypt blocks
      for (let i = 0; i < blocks.length; i++) {
        blocks[i] = await encryptBuffer(blocks[i], this.cryptoKey, this.iv);
      }
    }

    this.fountainEncoder = new FountainEncoder(blocks, this.sessionId);

    this.metadata = {
      sessionId: this.sessionId,
      fileName: this.file.name,
      fileSize: this.file.size,
      mimeType: this.file.type || "application/octet-stream",
      totalBlocks,
      blockSize,
      sha256,
      encrypted: isEncrypted,
      iv: hexIv,
    };

    if (onProgress) onProgress("Ready", 100);
    return this.metadata;
  }

  /**
   * Starts optical transmission loop onto target Canvas element.
   */
  public startTransmission(
    canvas: HTMLCanvasElement,
    targetFps: number = 60,
    onMetricsUpdate?: (metrics: TransferMetrics) => void
  ): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.metrics.reset();
    this.metrics.setTotalBytes(this.file.size);
    this.renderFrameCount = 0;
    this.dataBlockSequence = 0;

    const frameIntervalMs = 1000 / Math.max(1, Math.min(60, targetFps));
    let lastRenderTime = 0;
    let lastMetricsUpdateTime = 0;

    const renderLoop = async (now: number) => {
      if (!this.isRunning) return;

      if (!this.isPaused && now - lastRenderTime >= frameIntervalMs) {
        lastRenderTime = now;
        await this.renderNextFrame(canvas);

        // Throttle UI React state updates to 4 times per second (250ms) to prevent page blinking
        if (onMetricsUpdate && this.metadata && now - lastMetricsUpdateTime >= 250) {
          lastMetricsUpdateTime = now;
          onMetricsUpdate(this.metrics.getSnapshot(
            Math.min(this.metadata.totalBlocks, this.dataBlockSequence),
            this.metadata.totalBlocks
          ));
        }
      }

      this.animFrameId = requestAnimationFrame(renderLoop);
    };

    this.animFrameId = requestAnimationFrame(renderLoop);
  }

  /**
   * Renders next frame: initial 3 metadata frames, then data frames with periodic metadata refreshes.
   * Every single rendered frame has a unique frame packet ID (renderFrameCount).
   */
  private async renderNextFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.fountainEncoder || !this.metadata) return;

    let packet: VLPacket;

    // Initial 5 metadata frames for instant < 50ms lock, then refresh every 10 frames
    if (this.renderFrameCount < 5 || (this.renderFrameCount % 10 === 0)) {
      const metaPayload = encodeMetadataPayload(this.metadata);
      packet = {
        header: {
          version: 1,
          type: PacketType.METADATA,
          sessionId: this.sessionId,
          packetId: this.renderFrameCount,
          totalBlocks: this.metadata.totalBlocks,
          payloadLength: metaPayload.length,
          degree: 1,
          flags: this.metadata.encrypted ? 1 : 0,
        },
        payload: metaPayload,
        crc: 0,
      };
    } else {
      // Fountain Data Packet: packetId = dataBlockSequence guarantees unique QR & exact seed alignment
      packet = this.fountainEncoder.createPacket(this.dataBlockSequence, this.metadata.encrypted);
      this.dataBlockSequence++;
    }

    const binaryPacket = serializePacket(packet);
    await renderBinaryQRToCanvas(canvas, binaryPacket, { width: 360, margin: 1, ecLevel: "L" });

    this.metrics.recordFrameRendered();
    this.renderFrameCount++;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public getSessionIdHex(): string {
    return this.sessionId.toString(16).toUpperCase().padStart(8, "0");
  }

  public getMetadata(): FileMetadata | null {
    return this.metadata;
  }
}

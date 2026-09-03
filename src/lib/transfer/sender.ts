/**
 * VISUALINK Optical Transfer Sender Session Manager
 */

import { getChunkInfo, readAllBlocks } from '../encoding/chunker';
import { FountainEncoder } from '../encoding/fountain';
import { FileMetadata, encodeMetadataPayload } from '../protocol/metadata';
import { VLPacket, PacketType, packetToQRString } from '../protocol/packet';
import { computeFileSHA256 } from '../crypto/hashing';
import { deriveKeyFromPairCode, generateIV, encryptBuffer } from '../crypto/encryption';
import { MetricsTracker, TransferMetrics } from '../performance/metrics';
import { renderQRToCanvas } from '../qr/encoder';

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
  private currentPacketId: number = 0;
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
    targetFps: number = 30,
    onMetricsUpdate?: (metrics: TransferMetrics) => void
  ): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.metrics.reset();
    this.metrics.setTotalBytes(this.file.size);

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
            Math.min(this.metadata.totalBlocks, this.currentPacketId),
            this.metadata.totalBlocks
          ));
        }
      }

      this.animFrameId = requestAnimationFrame(renderLoop);
    };

    this.animFrameId = requestAnimationFrame(renderLoop);
  }

  /**
   * Renders next frame: alternates metadata control packets with Fountain data packets.
   */
  private async renderNextFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.fountainEncoder || !this.metadata) return;

    let packet: VLPacket;

    // Transmit metadata control packet every 20 frames to ensure receiver lock
    if (this.currentPacketId % 20 === 0) {
      const metaPayload = encodeMetadataPayload(this.metadata);
      packet = {
        header: {
          version: 1,
          type: PacketType.METADATA,
          sessionId: this.sessionId,
          packetId: this.currentPacketId,
          totalBlocks: this.metadata.totalBlocks,
          payloadLength: metaPayload.length,
          degree: 1,
          flags: this.metadata.encrypted ? 1 : 0,
        },
        payload: metaPayload,
        crc: 0,
      };
    } else {
      // Fountain Data Packet
      packet = this.fountainEncoder.createPacket(this.currentPacketId, this.metadata.encrypted);
    }

    const qrText = packetToQRString(packet);
    await renderQRToCanvas(canvas, qrText, { margin: 2, ecLevel: "M" });

    this.metrics.recordFrameRendered();
    this.currentPacketId++;
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

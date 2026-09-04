/**
 * VISUALINK Optical Transfer Receiver Session Manager
 */

import { QRFrameDecoder } from '../qr/decoder';
import { VLPacket, PacketType, stringToVLPacket } from '../protocol/packet';
import { FileMetadata, decodeMetadataPayload } from '../protocol/metadata';
import { FountainDecoder } from '../encoding/fountain';
import { computeSHA256 } from '../crypto/hashing';
import { deriveKeyFromPairCode, decryptBuffer } from '../crypto/encryption';
import { MetricsTracker, TransferMetrics } from '../performance/metrics';
import { createChunkWriter, ChunkWriter } from '../storage/opfs';

export interface ReceiverResult {
  fileBlob: Blob;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256Match: boolean;
  calculatedHash: string;
  expectedHash: string;
  elapsedSeconds: number;
  goodputKBps: number;
}

export class ReceiverSession {
  private decoder: QRFrameDecoder;
  private metadata: FileMetadata | null = null;
  private fountainDecoder: FountainDecoder | null = null;
  private chunkWriter: ChunkWriter | null = null;
  private metrics: MetricsTracker;
  private isScanning: boolean = false;
  private pairCode?: string;
  private cryptoKey: CryptoKey | null = null;
  private earlyPacketBuffer: VLPacket[] = [];
  private onCompleteCallback?: (result: ReceiverResult) => void;

  constructor(pairCode?: string) {
    this.decoder = new QRFrameDecoder();
    this.pairCode = pairCode;
    this.metrics = new MetricsTracker();
  }

  public setPairCode(code?: string): void {
    this.pairCode = code;
  }

  /**
   * Starts camera scanner loop.
   */
  public startScanning(
    video: HTMLVideoElement,
    onMetadataFound: (meta: FileMetadata) => void,
    onProgress: (metrics: TransferMetrics, guidance: string) => void,
    onComplete: (result: ReceiverResult) => void,
    onError: (err: Error) => void
  ): void {
    if (this.isScanning) return;
    this.isScanning = true;
    this.onCompleteCallback = onComplete;
    this.metrics.reset();

    let lastProgressTime = 0;

    const scanLoop = async () => {
      if (!this.isScanning) return;

      try {
        const scanResult = await this.decoder.decodeFrame(video);
        const now = Date.now();

        const isSessionLocked = this.lockedSessionId !== null || this.metadata !== null;

        if (scanResult) {
          const packet = stringToVLPacket(scanResult.rawValue);
          if (packet) {
            this.metrics.recordFrameScanned(true);
            await this.processPacket(packet, onMetadataFound, onError);
          } else {
            this.metrics.recordFrameScanned(false);
          }

          if (onProgress && now - lastProgressTime >= 250) {
            lastProgressTime = now;
            const current = this.fountainDecoder ? this.fountainDecoder.getDecodedCount() : 0;
            const total = this.metadata ? this.metadata.totalBlocks : 0;
            const guidance = isSessionLocked
              ? `[✓] OPTICAL LINK CONNECTED — RECEIVING BLOCKS (${current}/${total})`
              : scanResult.guidanceText;
            onProgress(this.metrics.getSnapshot(current, total), guidance);
          }
        } else {
          this.metrics.recordFrameScanned(false);
          if (onProgress && now - lastProgressTime >= 250) {
            lastProgressTime = now;
            const current = this.fountainDecoder ? this.fountainDecoder.getDecodedCount() : 0;
            const total = this.metadata ? this.metadata.totalBlocks : 0;
            const guidance = isSessionLocked
              ? `[✓] OPTICAL LINK CONNECTED — RECEIVING BLOCKS (${current}/${total})`
              : "Point camera at sender screen";
            onProgress(this.metrics.getSnapshot(current, total), guidance);
          }
        }

        // Check completion
        const completedResult = await this.checkAndFinalize();
        if (completedResult) {
          this.isScanning = false;
          if (this.onCompleteCallback) this.onCompleteCallback(completedResult);
          return;
        }
      } catch (err: any) {
        // Log warning and continue scanning
      }

      this.animFrameId = requestAnimationFrame(scanLoop);
    };

    this.animFrameId = requestAnimationFrame(scanLoop);
  }

  /**
   * Processes a decoded VLPacket.
   */
  private async processPacket(
    packet: VLPacket,
    onMetadataFound: (meta: FileMetadata) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    const { header, payload } = packet;

    // Lock session
    if (this.lockedSessionId === null) {
      this.lockedSessionId = header.sessionId;
    } else if (header.sessionId !== this.lockedSessionId) {
      return; // Discard packets from different session
    }

    // 1. Process Metadata Control Packet
    if (header.type === PacketType.METADATA && !this.metadata) {
      const meta = decodeMetadataPayload(payload);
      if (meta) {
        this.metadata = meta;
        this.metrics.setTotalBytes(meta.fileSize);
        this.fountainDecoder = new FountainDecoder(meta.totalBlocks, meta.blockSize);
        this.chunkWriter = await createChunkWriter(meta.fileName, meta.totalBlocks);

        if (meta.encrypted && this.pairCode) {
          this.cryptoKey = await deriveKeyFromPairCode(this.pairCode);
        }

        onMetadataFound(meta);

        // Process any early data packets that arrived before metadata!
        if (this.earlyPacketBuffer.length > 0) {
          for (const earlyPkt of this.earlyPacketBuffer) {
            if (this.fountainDecoder) {
              const isNew = this.fountainDecoder.addPacket(earlyPkt);
              this.metrics.recordPacketReceived(isNew, false, false, earlyPkt.payload.length);
            }
          }
          this.earlyPacketBuffer = [];
        }
      }
      return;
    }

    // 2. Process Data Packet
    if (header.type === PacketType.DATA) {
      if (this.fountainDecoder) {
        const isNew = this.fountainDecoder.addPacket(packet);
        const isDup = this.fountainDecoder.duplicateCount > 0;
        const isRed = this.fountainDecoder.redundantCount > 0;

        this.metrics.recordPacketReceived(isNew, isDup, isRed, payload.length);
      } else {
        // Buffer data packets received before metadata packet arrives
        this.earlyPacketBuffer.push(packet);
      }
    }

    // Check completion immediately after processing packet
    const completedResult = await this.checkAndFinalize();
    if (completedResult && this.onCompleteCallback) {
      this.isScanning = false;
      this.onCompleteCallback(completedResult);
    }
  }

  /**
   * Checks if decoding is complete and finalizes file reconstruction if ready.
   */
  public async checkAndFinalize(): Promise<ReceiverResult | null> {
    if (this.fountainDecoder && this.fountainDecoder.isComplete() && this.metadata) {
      return await this.finalizeReconstruction();
    }
    return null;
  }

  /**
   * Finalizes file reconstruction, calculates SHA-256, and returns ReceiverResult.
   */
  private async finalizeReconstruction(): Promise<ReceiverResult> {
    if (!this.fountainDecoder || !this.metadata) {
      throw new Error("Cannot finalize transfer without active metadata and decoder");
    }

    let fileBuffer = this.fountainDecoder.getReconstructedFileBuffer(this.metadata.fileSize);

    // Decrypt if encrypted
    if (this.metadata.encrypted) {
      if (!this.cryptoKey && this.pairCode) {
        this.cryptoKey = await deriveKeyFromPairCode(this.pairCode);
      }
      if (!this.cryptoKey) {
        throw new Error("Encrypted file requires valid pairing key");
      }
      if (!this.metadata.iv) {
        throw new Error("Missing IV for decryption");
      }

      const iv = new Uint8Array(
        this.metadata.iv.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      fileBuffer = await decryptBuffer(fileBuffer, this.cryptoKey, iv);
    }

    // Calculate SHA-256 hash
    const calculatedHash = await computeSHA256(fileBuffer);
    const sha256Match = calculatedHash.toLowerCase() === this.metadata.sha256.toLowerCase();

    const fileBlob = new Blob([fileBuffer.buffer as unknown as ArrayBuffer], { type: this.metadata.mimeType });

    const snapshot = this.metrics.getSnapshot(this.metadata.totalBlocks, this.metadata.totalBlocks);

    return {
      fileBlob,
      fileName: this.metadata.fileName,
      fileSize: this.metadata.fileSize,
      mimeType: this.metadata.mimeType,
      sha256Match,
      calculatedHash,
      expectedHash: this.metadata.sha256,
      elapsedSeconds: snapshot.elapsedSeconds,
      goodputKBps: snapshot.goodputKBps,
    };
  }

  public stopScanning(): void {
    this.isScanning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public getSessionIdHex(): string {
    return this.lockedSessionId ? this.lockedSessionId.toString(16).toUpperCase().padStart(8, "0") : "—";
  }

  public getMetadata(): FileMetadata | null {
    return this.metadata;
  }
}

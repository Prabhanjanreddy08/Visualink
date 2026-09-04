/**
 * VISUALINK Luby Transform (LT) Fountain Encoder & Decoder
 *
 * Implements rateless Fountain erasure coding with Systematic + Soliton distribution,
 * Belief Propagation (Peeling Algorithm), and robust block recovery.
 */

import { VLPacket, PacketType, serializePacket, deserializePacket } from '../protocol/packet';

/**
 * Deterministic Mulberry32 PRNG.
 * Given a seed (packetId), produces repeatable pseudo-random numbers in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * K(o) Fast Online Soliton Distribution Degree Generator
 * Returns low degree d in [1, 3] optimized for optical camera channels.
 * Capping degree at 3 ensures O(1) instant peeling propagation without high-degree decoding stalls.
 */
export function sampleSolitonDegree(rng: () => number, K: number): number {
  if (K <= 1) return 1;
  if (K === 2) return rng() < 0.6 ? 1 : 2;

  const p = rng();
  // 40% Degree 1 (Direct block), 45% Degree 2 (Pair XOR), 15% Degree 3 (Triplet XOR)
  if (p < 0.40) return 1;
  if (p < 0.85) return 2;
  return 3;
}

/**
 * Generates d distinct pseudo-random block indices from [0, K-1] given PRNG.
 */
export function selectBlockIndices(rng: () => number, K: number, degree: number): number[] {
  if (degree >= K) {
    const all = new Array(K);
    for (let i = 0; i < K; i++) all[i] = i;
    return all;
  }

  const indices = new Set<number>();
  while (indices.size < degree) {
    const idx = Math.floor(rng() * K);
    indices.add(idx);
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function getPacketBlockMapping(packetId: number, K: number): { degree: number; indices: number[] } {
  if (K === 1) return { degree: 1, indices: [0] };

  // Pass 1: Pure Systematic Pass for initial K packets (0..K-1)
  if (packetId < K) {
    return { degree: 1, indices: [packetId] };
  }

  // Pass 2+: 1:1 Interleaved Systematic Round-Robin & K(o) Soliton Fountain Pairs
  // Even packetId offsets: Systematic Block retry
  // Odd packetId offsets: K(o) Low-Degree Soliton Fountain Pair/Triplet (d <= 3)
  const offset = packetId - K;
  if (offset % 2 === 0) {
    const sysIndex = Math.floor(offset / 2) % K;
    return { degree: 1, indices: [sysIndex] };
  }

  const rng = mulberry32(packetId);
  const degree = sampleSolitonDegree(rng, K);
  const indices = selectBlockIndices(rng, K, degree);
  return { degree, indices };
}

/**
 * Fountain Encoder: Generates Fountain encoded packets from source blocks.
 */
export class FountainEncoder {
  private blocks: Uint8Array[];
  public readonly K: number;
  public readonly blockSize: number;
  public readonly sessionId: number;

  constructor(blocks: Uint8Array[], sessionId: number) {
    this.blocks = blocks;
    this.K = blocks.length;
    this.blockSize = blocks.length > 0 ? blocks[0].length : 0;
    this.sessionId = sessionId;
  }

  /**
   * Generates packet packetId.
   */
  public createPacket(packetId: number, isEncrypted: boolean = false): VLPacket {
    const { degree, indices } = getPacketBlockMapping(packetId, this.K);
    const payload = new Uint8Array(this.blockSize);

    // XOR combine selected source blocks
    for (const idx of indices) {
      const block = this.blocks[idx];
      for (let b = 0; b < payload.length; b++) {
        payload[b] ^= block[b];
      }
    }

    const isSystematic = packetId < this.K;
    let flags = 0;
    if (isEncrypted) flags |= 0x01;
    if (isSystematic) flags |= 0x02;

    return {
      header: {
        version: 1,
        type: PacketType.DATA,
        sessionId: this.sessionId,
        packetId,
        totalBlocks: this.K,
        payloadLength: payload.length,
        degree,
        flags,
      },
      payload,
      crc: 0,
    };
  }
}

interface BufferedPacket {
  packetId: number;
  indices: Set<number>;
  payload: Uint8Array;
}

/**
 * Fountain Decoder: Reconstructs original K source blocks using Belief Propagation Peeling.
 */
export class FountainDecoder {
  public readonly K: number;
  public readonly blockSize: number;
  private decodedBlocks: (Uint8Array | null)[];
  private decodedCount: number = 0;
  private bufferedPackets: Map<number, BufferedPacket> = new Map();
  private receivedPacketIds: Set<number> = new Set();
  public duplicateCount: number = 0;
  public redundantCount: number = 0;

  constructor(K: number, blockSize: number) {
    this.K = K;
    this.blockSize = blockSize;
    this.decodedBlocks = new Array(K).fill(null);
  }

  public getDecodedCount(): number {
    return this.decodedCount;
  }

  public isComplete(): boolean {
    return this.decodedCount === this.K;
  }

  public getProgressPercentage(): number {
    if (this.K === 0) return 100;
    return Math.min(100, (this.decodedCount / this.K) * 100);
  }

  /**
   * Processes an incoming VLPacket.
   * Returns true if packet contributed new information towards solving blocks.
   */
  public addPacket(packet: VLPacket): boolean {
    if (this.isComplete()) return false;

    const pid = packet.header.packetId;
    if (this.receivedPacketIds.has(pid)) {
      this.duplicateCount++;
      return false;
    }
    this.receivedPacketIds.add(pid);

    const { degree, indices: rawIndices } = getPacketBlockMapping(pid, this.K);
    const indices = new Set(rawIndices);
    let payload = new Uint8Array(packet.payload);

    // 1. XOR out all already decoded blocks
    for (const idx of Array.from(indices)) {
      if (this.decodedBlocks[idx] !== null) {
        const decoded = this.decodedBlocks[idx]!;
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= decoded[i];
        }
        indices.delete(idx);
      }
    }

    if (indices.size === 0) {
      this.redundantCount++;
      return false;
    }

    // 2. If reduced degree is 1, solve block immediately!
    if (indices.size === 1) {
      const [singleIndex] = Array.from(indices);
      this.solveBlock(singleIndex, payload);
      return true;
    }

    // 3. Otherwise buffer reduced packet for peeling
    this.bufferedPackets.set(pid, {
      packetId: pid,
      indices,
      payload,
    });

    return true;
  }

  /**
   * Recursively solves a block and performs Peeling step across all buffered packets.
   */
  private solveBlock(blockIndex: number, blockPayload: Uint8Array): void {
    if (this.decodedBlocks[blockIndex] !== null) return;

    this.decodedBlocks[blockIndex] = blockPayload;
    this.decodedCount++;

    // Peeling propagation step
    const toSolveQueue: { idx: number; payload: Uint8Array }[] = [];

    for (const [pid, bufPacket] of Array.from(this.bufferedPackets.entries())) {
      if (bufPacket.indices.has(blockIndex)) {
        // XOR out newly decoded block
        for (let i = 0; i < bufPacket.payload.length; i++) {
          bufPacket.payload[i] ^= blockPayload[i];
        }
        bufPacket.indices.delete(blockIndex);

        if (bufPacket.indices.size === 1) {
          const [remainingIndex] = Array.from(bufPacket.indices);
          toSolveQueue.push({
            idx: remainingIndex,
            payload: new Uint8Array(bufPacket.payload),
          });
          this.bufferedPackets.delete(pid);
        } else if (bufPacket.indices.size === 0) {
          this.bufferedPackets.delete(pid);
        }
      }
    }

    // Process queued degree-1 packets
    for (const item of toSolveQueue) {
      if (this.decodedBlocks[item.idx] === null) {
        this.solveBlock(item.idx, item.payload);
      }
    }
  }

  /**
   * Assembles and returns all reconstructed source blocks into a single Uint8Array byte buffer.
   */
  public getReconstructedFileBuffer(totalFileSize?: number): Uint8Array {
    if (!this.isComplete()) {
      throw new Error("Cannot assemble file before decoding is complete");
    }

    const fullLength = totalFileSize ?? (this.K * this.blockSize);
    const result = new Uint8Array(fullLength);

    let offset = 0;
    for (let i = 0; i < this.K; i++) {
      const block = this.decodedBlocks[i]!;
      const bytesToCopy = Math.min(block.length, fullLength - offset);
      result.set(block.subarray(0, bytesToCopy), offset);
      offset += bytesToCopy;
    }

    return result;
  }

  public getDecodedBlocks(): (Uint8Array | null)[] {
    return this.decodedBlocks;
  }
}

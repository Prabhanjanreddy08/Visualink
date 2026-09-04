import { describe, it, expect } from 'vitest';
import { FountainEncoder, FountainDecoder } from '../src/lib/encoding/fountain';

import { getChunkInfo } from '../src/lib/encoding/chunker';

describe('Fountain LT Coding & Packet Loss Recovery Engine', () => {
  it('strictly caps totalBlocks to <= 100 for all file sizes', () => {
    const testSizes = [1000, 50000, 250000, 1000000, 10000000];
    for (const size of testSizes) {
      const info = getChunkInfo(size);
      expect(info.totalBlocks).toBeLessThanOrEqual(100);
    }
  });
  function generateDummyBlocks(K: number, blockSize: number): Uint8Array[] {
    const blocks: Uint8Array[] = [];
    for (let i = 0; i < K; i++) {
      const block = new Uint8Array(blockSize);
      for (let b = 0; b < blockSize; b++) {
        block[b] = (i * 13 + b * 7) & 0xFF;
      }
      blocks.push(block);
    }
    return blocks;
  }

  it('reconstructs K blocks with 0% packet loss (ideal case)', () => {
    const K = 20;
    const blockSize = 64;
    const sessionId = 0x12345678;

    const sourceBlocks = generateDummyBlocks(K, blockSize);
    const encoder = new FountainEncoder(sourceBlocks, sessionId);
    const decoder = new FountainDecoder(K, blockSize);

    for (let packetId = 0; packetId < K; packetId++) {
      const packet = encoder.createPacket(packetId);
      decoder.addPacket(packet);
    }

    expect(decoder.isComplete()).toBe(true);
    const reconstructed = decoder.getReconstructedFileBuffer(K * blockSize);

    // Verify byte-for-byte exact equality
    let offset = 0;
    for (let i = 0; i < K; i++) {
      const originalBlock = sourceBlocks[i];
      const slice = reconstructed.subarray(offset, offset + blockSize);
      expect(slice).toEqual(originalBlock);
      offset += blockSize;
    }
  });

  it('reconstructs K blocks with 20% packet loss (rateless fountain recovery)', () => {
    const K = 30;
    const blockSize = 128;
    const sessionId = 0xABCDEF00;

    const sourceBlocks = generateDummyBlocks(K, blockSize);
    const encoder = new FountainEncoder(sourceBlocks, sessionId);
    const decoder = new FountainDecoder(K, blockSize);

    let packetId = 0;
    let dropped = 0;

    // Continuously generate fountain packets until complete
    while (!decoder.isComplete() && packetId < 200) {
      const packet = encoder.createPacket(packetId);

      // Simulate 20% loss (drop every 5th packet)
      if (packetId % 5 === 0) {
        dropped++;
      } else {
        decoder.addPacket(packet);
      }
      packetId++;
    }

    expect(decoder.isComplete()).toBe(true);
    expect(decoder.getProgressPercentage()).toBe(100);
  });

  it('reconstructs K blocks with 50% severe packet loss', () => {
    const K = 40;
    const blockSize = 256;
    const sessionId = 0xDEADBEEF;

    const sourceBlocks = generateDummyBlocks(K, blockSize);
    const encoder = new FountainEncoder(sourceBlocks, sessionId);
    const decoder = new FountainDecoder(K, blockSize);

    let packetId = 0;

    // Simulate 50% random packet loss
    while (!decoder.isComplete() && packetId < 400) {
      const packet = encoder.createPacket(packetId);
      if (packetId % 2 === 0) {
        decoder.addPacket(packet);
      }
      packetId++;
    }

    expect(decoder.isComplete()).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { crc32 } from '../src/lib/protocol/crc32';

describe('CRC32 Checksum Engine', () => {
  it('computes expected CRC32 for known byte string', () => {
    const encoder = new TextEncoder();
    const data = encoder.encode('123456789');
    const checksum = crc32(data);
    // Standard CRC32 of '123456789' is 0xCBF43926 (3421780262)
    expect(checksum).toBe(0xCBF43926);
  });

  it('produces distinct checksums for modified data', () => {
    const data1 = new Uint8Array([1, 2, 3, 4, 5]);
    const data2 = new Uint8Array([1, 2, 3, 4, 6]);
    expect(crc32(data1)).not.toBe(crc32(data2));
  });
});

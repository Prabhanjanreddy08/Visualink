/**
 * Fast CRC32 implementation for VISUALINK binary packet validation.
 */

const CRC32_TABLE = new Uint32Array(256);

// Precompute CRC32 polynomial table (IEEE 802.3)
(function initCRC32Table() {
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC32_TABLE[i] = c >>> 0;
  }
})();

/**
 * Calculates CRC32 checksum for a Uint8Array buffer.
 */
export function crc32(data: Uint8Array, seed: number = 0): number {
  let crc = (seed ^ 0xFFFFFFFF) >>> 0;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * VISUALINK Streaming File Chunker
 * Reads large files incrementally using Blob.slice() without loading multi-GB files into memory.
 */

export interface ChunkInfo {
  totalBlocks: number;
  blockSize: number;
  fileSize: number;
}

/**
 * Calculates optimal QR block size for high-performance optical file transfer.
 * Enforces a strict cap of MAX 100 total blocks (K <= 100) so transmissions finish in seconds.
 */
export function calculateOptimalBlockSize(fileSize: number): number {
  if (fileSize <= 512) return Math.max(64, fileSize);
  
  // Enforce max 100 blocks cap (K <= 100)
  const maxBlocksCap = 100;
  const minBlockFor100Cap = Math.ceil(fileSize / maxBlocksCap);
  
  const baseBlockSize = fileSize <= 100 * 1024 ? 384 : 512;
  return Math.max(baseBlockSize, minBlockFor100Cap);
}

/**
 * Calculates ChunkInfo metadata for a file given a desired block size.
 * Guarantees totalBlocks never exceeds 100.
 */
export function getChunkInfo(fileSize: number, customBlockSize?: number): ChunkInfo {
  let blockSize = customBlockSize || calculateOptimalBlockSize(fileSize);
  let totalBlocks = Math.ceil(fileSize / blockSize) || 1;

  // Unconditional Safety Guarantee: Hard cap totalBlocks at <= 100
  if (totalBlocks > 100) {
    blockSize = Math.ceil(fileSize / 100);
    totalBlocks = Math.ceil(fileSize / blockSize) || 1;
  }

  return { totalBlocks, blockSize, fileSize };
}

/**
 * Reads a single block from a File or Blob incrementally using slice().
 * Guarantees that returned Uint8Array is exactly `blockSize` bytes (zero-padded if last block).
 */
export async function readSingleBlock(
  file: File | Blob,
  blockIndex: number,
  blockSize: number
): Promise<Uint8Array> {
  const start = blockIndex * blockSize;
  const end = Math.min(start + blockSize, file.size);
  const slice = file.slice(start, end);

  const arrayBuffer = await slice.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);

  if (rawBytes.length === blockSize) {
    return rawBytes;
  }

  // Zero-pad last block to uniform blockSize
  const padded = new Uint8Array(blockSize);
  padded.set(rawBytes, 0);
  return padded;
}

/**
 * Reads all blocks of a file into an array of Uint8Arrays.
 * Note: Use this for smaller files (< 100 MB). For multi-GB files, call readSingleBlock on demand.
 */
export async function readAllBlocks(
  file: File | Blob,
  blockSize: number,
  onProgress?: (processedBlocks: number, totalBlocks: number) => void
): Promise<Uint8Array[]> {
  const { totalBlocks } = getChunkInfo(file.size, blockSize);
  const blocks: Uint8Array[] = [];

  for (let i = 0; i < totalBlocks; i++) {
    const block = await readSingleBlock(file, i, blockSize);
    blocks.push(block);
    if (onProgress) onProgress(i + 1, totalBlocks);
  }

  return blocks;
}

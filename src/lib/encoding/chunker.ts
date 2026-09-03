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
 * Calculates optimal QR block size based on total file size.
 * Target block size ranges from 512 bytes (small files) to 2048 bytes (large files)
 * for optimal QR code matrix density and camera recognition reliability.
 */
export function calculateOptimalBlockSize(fileSize: number): number {
  if (fileSize <= 50 * 1024) return 256;         // <= 50 KB -> 256 B
  if (fileSize <= 1 * 1024 * 1024) return 512;    // <= 1 MB -> 512 B
  if (fileSize <= 50 * 1024 * 1024) return 1024;  // <= 50 MB -> 1 KB
  return 1500;                                    // > 50 MB -> 1.5 KB
}

/**
 * Calculates ChunkInfo metadata for a file given a desired block size.
 */
export function getChunkInfo(fileSize: number, customBlockSize?: number): ChunkInfo {
  const blockSize = customBlockSize || calculateOptimalBlockSize(fileSize);
  const totalBlocks = Math.ceil(fileSize / blockSize) || 1;
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

/**
 * VISUALINK Origin Private File System (OPFS) & Stream File Writer
 * Provides zero-RAM-exhaustion disk writing for multi-GB files with Blob fallback.
 */

export interface ChunkWriter {
  writeBlock(blockIndex: number, blockSize: number, data: Uint8Array): Promise<void>;
  finalize(totalFileSize: number, mimeType: string, fileName: string): Promise<Blob>;
  close(): Promise<void>;
}

/**
 * Checks if OPFS is supported in current browser environment.
 */
export function isOPFSSupported(): boolean {
  return typeof navigator !== "undefined" &&
    typeof navigator.storage !== "undefined" &&
    typeof navigator.storage.getDirectory === "function";
}

/**
 * OPFS Chunk Writer implementation.
 */
export class OPFSChunkWriter implements ChunkWriter {
  private fileHandle: FileSystemFileHandle | null = null;
  private writable: FileSystemWritableFileStream | null = null;
  private tempFileName: string;

  constructor(fileName: string) {
    this.tempFileName = `vl_transfer_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  }

  public async init(): Promise<void> {
    const root = await navigator.storage.getDirectory();
    this.fileHandle = await root.getFileHandle(this.tempFileName, { create: true });
    this.writable = await this.fileHandle.createWritable();
  }

  public async writeBlock(blockIndex: number, blockSize: number, data: Uint8Array): Promise<void> {
    if (!this.writable) await this.init();
    const offset = blockIndex * blockSize;
    await this.writable!.seek(offset);
    await this.writable!.write(data as unknown as BufferSource);
  }

  public async finalize(totalFileSize: number, mimeType: string, fileName: string): Promise<Blob> {
    if (this.writable) {
      await this.writable.close();
      this.writable = null;
    }
    if (!this.fileHandle) {
      throw new Error("OPFS file handle not initialized");
    }

    const rawFile = await this.fileHandle.getFile();
    // Truncate/slice to exact totalFileSize
    const sliced = rawFile.slice(0, totalFileSize, mimeType);
    return new File([sliced], fileName, { type: mimeType });
  }

  public async close(): Promise<void> {
    if (this.writable) {
      try {
        await this.writable.close();
      } catch {
        // Ignore already closed error
      }
      this.writable = null;
    }
  }
}

/**
 * In-Memory Chunk Writer Fallback for environments without OPFS.
 */
export class MemoryChunkWriter implements ChunkWriter {
  private blocks: (Uint8Array | null)[] = [];

  constructor(totalBlocks: number) {
    this.blocks = new Array(totalBlocks).fill(null);
  }

  public async writeBlock(blockIndex: number, blockSize: number, data: Uint8Array): Promise<void> {
    this.blocks[blockIndex] = data;
  }

  public async finalize(totalFileSize: number, mimeType: string, fileName: string): Promise<Blob> {
    const result = new Uint8Array(totalFileSize);
    let offset = 0;

    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      if (!block) throw new Error(`Block ${i} missing during assembly`);
      const bytesToCopy = Math.min(block.length, totalFileSize - offset);
      result.set(block.subarray(0, bytesToCopy), offset);
      offset += bytesToCopy;
    }

    return new Blob([result as unknown as ArrayBuffer], { type: mimeType });
  }

  public async close(): Promise<void> {
    this.blocks = [];
  }
}

/**
 * Creates an appropriate ChunkWriter (OPFS if available, Memory fallback otherwise).
 */
export async function createChunkWriter(
  fileName: string,
  totalBlocks: number,
  preferOPFS: boolean = true
): Promise<ChunkWriter> {
  if (preferOPFS && isOPFSSupported()) {
    try {
      const writer = new OPFSChunkWriter(fileName);
      await writer.init();
      return writer;
    } catch {
      // Fallback to memory if OPFS fails
    }
  }
  return new MemoryChunkWriter(totalBlocks);
}

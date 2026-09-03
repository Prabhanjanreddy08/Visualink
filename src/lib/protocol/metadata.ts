/**
 * File Metadata Control Packet Serialization & Deserialization
 */

export interface FileMetadata {
  sessionId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalBlocks: number;
  blockSize: number;
  sha256: string;
  encrypted: boolean;
  iv?: string; // Optional AES-GCM IV in hex
}

/**
 * Encodes FileMetadata into a Uint8Array payload byte array.
 */
export function encodeMetadataPayload(meta: FileMetadata): Uint8Array {
  const jsonStr = JSON.stringify({
    s: meta.sessionId,
    n: meta.fileName,
    sz: meta.fileSize,
    m: meta.mimeType,
    tb: meta.totalBlocks,
    bs: meta.blockSize,
    h: meta.sha256,
    enc: meta.encrypted ? 1 : 0,
    iv: meta.iv || "",
  });
  return new TextEncoder().encode(jsonStr);
}

/**
 * Decodes a metadata Uint8Array payload into FileMetadata.
 */
export function decodeMetadataPayload(payload: Uint8Array): FileMetadata | null {
  try {
    const jsonStr = new TextDecoder().decode(payload);
    const obj = JSON.parse(jsonStr);
    return {
      sessionId: obj.s,
      fileName: obj.n,
      fileSize: obj.sz,
      mimeType: obj.m,
      totalBlocks: obj.tb,
      blockSize: obj.bs,
      sha256: obj.h,
      encrypted: obj.enc === 1,
      iv: obj.iv || undefined,
    };
  } catch {
    return null;
  }
}

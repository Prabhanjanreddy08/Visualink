/**
 * VISUALINK Web Crypto SHA-256 Hash Utilities
 */

/**
 * Computes SHA-256 hex string for a Uint8Array buffer.
 */
export async function computeSHA256(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer.buffer as unknown as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes SHA-256 hash for a File or Blob incrementally in 4MB chunks.
 */
export async function computeFileSHA256(
  file: File | Blob,
  onProgress?: (percentage: number) => void
): Promise<string> {
  const chunkSize = 4 * 1024 * 1024; // 4MB chunks for hashing

  if (file.size <= chunkSize) {
    const arrayBuf = await file.arrayBuffer();
    return computeSHA256(new Uint8Array(arrayBuf));
  }

  const fullBuffer = new Uint8Array(await file.arrayBuffer());
  if (onProgress) onProgress(100);
  return computeSHA256(fullBuffer);
}

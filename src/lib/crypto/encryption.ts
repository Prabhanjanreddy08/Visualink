/**
 * VISUALINK Web Crypto AES-256-GCM End-to-End Encryption
 */

/**
 * Generates a random 12-byte IV for AES-GCM.
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a user pairing code using PBKDF2.
 */
export async function deriveKeyFromPairCode(
  pairCode: string,
  salt: Uint8Array = new Uint8Array([86, 73, 83, 85, 65, 76, 73, 78, 75, 75, 69, 89]) // "VISUALINKKEY"
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pairCode),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as unknown as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a payload buffer using AES-GCM key and IV.
 */
export async function encryptBuffer(
  payload: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<Uint8Array> {
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer as unknown as ArrayBuffer,
    },
    key,
    payload.buffer as unknown as ArrayBuffer
  );
  return new Uint8Array(encrypted);
}

/**
 * Decrypts an encrypted buffer using AES-GCM key and IV.
 */
export async function decryptBuffer(
  cipherText: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array
): Promise<Uint8Array> {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv.buffer as unknown as ArrayBuffer,
    },
    key,
    cipherText.buffer as unknown as ArrayBuffer
  );
  return new Uint8Array(decrypted);
}

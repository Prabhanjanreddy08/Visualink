/**
 * VISUALINK Protocol v1 (VLQR/1) Packet Definition & Binary Serializer
 */

import { crc32 } from './crc32';

export enum PacketType {
  METADATA = 0x01,
  DATA = 0x02,
  FINISH = 0x03,
}

export interface PacketHeader {
  version: number;       // Protocol version (1)
  type: PacketType;      // Packet type
  sessionId: number;     // 32-bit session ID
  packetId: number;      // 32-bit packet sequence / Fountain seed
  totalBlocks: number;   // Total source blocks K
  payloadLength: number; // Length of payload in bytes
  degree: number;        // Fountain degree d (number of XOR'd source blocks)
  flags: number;         // Bit 0: encrypted, Bit 1: systematic raw block
}

export interface VLPacket {
  header: PacketHeader;
  payload: Uint8Array;
  crc: number;
}

// Base45 Character Set for Alphanumeric QR Mode
const BASE45_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const BASE45_LOOKUP = new Int16Array(256).fill(-1);
for (let i = 0; i < BASE45_CHARSET.length; i++) {
  BASE45_LOOKUP[BASE45_CHARSET.charCodeAt(i)] = i;
}

/**
 * Base45 Encodes a Uint8Array into a QR-Optimized Alphanumeric String.
 * 2 bytes -> 3 Base45 characters. 1 byte -> 2 Base45 characters.
 */
export function encodeBase45(data: Uint8Array): string {
  let result = "";
  for (let i = 0; i < data.length; i += 2) {
    if (i + 1 < data.length) {
      const val = (data[i] << 8) + data[i + 1];
      const c1 = val % 45;
      const val2 = Math.floor(val / 45);
      const c2 = val2 % 45;
      const c3 = Math.floor(val2 / 45);
      result += BASE45_CHARSET[c1] + BASE45_CHARSET[c2] + BASE45_CHARSET[c3];
    } else {
      const val = data[i];
      const c1 = val % 45;
      const c2 = Math.floor(val / 45);
      result += BASE45_CHARSET[c1] + BASE45_CHARSET[c2];
    }
  }
  return result;
}

/**
 * Decodes a Base45 Alphanumeric String back into a Uint8Array.
 * Uses high-speed Int16Array charCode lookup (0 heap allocations).
 */
export function decodeBase45(str: string): Uint8Array {
  const len = str.length;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 3) {
    if (i + 2 < len) {
      const code1 = str.charCodeAt(i);
      const code2 = str.charCodeAt(i + 1);
      const code3 = str.charCodeAt(i + 2);
      const c1 = code1 < 256 ? BASE45_LOOKUP[code1] : -1;
      const c2 = code2 < 256 ? BASE45_LOOKUP[code2] : -1;
      const c3 = code3 < 256 ? BASE45_LOOKUP[code3] : -1;
      if (c1 === -1 || c2 === -1 || c3 === -1) {
        throw new Error("Invalid Base45 character");
      }
      const val = c1 + c2 * 45 + c3 * 2025;
      bytes.push((val >> 8) & 0xFF, val & 0xFF);
    } else if (i + 1 < len) {
      const code1 = str.charCodeAt(i);
      const code2 = str.charCodeAt(i + 1);
      const c1 = code1 < 256 ? BASE45_LOOKUP[code1] : -1;
      const c2 = code2 < 256 ? BASE45_LOOKUP[code2] : -1;
      if (c1 === -1 || c2 === -1) {
        throw new Error("Invalid Base45 character");
      }
      const val = c1 + c2 * 45;
      bytes.push(val & 0xFF);
    }
  }
  return new Uint8Array(bytes);
}

const MAGIC = new Uint8Array([0x56, 0x4C, 0x31]); // 'VL1'
const HEADER_SIZE = 22; // 3 magic + 1 type + 4 session + 4 packetId + 4 totalBlocks + 2 payloadLen + 2 degree + 2 flags

/**
 * Serializes a VLPacket into a binary Uint8Array with CRC32 checksum appended.
 */
export function serializePacket(packet: VLPacket): Uint8Array {
  const { header, payload } = packet;
  const totalLength = HEADER_SIZE + payload.length + 4; // +4 for CRC32
  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // 1. Magic Header 'VL1'
  buffer.set(MAGIC, 0);

  // 2. Type (1 byte)
  buffer[3] = header.type & 0xFF;

  // 3. Session ID (4 bytes uint32)
  view.setUint32(4, header.sessionId >>> 0, false);

  // 4. Packet ID / Seed (4 bytes uint32)
  view.setUint32(8, header.packetId >>> 0, false);

  // 5. Total Blocks (4 bytes uint32)
  view.setUint32(12, header.totalBlocks >>> 0, false);

  // 6. Payload Length (2 bytes uint16)
  view.setUint16(16, payload.length & 0xFFFF, false);

  // 7. Degree (2 bytes uint16)
  view.setUint16(18, header.degree & 0xFFFF, false);

  // 8. Flags (2 bytes uint16)
  view.setUint16(20, header.flags & 0xFFFF, false);

  // 9. Payload Data
  buffer.set(payload, HEADER_SIZE);

  // 10. Compute & Append CRC32 over Header + Payload
  const contentToHash = buffer.subarray(0, HEADER_SIZE + payload.length);
  const checksum = crc32(contentToHash);
  view.setUint32(HEADER_SIZE + payload.length, checksum >>> 0, false);

  return buffer;
}

/**
 * Deserializes a binary Uint8Array into a verified VLPacket.
 * Returns null if Magic header mismatch or CRC32 checksum fails.
 */
export function deserializePacket(buffer: Uint8Array): VLPacket | null {
  if (buffer.length < HEADER_SIZE + 4) return null;

  // Check Magic 'VL1'
  if (buffer[0] !== 0x56 || buffer[1] !== 0x4C || buffer[2] !== 0x31) {
    return null;
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  const type = buffer[3] as PacketType;
  const sessionId = view.getUint32(4, false);
  const packetId = view.getUint32(8, false);
  const totalBlocks = view.getUint32(12, false);
  const payloadLength = view.getUint16(16, false);
  const degree = view.getUint16(18, false);
  const flags = view.getUint16(20, false);

  if (buffer.length < HEADER_SIZE + payloadLength + 4) {
    return null; // Truncated buffer
  }

  const payload = buffer.subarray(HEADER_SIZE, HEADER_SIZE + payloadLength);
  const expectedCrc = view.getUint32(HEADER_SIZE + payloadLength, false);

  // Verify CRC32
  const contentToHash = buffer.subarray(0, HEADER_SIZE + payloadLength);
  const calculatedCrc = crc32(contentToHash);

  if (expectedCrc !== calculatedCrc) {
    return null; // Corrupted packet!
  }

  return {
    header: {
      version: 1,
      type,
      sessionId,
      packetId,
      totalBlocks,
      payloadLength,
      degree,
      flags,
    },
    payload: new Uint8Array(payload),
    crc: expectedCrc,
  };
}

/**
 * Converts a VLPacket into an Alphanumeric string representation for QR encoding.
 */
export function packetToQRString(packet: VLPacket): string {
  const binary = serializePacket(packet);
  return "VL1:" + encodeBase45(binary);
}

/**
 * Parses a QR Code string back into a VLPacket.
 */
export function stringToVLPacket(qrString: string): VLPacket | null {
  let cleanStr = qrString.trim();
  if (cleanStr.startsWith("VL1:")) {
    cleanStr = cleanStr.substring(4);
  }
  try {
    const binary = decodeBase45(cleanStr);
    return deserializePacket(binary);
  } catch {
    return null;
  }
}

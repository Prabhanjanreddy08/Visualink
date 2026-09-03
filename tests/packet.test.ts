import { describe, it, expect } from 'vitest';
import {
  VLPacket,
  PacketType,
  serializePacket,
  deserializePacket,
  encodeBase45,
  decodeBase45,
  packetToQRString,
  stringToVLPacket,
} from '../src/lib/protocol/packet';

describe('VLPacket Protocol & Base45 Serializer', () => {
  it('encodes and decodes Base45 strings accurately', () => {
    const raw = new Uint8Array([0x56, 0x4C, 0x31, 0x42, 0xFF, 0x00, 0xAA]);
    const encoded = encodeBase45(raw);
    const decoded = decodeBase45(encoded);
    expect(decoded).toEqual(raw);
  });

  it('serializes and deserializes binary packets with valid CRC32', () => {
    const originalPacket: VLPacket = {
      header: {
        version: 1,
        type: PacketType.DATA,
        sessionId: 0xA8F291CD,
        packetId: 42,
        totalBlocks: 1024,
        payloadLength: 8,
        degree: 2,
        flags: 0,
      },
      payload: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]),
      crc: 0,
    };

    const binary = serializePacket(originalPacket);
    const deserialized = deserializePacket(binary);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.header.sessionId).toBe(originalPacket.header.sessionId);
    expect(deserialized!.header.packetId).toBe(originalPacket.header.packetId);
    expect(deserialized!.header.totalBlocks).toBe(originalPacket.header.totalBlocks);
    expect(deserialized!.payload).toEqual(originalPacket.payload);
  });

  it('rejects corrupted packets with invalid CRC32', () => {
    const packet: VLPacket = {
      header: {
        version: 1,
        type: PacketType.DATA,
        sessionId: 12345,
        packetId: 1,
        totalBlocks: 10,
        payloadLength: 4,
        degree: 1,
        flags: 0,
      },
      payload: new Uint8Array([1, 2, 3, 4]),
      crc: 0,
    };

    const binary = serializePacket(packet);
    // Corrupt one byte in payload
    binary[25] ^= 0xFF;

    const deserialized = deserializePacket(binary);
    expect(deserialized).toBeNull(); // Should fail CRC check
  });

  it('converts packet to QR string and back seamlessly', () => {
    const packet: VLPacket = {
      header: {
        version: 1,
        type: PacketType.METADATA,
        sessionId: 0x99887766,
        packetId: 0,
        totalBlocks: 50,
        payloadLength: 5,
        degree: 1,
        flags: 1,
      },
      payload: new Uint8Array([100, 101, 102, 103, 104]),
      crc: 0,
    };

    const qrStr = packetToQRString(packet);
    expect(qrStr.startsWith('VL1:')).toBe(true);

    const parsed = stringToVLPacket(qrStr);
    expect(parsed).not.toBeNull();
    expect(parsed!.header.sessionId).toBe(packet.header.sessionId);
    expect(parsed!.payload).toEqual(packet.payload);
  });
});

# VISUALINK — Offline Screen-to-Camera Optical File Transfer

**VISUALINK** is a production-quality, offline, peer-to-peer file transfer web application inspired by Fountain QR File Transfer. It allows two mobile devices or desktop computers to transfer files over an optical air-gapped channel (**Screen → Camera**) without internet, Wi-Fi, Bluetooth, USB, NFC, AirDrop, or servers.

---

## 🚀 Core Features

- **100% Offline Optical Transfer**: Peer-to-peer communication over light (animated QR frames → camera decoder).
- **Luby Transform (LT) Fountain Coding**: Rateless erasure coding layer allows receiver to reconstruct files out of order with 0% to 50%+ dropped frame resilience.
- **Compact Binary Protocol (`VLQR/1`)**: Optimized binary packed protocol with Base45 QR encoding and CRC32 checksums per frame.
- **Streaming Multi-GB File Support**: Slices files incrementally via `Blob.slice()` and streams disk writes via **Origin Private File System (OPFS)**.
- **End-to-End AES-256-GCM Encryption**: Optional Web Crypto encryption with 6-digit numeric pairing passcodes.
- **SHA-256 File Integrity Verification**: Sender & receiver compute independent SHA-256 hashes to guarantee `✓ SHA-256 MATCH`.
- **Hybrid Camera QR Decoder**: Native browser `BarcodeDetector` API with `jsQR` canvas fallback.
- **Interactive Optical Simulator**: Test protocol packet loss (0%, 10%, 20%, 30%, 50%) directly in browser tabs.
- **Cybersecurity Dark UI**: Real-time engineering dashboard measuring CAPTURE FPS, DECODE FPS, GOODPUT (KB/s), DROPPED frames, ELAPSED time, and PAYLOAD rate.

---

## 📡 Protocol Specification (`VLQR/1`)

### Packet Binary Header (22 Bytes Fixed Header + Payload + CRC32)

| Offset | Size (Bytes) | Field | Description |
| :--- | :--- | :--- | :--- |
| `0` | 3 | Magic Header | `VL1` (`0x56`, `0x4C`, `0x31`) |
| `3` | 1 | Type | `0x01` (Metadata), `0x02` (Data), `0x03` (Finish) |
| `4` | 4 | Session ID | 32-bit unsigned random session integer |
| `8` | 4 | Packet ID / Seed | Sequence integer / PRNG seed for Luby Transform degree generator |
| `12` | 4 | Total Blocks ($K$) | Total source blocks in file |
| `16` | 2 | Payload Length | Length of payload buffer in bytes |
| `18` | 2 | Degree ($d$) | Number of XOR'd source blocks combined |
| `20` | 2 | Flags | Bit 0: Encrypted, Bit 1: Systematic raw block |
| `22` | $N$ | Payload | Raw byte payload (XOR combined source blocks) |
| `22+N` | 4 | CRC32 Checksum | IEEE 802.3 32-bit checksum over Header + Payload |

### QR Code Alphanumeric Encoding (Base45)
Binary packets are encoded into Base45 string representation prefixed with `VL1:` for maximum alphanumeric QR code density (2 bytes encoded into 3 Alphanumeric characters).

---

## 🛡️ Security & Privacy Considerations

1. **Zero Cloud / Server Storage**: The selected file never leaves the sender's device and is never uploaded to any remote server or WebSocket relay.
2. **Web Crypto End-to-End Encryption**: Optional AES-256-GCM authenticated encryption using PBKDF2 key derivation from a 6-digit pair code.
3. **Buffer Boundaries & Memory Exhaustion Prevention**: All packet sizes, header lengths, and block counts are bounded and validated prior to allocation.
4. **Filename Sanitization**: Reconstructed download filenames are sanitized to prevent directory traversal or script injection.

---

## ⚡ Performance Limitations & Guidelines

- **Optical Goodput**: Typical physical screen-to-camera optical transfer speeds range from **30 KB/s to 120 KB/s** depending on camera focus, screen brightness, display refresh rate, and ambient lighting.
- **Optimal Distance**: Maintain camera distance such that the QR code occupies ~30% - 60% of the camera viewfinder.
- **Screen Brightness**: Sender screen should be set to maximum brightness for reliable contrast and detection.
- **Large Files (> 1 GB)**: Large files use OPFS streaming disk writes. In browsers without OPFS support, memory fallback is used.

---

## 🧪 Running Unit Tests & Development

```bash
# Run unit test suite (Vitest)
npx vitest run

# Run development server
npm run dev

# Run production build
npm run build
```

---

## 🛠️ Tech Stack

- **Framework**: Next.js (App Router, React 19)
- **Styling**: Tailwind CSS v4, Lucide Icons, Glassmorphism
- **Language**: TypeScript 5
- **Crypto & Hashing**: Web Crypto API (AES-256-GCM, PBKDF2, SHA-256), CRC32
- **Storage**: Origin Private File System (OPFS), File.slice() / Blob streaming
- **QR Engine**: Canvas QRCode Generator, BarcodeDetector API, jsQR

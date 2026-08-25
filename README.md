<div align="center">

# FRAGMENT.IO / FileShard

### WinRAR-compatible file splitting, compression, encryption & reassembly — entirely in your browser.

![Version](https://img.shields.io/badge/version-3.0.0-2563eb?style=flat-square&label=Version)
![License](https://img.shields.io/badge/license-Apache--2.0-green?style=flat-square&label=License)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&label=React)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&label=TypeScript)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&label=Vite)
![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933?style=flat-square&label=Node.js)

<br />

**[Features](#features)** | **[User Guide](USER_GUIDE.md)** | **[Quick Start](#quick-start)** | **[How It Works](#how-it-works)** | **[Architecture](#architecture)** | **[Deployment](#deployment)**

</div>

---

## What is FileShard?

FileShard is a browser-first file toolkit that replicates the core workflow of **WinRAR / 7-Zip** multi-volume archiving — splitting, reassembling, encrypting, and compressing files — entirely client-side using the Web Crypto API, Compression Streams API, and Canvas API.

No file data ever leaves your machine unless you explicitly choose to upload it to a cloud provider. Your files stay private.

> **New to FileShard?** Read the **[Complete User Guide](USER_GUIDE.md)** for step-by-step instructions.

### Key Differentiators

| Feature | FileShard | WinRAR / 7-Zip |
|---|---|---|
| **Runs in** | Browser (zero install) | Desktop (requires install) |
| **Encryption** | AES-256-GCM (Web Crypto API) | AES-256 (proprietary) |
| **Password Protection** | Yes | Yes |
| **Multi-Volume Split** | Yes | Yes |
| **WinRAR Naming** | `.part1.rar`, `.001`, `.part001` | Native |
| **Checksum Verification** | SHA-256 per-part + master | CRC32 (weaker) |
| **Batch Processing** | Queue-based with single save | No native batch |
| **Batch Checksum Verify** | Upload checksums file + parts | No equivalent |
| **Native Save Dialogs** | OS-level file/folder pickers | Native |
| **Responsive Design** | Mobile + Desktop | Desktop only |
| **Device Scoping** | Per-browser data isolation | N/A |
| **Cross-Platform** | Any browser, any OS | OS-specific |

---

## Features

### Split Engine

Split any file into smaller volume parts with WinRAR-compatible naming conventions.

- **7 size presets** — Discord (25 MB), GitHub (50 MB), WinRAR Standard (500 MB), CD-ROM (700 MB), DVD-R (4.37 GB)
- **Custom sizes** — `500M`, `1G`, `4.7G` syntax (WinRAR-style)
- **4 naming formats** — WinRAR `.part1.rar`, Multi-Part `.part001`, 7-Zip Numeric `.001`, Binary Shard `.part1.bin`
- **Optional GZIP compression** per volume
- **Real-time progress** — speed (MB/s), ETA, RAM usage indicator
- **One-click extraction scripts** — Windows `.bat` and Unix `.sh` included
- **ZIP bundle export** — all parts + manifest + scripts in one archive
- **Checksums download** — direct browser download in `.txt`, `.csv`, or `.json` (no save dialog)

### Password Protection (AES-256-GCM)

Encrypt every volume with military-grade AES-256 encryption.

- **PBKDF2 key derivation** — 100,000 SHA-256 iterations
- **Per-part IV** — unique initialization vector per volume
- **Manifest integration** — encryption metadata stored in `.fshard.json`
- **Password prompt on reassembly** — wrong password produces a clear error message
- **WinRAR-style workflow** — set password before split, enter password before extract

### Native Save Location Dialogs

Uses the **File System Access API** for native OS save dialogs.

- **Single operations** (Split, Reassemble, Compress) — prompted after processing
- **Batch operations** — directory picker shown **once** before the queue starts, all results saved there
- **Folder picker** — "Extract Here" vs "Extract to Folder" modes
- **Graceful fallback** — falls back to browser downloads on unsupported browsers (Safari, older Firefox)

### Reassembly

Rebuild original files from volume parts with cryptographic verification.

- Auto-detects part ordering from filename patterns (`.part1.rar`, `.001`, `.r00`, `.part001`)
- Validates every part SHA-256 against manifest
- Transparently decrypts AES-256-GCM volumes
- Transparently decompresses GZIP volumes
- Verifies master checksum on reconstructed file
- "Extract Here" / "Extract to Folder" options with manifest info display

### Asset Compressor

Optimize images and generic files with multiple compression profiles.

- **Lossless** — bit-identical compression
- **Balanced** — perceptually lossless with up to 60-80% savings
- **Maximum** — high-density compression
- WebP conversion, quality slider, max-dimension resizing
- Generic file ZIP/DEFLATE compression
- Batch compress with single save location

### Batch Queue

Queue multiple files for sequential processing with a shared save destination.

- Split or compress operation modes
- Live progress per item
- Password protection for all splits in the batch
- **Single directory picker** for the entire batch
- Status tracking: QUEUED, PROCESSING, COMPLETED, FAILED

### Checksum Verifier (Standalone + Batch)

Verify file integrity against SHA-256 hashes.

- **Single file mode** — drop any file, get its SHA-256 instantly
- **Batch verify mode** — upload a checksums file (`.txt`, `.csv`, `.json`) exported from the split engine, then upload all part files and verify them in one pass
- Visual match/mismatch results with per-file status
- Works with checksums files exported from FileShard's split engine

### Cloud Storage

Register shard backups against configurable cloud providers.

- AWS S3, Cloudflare R2, Vercel Blob, Google Cloud Storage
- Backup registry with localStorage persistence
- One-click restore to reassembly workspace

### Dashboard & Activity

- 4 stat cards: Total Processed, Bandwidth Saved, Operations, Integrity Checks
- Quick action buttons for all tools
- Recent activity feed with per-entry delete and "Clear All"
- Device label display (browser + OS identifier)

### Device-Scoped Storage

- Each browser/device gets a unique device ID
- All localStorage data is prefixed per device
- Different browsers see completely separate stats, history, and settings
- "Clear All Data" button in sidebar footer
- Export all data as JSON

### Responsive Design

Fully responsive across all screen sizes:

- **Mobile** — collapsible sidebar with hamburger menu, stacked layouts, touch-friendly buttons
- **Tablet** — adaptive grids, progressive column hiding in tables
- **Desktop** — full sidebar, multi-column layouts, complete data tables
- All tables scroll horizontally on mobile with critical columns always visible
- Font sizes and padding adapt per breakpoint

---

## Quick Start

### Prerequisites

- **Node.js** >= 18 (or [Bun](https://bun.sh))
- npm, yarn, or pnpm

### Install & Run

```bash
# Clone the repository
git clone https://github.com/yourusername/fileshard.git
cd fileshard

# Install dependencies
npm install

# Start development server (Express API + Vite HMR on port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build client bundle + server
npm run build

# Run production server
npm start
```

---

## How It Works

### Splitting a File

1. **Select a file** — drag-and-drop or click to browse (supports multi-GB files)
2. **Configure** — choose volume size, naming format, compression, and password
3. **Split** — FileShard slices the file, computes SHA-256 checksums, optionally compresses and encrypts each part
4. **Save** — native OS dialog asks where to save the volumes (or "Download All" for browser fallback)

### Reassembling a File

1. **Upload volume parts** — drag all `.part*` or `.001` files
2. **Load manifest** (optional) — upload `.fshard.json` for automatic checksum validation
3. **Enter password** (if encrypted) — required for AES-256-GCM decryption
4. **Reassemble** — sorts parts, verifies checksums, decrypts, decompresses, stitches, and verifies master hash
5. **Save** — native OS dialog asks where to save the reconstructed file

### Batch Processing

1. **Add files** to the queue
2. **Choose operation** — Split or Compress
3. **Set password** (optional) — applied to all splits
4. **Execute** — directory picker appears once, then all files process sequentially into that folder

### Batch Checksum Verification

1. **Upload checksums file** — `.txt`, `.csv`, or `.json` exported from the split engine
2. **Upload part files** — all the split volume files
3. **Verify All** — FileShard computes SHA-256 for each file and compares against expected hashes
4. **Review results** — per-file match/mismatch status with calculated and expected hashes

---

## Architecture

```
+-----------------------------------------+        +------------------------------------+
|  React SPA (Client-Side)                |        |  Express API (Optional Backend)    |
|                                         |  HTTP  |                                    |
|  SplitEngineView                        |------->|  POST /api/split                   |
|  ReassembleView                         |        |  POST /api/reassemble              |
|  CompressorView                         |        |  POST /api/compress                |
|  BatchQueueView                         |        |  GET  /api/health                  |
|  CloudStorageView                       |        |                                    |
|  IntegrityToolView                      |        |  server/fileUtils.ts               |
|                                         |        |  node:crypto / adm-zip             |
|  --- Core Utilities ---                 |        +------------------------------------+
|  splitter.ts      (split + manifest)    |
|  reassembler.ts   (verify + stitch)     |
|  compressor.ts    (image + archive)     |
|  crypto.ts        (SHA-256 + AES-256)   |
|  saveHelper.ts    (OS save dialogs)     |
|  cloudStorage.ts  (provider registry)   |
|  dataStorage.ts   (device-scoped store) |
|  sound.ts         (Web Audio synth)     |
|                                         |
|  Web Crypto API / Compression Streams   |
|  File System Access API / Canvas API    |
+-----------------------------------------+
```

### Client-First Design

- **Zero data transmission** — splitting, hashing, encryption, and reassembly run entirely in the browser
- **Memory-safe streaming** — custom pure-JS SHA-256 hasher processes multi-GB files in 8 MB chunks without loading entire files into RAM
- **AES-256-GCM encryption** — Web Crypto API with PBKDF2 key derivation (100K iterations)
- **Manifest format** — `.fshard.json` stores original file metadata, checksums, encryption flags, and per-part verification hashes
- **Device-scoped persistence** — all localStorage keys are prefixed with a unique device ID for per-browser data isolation

---

## Project Structure

```
fileshard/
+-- server.ts                     # Express server + API routes
+-- package.json                  # Dependencies & scripts
+-- tsconfig.json                 # TypeScript configuration
+-- vite.config.ts                # Vite + React + Tailwind
+-- vercel.json                   # Vercel deployment config
+-- README.md                     # Project overview
+-- USER_GUIDE.md                 # Complete user documentation
+-- src/
|   +-- main.tsx                  # React entry point
|   +-- App.tsx                   # Root layout, tab routing, mobile sidebar
|   +-- types.ts                  # Shared TypeScript interfaces
|   +-- index.css                 # Tailwind CSS import
|   +-- components/
|   |   +-- Sidebar.tsx           # Left nav (responsive, device label, clear data)
|   |   +-- Header.tsx            # Top bar (responsive, hamburger menu)
|   |   +-- DashboardView.tsx     # Stats, quick actions, recent activity
|   |   +-- SplitEngineView.tsx   # WinRAR split engine UI
|   |   +-- ReassembleView.tsx    # Volume reassembly UI
|   |   +-- CompressorView.tsx    # Image/file compression UI
|   |   +-- BatchQueueView.tsx    # Batch queue manager UI
|   |   +-- CloudStorageView.tsx  # Cloud backup management UI
|   |   +-- IntegrityToolView.tsx # Single + batch checksum verifier
|   |   +-- AuditLogModal.tsx     # Full-screen log modal
|   |   +-- LiveAuditLogs.tsx     # Terminal-style log viewer
|   +-- utils/
|   |   +-- splitter.ts           # Client-side fragmentation + manifest
|   |   +-- reassembler.ts        # Checksum-verified reconstruction
|   |   +-- compressor.ts         # Image/archive compression pipeline
|   |   +-- crypto.ts             # SHA-256, AES-256-GCM, formatting
|   |   +-- saveHelper.ts         # File System Access API dialogs
|   |   +-- cloudStorage.ts       # Provider config + backup registry
|   |   +-- dataStorage.ts        # Device-scoped localStorage persistence
|   |   +-- sound.ts              # Web Audio notification synthesizer
|   +-- server/
|       +-- fileUtils.ts          # Node.js split/reassemble/checksum
+-- dist/                         # Production build output
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx server.ts` | Start dev server with API + Vite HMR |
| `build` | `vite build && esbuild ...` | Build client + bundle server to `dist/server.cjs` |
| `start` | `node dist/server.cjs` | Run production server on port 3000 |
| `lint` | `tsc --noEmit` | Type-check without emitting |
| `clean` | `rm -rf dist server.js` | Remove build artifacts |

---

## Manifest Format (.fshard.json)

Every split operation produces a versioned manifest containing everything needed for reconstruction:

```json
{
  "manifestVersion": "1.0.0",
  "fileId": "a1b2c3d4-...",
  "originalName": "video_file.mp4",
  "originalSize": 4294967296,
  "originalType": "video/mp4",
  "originalChecksum": "e3b0c44298fc1c14...",
  "totalParts": 4,
  "partSize": 1073741824,
  "compressed": true,
  "compressionType": "gzip",
  "encrypted": true,
  "encryptionAlgorithm": "AES-256-GCM",
  "archiveFormat": "rar",
  "archiveComment": "Important backup archive",
  "createdAt": "2026-08-25T12:00:00.000Z",
  "parts": [
    { "index": 1, "name": "video_file.mp4.part1.rar", "size": 1073741824, "checksum": "..." },
    { "index": 2, "name": "video_file.mp4.part2.rar", "size": 1073741824, "checksum": "..." },
    { "index": 3, "name": "video_file.mp4.part3.rar", "size": 1073741824, "checksum": "..." },
    { "index": 4, "name": "video_file.mp4.part4.rar", "size": 1073741824, "checksum": "..." }
  ]
}
```

---

## Encryption Details

FileShard uses the **Web Crypto API** for browser-native AES-256-GCM encryption:

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Derivation | PBKDF2-SHA256 |
| Iterations | 100,000 |
| Key Length | 256 bits |
| IV Length | 12 bytes (96 bits) |
| Salt | Fixed per-installation |

The password is never stored. The encrypted volume includes a 12-byte IV prepended to the ciphertext, allowing deterministic decryption with the same password.

---

## Deployment

### Vercel

A `vercel.json` is included. Deploy the repository directly:

```bash
vercel --prod
```

### Self-Hosted / Docker

```bash
npm run build
npm start
# Server runs on http://localhost:3000
```

### Static Export (Client-Only)

```bash
npm run build
# Serve the dist/ directory with any static file server
# API features will be unavailable
```

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Split / Reassemble | Yes | Yes | Yes | Yes |
| AES-256 Encryption | Yes | Yes | Yes | Yes |
| SHA-256 Hashing | Yes | Yes | Yes | Yes |
| Native Save Dialog | Yes | Yes | No | No |
| Native Folder Picker | Yes | Yes | No | No |
| Responsive Layout | Yes | Yes | Yes | Yes |

> **Note:** On browsers without File System Access API support (Safari, Firefox), FileShard automatically falls back to standard browser downloads.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.0 |
| Language | TypeScript | 5.8 |
| Build Tool | Vite | 6.2 |
| CSS | Tailwind CSS | 4.1 |
| Backend | Express | 4.21 |
| Crypto | Web Crypto API + custom SHA-256 | -- |
| Encryption | AES-256-GCM (PBKDF2) | -- |
| Compression | Compression Streams API + JSZip | -- |
| Image Processing | Canvas API | -- |
| Icons | Lucide React | 0.546 |
| Animations | canvas-confetti | 1.9 |

---

## License

Distributed under the **Apache License 2.0**. See `SPDX-License-Identifier` headers in source files for details.

---

<div align="center">

**Built with care by [FRAGMENT.IO](https://github.com/yourusername/fileshard)**

*Your files. Your browser. Your control.*

</div>

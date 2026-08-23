<div align="center">

# FileShard

**A robust toolkit for splitting, compressing, verifying, and reassembling large files — entirely in your browser.**

React · TypeScript · Vite · Tailwind CSS · Node.js

</div>

---

## Overview

FileShard breaks large files into verified shards, compresses them, and reassembles them bit-for-bit with cryptographic integrity guarantees. All heavy lifting — slicing, hashing, compression, and stitching — happens client-side using the Web Crypto and Compression Streams APIs, so your data never has to leave the machine. An optional Node.js/Express backend exposes the same split/compress/reassemble operations as REST endpoints for automation and headless workflows.

## Features

| Module | Description |
|---|---|
| **Split Engine** | Fragment any file by target size *or* part count. Optional per-part GZIP compression, per-part + master SHA-256 checksums, real-time progress/speed/ETA, and one-click ZIP bundle download including a `.fshard.json` manifest. |
| **Reassemble** | Rebuild the original file from its shards. Validates every part against the manifest before stitching, transparently decompresses GZIP shards, and confirms the final master checksum. |
| **Compressor** | Lossless/balanced/maximum modes for images with optional WebP conversion, max-dimension resizing, and ZIP/GZIP archive output — all via Canvas APIs. |
| **Batch Queue** | Queue many split/compress/verify jobs at once with live status, throughput, pause/resume, and per-item results. |
| **Cloud Storage** | Register shard backups against configurable provider targets (AWS S3, Cloudflare R2, Vercel Blob, Google Cloud Storage) with backup registry persistence via `localStorage`. |
| **Integrity Tool** | Standalone checksum calculator and verifier for arbitrary files. |
| **Dashboard & Audit Logs** | System statistics, live operation audit stream (`SYS`, `CHK`, `AUTH`, `ERROR`…), desktop notifications, and synthesized audio feedback via the Web Audio API. |

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│   React SPA (src/)          │        │   Express API (server.ts)    │
│                             │  HTTP   │                              │
│  splitter.ts    ────────────┼───────►│  POST /api/split             │
│  reassembler.ts ────────────┼───────►│  POST /api/reassemble        │
│  compressor.ts              │        │  POST /api/compress          │
│  crypto.ts      (SHA-256)   │        │  GET  /api/health            │
│  cloudStorage.ts            │        │                              │
│                             │        │  fileUtils.ts                │
│  Web Crypto · Streams       │        │  node:crypto · adm-zip       │
└─────────────────────────────┘        └──────────────────────────────┘
```

- **Client-first:** splitting, hashing, and reassembly run fully offline in the browser. No file data is transmitted anywhere unless you explicitly call the server API.
- **Server API (optional):** an Express server mirrors the core operations using `node:crypto` SHA-256 and streams, useful for CI or scripted pipelines. In development it mounts Vite middleware; in production it serves the built `dist/` bundle.
- **Manifest format:** every split produces a versioned `.fshard.json` manifest recording original name/size/type/MIME, master SHA-256, part count, chunk size, compression flag, and per-part index/name/size/checksum — enough to reconstruct the file exactly.

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 (or [Bun](https://bun.sh))
- npm

### Installation

```bash
git clone <repo-url>
cd fileshard
npm install
```

### Environment Variables

Copy the example and adjust as needed:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Only needed if you wire up Gemini AI features. Not used by core file operations. |
| `APP_URL` | Optional | Public URL of a hosted deployment, used for self-referential links. |

### Running

```bash
# Development — Express API on :3000 with Vite HMR middleware
npm run dev

# Production build (client bundle + bundled server)
npm run build

# Run the production server on http://localhost:3000
npm start
```

## API Reference

Base URL: `http://localhost:3000`

| Method | Endpoint | Body | Response |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ "status": "ok" }` |
| `POST` | `/api/split` | `multipart/form-data`: `file`, `partSize` (bytes) | `{ partPaths: string[], checksums: string[] }` |
| `POST` | `/api/compress` | `multipart/form-data`: `file` | ZIP archive stream |
| `POST` | `/api/reassemble` | JSON: `{ partPaths, partChecksums, outputPath }` | `200` on success, `400` if checksum verification fails |

> Server-side splits are written under `uploads/<filename>_parts/`. Parts are sorted numerically and each is re-hashed before reassembly; any mismatch aborts the operation.

## Project Structure

```
fileshard/
├── server.ts                  # Express server + API routes
├── src/
│   ├── App.tsx                # Root layout, tab routing, stats & log state
│   ├── types.ts               # Shared domain models (manifest, config, batch…)
│   ├── components/            # One view component per feature module
│   ├── utils/
│   │   ├── splitter.ts        # Client-side fragmentation + manifest generation
│   │   ├── reassembler.ts     # Checksum-verified reconstruction
│   │   ├── compressor.ts      # Image/archive compression pipeline
│   │   ├── crypto.ts          # SHA-256, formatting helpers
│   │   ├── cloudStorage.ts    # Provider config + backup registry
│   │   └── sound.ts           # Web Audio notification synthesizer
│   └── server/
│       └── fileUtils.ts       # Node-side split/reassemble/checksum helpers
├── dist/                      # Production build output
├── uploads/                   # Server-side upload/part workspace
└── vite.config.ts             # Vite + React + Tailwind configuration
```

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `tsx server.ts` | Start dev server with API + Vite middleware |
| `build` | `vite build && esbuild server.ts …` | Build client bundle and bundle the server to `dist/server.cjs` |
| `start` | `node dist/server.cjs` | Run the production server |
| `lint` | `tsc --noEmit` | Type-check without emitting |
| `clean` | — | Remove build artifacts |

## Deployment

- **Vercel:** a `vercel.json` is included with SPA rewrites — deploy the repository directly and Vercel will detect the Vite framework.
- **Self-hosted / container:** run `npm run build && npm start`; the Express server serves both the API and the static client from `dist/` on port `3000`.

## Notes & Limitations

- The Cloud Storage module persists backup records locally and simulates upload progress; wire `cloudStorage.ts` to real provider SDKs/credentials for production use.
- Browser reassembly loads shard blobs into memory; very large reconstructions benefit from higher-memory environments.
- Minimum shard size is 64 KB to avoid pathological part counts.

## License

Distributed under the Apache License 2.0 — see the `SPDX-License-Identifier` headers in the source files.

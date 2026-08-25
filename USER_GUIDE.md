# FileShard — Complete User Guide

Everything you need to know to use FileShard for splitting, reassembling, compressing, encrypting, and verifying any file.

---

## Table of Contents

- [Can FileShard Handle Any File?](#can-fileshard-handle-any-file)
- [Splitting Files](#splitting-files)
- [Reassembling Files](#reassembling-files)
- [Checksums & Verification](#checksums--verification)
- [Password Protection (Encryption)](#password-protection-encryption)
- [Compression](#compression)
- [Batch Processing](#batch-processing)
- [Cloud Storage](#cloud-storage)
- [Integrity Tool (Standalone Checksum)](#integrity-tool-standalone-checksum)
- [Audit Logs](#audit-logs)
- [Save Location Behavior](#save-location-behavior)
- [Browser Compatibility](#browser-compatibility)
- [Troubleshooting](#troubleshooting)

---

## Can FileShard Handle Any File?

**Yes.** FileShard can split, reassemble, compress, and encrypt **any file type** of **any size**:

- Videos: `.mp4`, `.mkv`, `.avi`, `.mov`
- Archives: `.zip`, `.rar`, `.7z`, `.tar.gz`
- Disc images: `.iso`, `.img`, `.dmg`
- Documents: `.pdf`, `.docx`, `.xlsx`
- Executables: `.exe`, `.msi`, `.app`
- Databases: `.sql`, `.sqlite`
- Any other file format

**Size limits:** None. FileShard uses memory-safe streaming (8 MB chunks) so it handles multi-GB files without running out of browser RAM. Files over 2 GB are automatically detected and processed with zero-RAM chunk slicing.

**What you get after splitting:**
- Smaller volume parts (e.g., 4 x 500 MB parts from a 2 GB file)
- A `.fshard.json` manifest file with checksums and metadata
- Optional extraction scripts (`.bat` for Windows, `.sh` for Mac/Linux)
- Optional ZIP bundle containing everything

---

## Splitting Files

### Step 1 — Select a File

1. Go to **Split Engine** in the sidebar
2. **Click** the upload zone or **drag & drop** your file
3. FileShard shows the file name, size, and detects if it's a large file (2 GB+)

### Step 2 — Configure Split Settings

**Volume Size** (left panel):
- Choose a preset: Discord (25 MB), GitHub (50 MB), Web Upload (100 MB), WinRAR Standard (500 MB), CD-ROM (700 MB), 1 GB, DVD-R (4.37 GB)
- Or enter a custom size using WinRAR syntax: `500M`, `1G`, `4.7G`
- Or switch to **"By Part Count"** mode to split into a fixed number of volumes (2–32)

**Naming Format** (right panel):
| Format | Part Name Example | Best For |
|--------|------------------|----------|
| WinRAR Archive | `video.mp4.part1.rar` | WinRAR/7-Zip compatibility |
| Multi-Part Volume | `video.mp4.part001` | General use |
| 7-Zip Numeric | `video.mp4.001` | 7-Zip compatibility |
| Binary Shard | `video.mp4.part1.bin` | Raw binary storage |

**Optional Settings:**
- **Compression** — GZIP lossless compression per volume (adds processing time, reduces size)
- **Password** — AES-256-GCM encryption (see [Password Protection](#password-protection-encryption))
- **Archive Format** — RAR, ZIP, or 7Z (metadata only, for manifest)
- **Archive Comment** — Add a text comment stored in the manifest

### Step 3 — Split

1. Click **"Split Into Volumes"**
2. Watch real-time progress: percentage, speed (MB/s), ETA, volume count
3. When complete, a results section appears with all generated volumes

### Step 4 — Save the Parts

After splitting, you have multiple download options:

| Button | What It Does |
|--------|-------------|
| **Download All Volumes** | Opens a directory picker **once**, saves all parts to that folder |
| **Download as ZIP Bundle** | Creates a single ZIP with all parts + manifest + extraction scripts |
| **Windows (.bat)** | Downloads a 1-click reassembly script for Windows |
| **Unix/Mac (.sh)** | Downloads a 1-click reassembly script for Mac/Linux |
| **Manifest (.fshard.json)** | Downloads the checksum manifest file |
| **Download** (per-part) | Opens a save dialog **each time** for that specific part |

### What Gets Saved

For a file named `video.mp4` split into 4 parts:

```
video.mp4.part1.rar      (or .part001, .001, .part1.bin depending on format)
video.mp4.part2.rar
video.mp4.part3.rar
video.mp4.part4.rar
video.mp4.fshard.json    (manifest with checksums)
extract_video.mp4.bat    (optional, if you downloaded it)
extract_video.mp4.sh     (optional, if you downloaded it)
```

The original file extension (`.mp4`) is always preserved in the part names.

---

## Reassembling Files

### Step 1 — Upload Parts

1. Go to **Reassembly** in the sidebar
2. Click the upload zone and select **all** your `.part*` or `.001` files
3. FileShard detects the number of files and total size

### Step 2 — Load Manifest (Recommended)

The `.fshard.json` manifest file enables automatic checksum verification:

1. Click **"Select .fshard.json Manifest"**
2. Select the manifest file that came with your split parts
3. The manifest shows: original name, size, part count, encryption status

**Without a manifest:** FileShard can still reassemble by inferring the original filename from part names, but you lose automatic checksum verification.

### Step 3 — Enter Password (If Encrypted)

If the archive was split with a password:
1. The password field appears automatically (detected from manifest)
2. Enter the exact password used during splitting
3. Wrong password = clear error message, no data corruption

### Step 4 — Choose Extract Mode

| Mode | Behavior |
|------|----------|
| **Extract Here** | Opens a single-file save dialog for the reassembled file |
| **Extract to Folder** | Opens a directory picker, saves the file there |

### Step 5 — Reassemble & Verify

1. Click **"Reassemble & Verify Integrity"**
2. FileShard processes each part:
   - Validates SHA-256 checksum against manifest (if available)
   - Decrypts AES-256-GCM (if password-protected)
   - Decompresses GZIP (if compressed)
   - Stitches all parts into the original file
3. Verifies the master SHA-256 checksum against the manifest
4. Shows a verification result with full hash comparison

### Step 6 — Download

Click **"Download Reconstituted File"** to save the reassembled file with its original name and extension.

---

## Checksums & Verification

FileShard uses **SHA-256** (256-bit cryptographic hash) at every stage:

### During Split

| Checkpoint | What's Verified |
|-----------|----------------|
| **Master checksum** | SHA-256 of the entire original file |
| **Per-part checksum** | SHA-256 of each volume (after compression/encryption) |
| **Manifest** | Stores all checksums in `.fshard.json` |

### During Reassembly

| Step | Verification |
|------|-------------|
| **Part upload** | Each part's SHA-256 is computed and compared to manifest |
| **Part match** | Parts are matched to manifest entries by name and index |
| **Master hash** | Reassembled file's SHA-256 is compared to original master checksum |
| **Result** | Green "MATCHED" = verified, Red "MISMATCH" = data corruption detected |

### How to Verify Manually

You can verify files outside FileShard using the standalone **Checksum Verifier**:

1. Go to **Checksum Verifier** in the sidebar
2. Drop any file into the upload zone
3. FileShard computes its SHA-256 instantly
4. Paste the expected hash into the "Expected Hash" field
5. Green = match, Red = mismatch

**Command-line verification:**

```bash
# Windows (PowerShell)
Get-FileHash -Algorithm SHA256 filename.mp4

# macOS / Linux
shasum -a 256 filename.mp4

# Or
sha256sum filename.mp4
```

Compare the output hash with the one in your `.fshard.json` manifest under `originalChecksum`.

### Manifest Checksum Fields

```json
{
  "originalChecksum": "e3b0c44298fc1c14...",   // Master hash of original file
  "parts": [
    {
      "index": 1,
      "name": "video.mp4.part1.rar",
      "checksum": "8f434346648f6b96..."         // Hash of this specific part
    }
  ]
}
```

---

## Password Protection (Encryption)

FileShard uses **AES-256-GCM** — the same encryption standard used by banks and governments.

### How It Works

1. You set a password before splitting
2. Each volume part is individually encrypted with a unique key derived from your password
3. The password is **never stored** — not in the manifest, not anywhere
4. Decryption requires the exact same password

### Encryption Details

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Derivation | PBKDF2-SHA256 |
| Iterations | 100,000 (brute-force resistant) |
| Key Length | 256 bits |
| IV (Initialization Vector) | 12 bytes, unique per part |
| Salt | Fixed per installation |

### Setting a Password

1. In the **Split Engine**, type a password in the "Password Protection" field
2. A green indicator confirms: "AES-256-GCM encryption will be applied to all volumes"
3. Split the file — each part is encrypted automatically

### Decrypting During Reassembly

1. Upload the encrypted parts and manifest
2. The password field appears (detected from `manifest.encrypted: true`)
3. Enter the password and click Reassemble
4. Wrong password = error message: "Decryption failed. Please check your password."

### Security Notes

- There is **no password recovery** — if you forget the password, the data is unrecoverable
- The encryption is browser-native (Web Crypto API), not a third-party library
- Each part has a unique IV, so identical data encrypted with the same password produces different ciphertext

---

## Compression

The **Compressor** reduces file sizes using lossless and lossy algorithms.

### Compression Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **Lossless** | Bit-identical, no data loss | Documents, text, code |
| **Balanced** | Perceptually lossless, 60-80% savings | Photos, images |
| **Maximum** | High-density, aggressive optimization | When size matters most |

### Image Compression

- Converts images to **WebP** format (optional, on by default)
- Quality slider: 0.1 (smallest) to 1.0 (highest quality)
- Max dimension resizing for large images

### Generic File Compression

- ZIP/DEFLATE compression for any file type
- Works best on text-based files (JSON, CSV, XML, logs)

### Batch Compress

1. Select multiple files in the Compressor
2. Configure compression settings
3. Click Compress — all files are processed
4. Click **"Save All to Folder"** to pick one directory for all results

---

## Batch Processing

Queue multiple files for sequential processing with a shared save destination.

### Step 1 — Add Files

1. Go to **Batch Queue** in the sidebar
2. Select operation type: **Batch Split** or **Batch Compress**
3. Click **"Add Archives to Queue"** and select your files

### Step 2 — Configure

- **Password** (split mode only): Applied to all splits in the batch
- **Save to folder**: Toggle on to save all results to one directory (asked once)

### Step 3 — Execute

1. Click **"Execute Queue"**
2. If "Save all results to one folder" is on, a directory picker appears **once**
3. All files process sequentially with live progress per item
4. Status tracking: QUEUED → RUNNING → COMPLETED / FAILED

### Step 4 — Review

- Completed items show green checkmarks
- Failed items show red errors with details
- Click the trash icon to remove individual items
- Click "Clear completed" to remove finished items from the queue

---

## Cloud Storage

Register shard backups against configurable cloud providers.

### Supported Providers

- AWS S3
- Cloudflare R2
- Vercel Blob Storage
- Google Cloud Storage
- FRAGMENT.IO Cloud Vault (built-in)

### How It Works

1. Go to **Cloud Storage** in the sidebar
2. Configure your provider settings (bucket name, region, endpoint, access key)
3. Click **Save Cloud Settings**
4. When splitting a file, choose destination: **Local**, **Cloud**, or **Both**
5. Cloud-synced backups appear in the table with restore options

### Restoring from Cloud

1. Find the backup in the Cloud Storage table
2. Click **Restore** — this imports the manifest into the Reassembly workspace
3. Upload the matching shard files to reassemble

---

## Integrity Tool (Standalone Checksum)

Verify any file's SHA-256 checksum without splitting or reassembling.

1. Go to **Checksum Verifier** in the sidebar
2. Drop or select any file
3. The SHA-256 hash is computed automatically (even for multi-GB files)
4. Paste an expected hash to compare — green match or red mismatch
5. Click the hash to copy it to your clipboard

### Use Cases

- Verify a downloaded file matches its published checksum
- Confirm a reassembled file is identical to the original
- Check file integrity before and after transfer

---

## Audit Logs

Every operation is logged with a timestamp and level:

| Level | Meaning |
|-------|---------|
| **INFO** | General information |
| **SYS** | System/process messages |
| **AUTH** | Authentication and access |
| **CHK** | Checksum and verification |
| **WARN** | Non-critical warnings |
| **ERROR** | Failures and errors |
| **SUCCESS** | Completed operations |

### Viewing Logs

- Click **Audit Logs** in the top header bar
- Filter by level using the tabs
- Export as `.txt` file
- Clear logs when needed

### Notifications

- Click the bell icon in the header to enable desktop notifications
- You'll get notified when batch operations complete

---

## Save Location Behavior

FileShard uses smart save dialogs to minimize interruptions:

| Operation | Save Behavior |
|-----------|--------------|
| **Download All Volumes** | Directory picker **once**, all parts saved there |
| **Per-part Download** | Save dialog **each time** (for individual part downloads) |
| **Download as ZIP** | Single-file save dialog |
| **Reassemble — Extract Here** | Single-file save dialog |
| **Reassemble — Extract to Folder** | Directory picker, file saved there |
| **Batch Queue** | Directory picker **once** before queue starts |
| **Compressor — Save All** | Directory picker **once**, all compressed files saved there |

**Fallback:** On browsers without File System Access API (Safari, Firefox), all downloads fall back to standard browser downloads.

---

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Split / Reassemble | Yes | Yes | Yes | Yes |
| AES-256 Encryption | Yes | Yes | Yes | Yes |
| SHA-256 Hashing | Yes | Yes | Yes | Yes |
| Native Save Dialog | Yes | Yes | No | No |
| Native Folder Picker | Yes | Yes | No | No |

**Recommendation:** Use Chrome or Edge for the best experience (native OS save dialogs). Firefox and Safari work fully but use browser downloads instead.

---

## Troubleshooting

### "Decryption failed" error during reassembly

- The password is wrong or the files were not encrypted with FileShard
- There is no password recovery — double-check your password

### Checksum mismatch after reassembly

- One or more parts may be corrupted or modified
- Re-download the parts from the original source
- If using a manifest, re-download the `.fshard.json` file too

### Browser runs out of memory during split

- This is extremely rare due to memory-safe streaming
- If it happens, try splitting with a larger volume size
- Close other browser tabs to free memory

### "Download All" saves to wrong folder

- The directory handle is cached per session
- Load a new file or start a new operation to reset the cached directory
- Individual part downloads always prompt for a new save location

### Parts are out of order during reassembly

- FileShard auto-detects part ordering from filenames
- Ensure all parts have consistent naming (e.g., all `.part1.rar`, `.part2.rar`)
- Don't mix naming formats (e.g., `.part1.rar` and `.001`)

### Large file (5 GB+) takes a long time to hash

- SHA-256 hashing of large files is CPU-intensive
- This is normal — hashing a 5 GB file takes approximately 10–30 seconds
- The hash is computed using memory-safe 8 MB streaming chunks

### Safari / Firefox can't save to a specific folder

- File System Access API is only supported in Chromium browsers (Chrome, Edge, Opera)
- FileShard automatically falls back to browser downloads on unsupported browsers
- All functionality works — only the save dialog style differs

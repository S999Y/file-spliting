/**
 * Cryptographic and formatting utilities for FileShard
 * Includes memory-safe chunked streaming SHA-256 for multi-gigabyte files.
 */

// Pure-JS streaming SHA-256 for large files without loading entire files into RAM
class StreamingSHA256 {
  private h0 = 0x6a09e667;
  private h1 = 0xbb67ae85;
  private h2 = 0x3c6ef372;
  private h3 = 0xa54ff53a;
  private h4 = 0x510e527f;
  private h5 = 0x9b05688c;
  private h6 = 0x1f83d9ab;
  private h7 = 0x5be0cd19;

  private buffer = new Uint8Array(64);
  private bufferLength = 0;
  private totalBytes = 0;

  private static K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  private w = new Uint32Array(64);

  public update(chunk: Uint8Array): void {
    let offset = 0;
    const len = chunk.length;
    this.totalBytes += len;

    if (this.bufferLength > 0) {
      const needed = 64 - this.bufferLength;
      if (len >= needed) {
        this.buffer.set(chunk.subarray(0, needed), this.bufferLength);
        this.processBlock(this.buffer, 0);
        offset += needed;
        this.bufferLength = 0;
      } else {
        this.buffer.set(chunk, this.bufferLength);
        this.bufferLength += len;
        return;
      }
    }

    while (offset + 64 <= len) {
      this.processBlock(chunk, offset);
      offset += 64;
    }

    const remaining = len - offset;
    if (remaining > 0) {
      this.buffer.set(chunk.subarray(offset, offset + remaining), 0);
      this.bufferLength = remaining;
    }
  }

  private processBlock(data: Uint8Array, offset: number): void {
    const w = this.w;
    for (let i = 0; i < 16; i++) {
      const idx = offset + (i << 2);
      w[i] = (data[idx] << 24) | (data[idx + 1] << 16) | (data[idx + 2] << 8) | data[idx + 3];
    }

    for (let i = 16; i < 64; i++) {
      const s0 = (w[i - 15] >>> 7 | w[i - 15] << 25) ^ (w[i - 15] >>> 18 | w[i - 15] << 14) ^ (w[i - 15] >>> 3);
      const s1 = (w[i - 2] >>> 17 | w[i - 2] << 15) ^ (w[i - 2] >>> 19 | w[i - 2] << 13) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = this.h0, b = this.h1, c = this.h2, d = this.h3;
    let e = this.h4, f = this.h5, g = this.h6, h = this.h7;

    for (let i = 0; i < 64; i++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + StreamingSHA256.K[i] + w[i]) | 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.h0 = (this.h0 + a) | 0;
    this.h1 = (this.h1 + b) | 0;
    this.h2 = (this.h2 + c) | 0;
    this.h3 = (this.h3 + d) | 0;
    this.h4 = (this.h4 + e) | 0;
    this.h5 = (this.h5 + f) | 0;
    this.h6 = (this.h6 + g) | 0;
    this.h7 = (this.h7 + h) | 0;
  }

  public digest(): string {
    const totalBits = this.totalBytes * 8;
    this.buffer[this.bufferLength] = 0x80;
    this.bufferLength++;

    if (this.bufferLength > 56) {
      for (let i = this.bufferLength; i < 64; i++) this.buffer[i] = 0;
      this.processBlock(this.buffer, 0);
      this.bufferLength = 0;
    }

    for (let i = this.bufferLength; i < 56; i++) {
      this.buffer[i] = 0;
    }

    // Append 64-bit length in bits (big-endian)
    const highBits = Math.floor(this.totalBytes / 0x20000000);
    this.buffer[56] = (highBits >>> 24) & 0xff;
    this.buffer[57] = (highBits >>> 16) & 0xff;
    this.buffer[58] = (highBits >>> 8) & 0xff;
    this.buffer[59] = highBits & 0xff;
    this.buffer[60] = (totalBits >>> 24) & 0xff;
    this.buffer[61] = (totalBits >>> 16) & 0xff;
    this.buffer[62] = (totalBits >>> 8) & 0xff;
    this.buffer[63] = totalBits & 0xff;

    this.processBlock(this.buffer, 0);

    const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
    return (
      toHex(this.h0) +
      toHex(this.h1) +
      toHex(this.h2) +
      toHex(this.h3) +
      toHex(this.h4) +
      toHex(this.h5) +
      toHex(this.h6) +
      toHex(this.h7)
    );
  }
}

export async function calculateSHA256(
  blob: Blob | ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<string> {
  // If small ArrayBuffer or small Blob (<= 32MB), native crypto.subtle is extremely fast
  if (blob instanceof ArrayBuffer) {
    if (blob.byteLength <= 32 * 1024 * 1024 && typeof crypto?.subtle?.digest === 'function') {
      const hashBuffer = await crypto.subtle.digest('SHA-256', blob);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const hasher = new StreamingSHA256();
    hasher.update(new Uint8Array(blob));
    if (onProgress) onProgress(100);
    return hasher.digest();
  }

  // If small blob (<= 32MB), use native crypto.subtle
  if (blob.size <= 32 * 1024 * 1024 && typeof crypto?.subtle?.digest === 'function') {
    try {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      if (onProgress) onProgress(100);
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback to streaming reader if arrayBuffer direct allocation fails
    }
  }

  // Memory-safe chunked streaming reader (handles 2GB, 5GB, 10GB+ without crashing RAM)
  const chunkSize = 8 * 1024 * 1024; // 8 MB slice buffer
  const totalBytes = blob.size;
  const hasher = new StreamingSHA256();
  let offset = 0;

  while (offset < totalBytes) {
    const end = Math.min(offset + chunkSize, totalBytes);
    const slice = blob.slice(offset, end);
    const chunkBuffer = await slice.arrayBuffer();
    hasher.update(new Uint8Array(chunkBuffer));
    offset = end;
    if (onProgress) {
      onProgress(Math.min(100, Math.round((offset / totalBytes) * 100)));
    }
  }

  return hasher.digest();
}

/**
 * Parses WinRAR style size string: "500M", "1G", "100M", "25MB", "4.7G", "700M"
 */
export function parseSizeString(input: string): number | null {
  if (!input) return null;
  const cleaned = input.trim().toUpperCase();
  const match = cleaned.match(/^([\d.]+)\s*([KMGTP]?B?)$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return null;

  const unit = match[2];
  if (unit.startsWith('G')) return Math.round(num * 1024 * 1024 * 1024);
  if (unit.startsWith('M')) return Math.round(num * 1024 * 1024);
  if (unit.startsWith('K')) return Math.round(num * 1024);
  if (unit.startsWith('T')) return Math.round(num * 1024 * 1024 * 1024 * 1024);
  // Default to MB if just number like "500"
  if (!unit || unit === 'B') return Math.round(num * 1024 * 1024);

  return Math.round(num * 1024 * 1024);
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function generateUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'fshard-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

/**
 * AES-256-GCM encryption using Web Crypto API.
 * Returns the encrypted blob with IV prepended (first 12 bytes).
 */
export async function encryptBlob(
  blob: Blob,
  password: string
): Promise<Blob> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Derive a 256-bit key from password using PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Use a fixed salt for deterministic behavior (in production, use random + store in manifest)
  const salt = encoder.encode('fileshard-v1-salt!');
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await blob.arrayBuffer();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Prepend IV to encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);

  return new Blob([result], { type: 'application/octet-stream' });
}

/**
 * AES-256-GCM decryption using Web Crypto API.
 * Expects IV to be prepended (first 12 bytes).
 */
export async function decryptBlob(
  encryptedBlob: Blob,
  password: string
): Promise<Blob> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = encoder.encode('fileshard-v1-salt!');
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const data = await encryptedBlob.arrayBuffer();
  const iv = data.slice(0, 12);
  const encryptedData = data.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    encryptedData
  );

  return new Blob([decrypted]);
}


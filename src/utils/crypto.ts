/**
 * Cryptographic and formatting utilities for FileShard
 */

export async function calculateSHA256(
  blob: Blob | ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (blob instanceof ArrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', blob);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Chunked calculation for large blobs to avoid memory exhaustion
  const chunkSize = 10 * 1024 * 1024; // 10MB chunk for crypto stream
  if (blob.size <= chunkSize) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // For very large files, read through FileReader in slices or use streaming
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  if (onProgress) onProgress(100);
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Probes a Blob/File by reading its head and tail bytes so stale or
 * inaccessible file handles fail immediately with an actionable message,
 * instead of failing midway through a long operation.
 */
export async function assertReadable(blob: Blob): Promise<void> {
  try {
    await blob.slice(0, Math.min(1024, blob.size)).arrayBuffer();
    if (blob.size > 1024) {
      await blob.slice(blob.size - 1024).arrayBuffer();
    }
  } catch (err) {
    throw new Error(describeFileReadError(err, blob instanceof File ? blob.name : 'the file'));
  }
}

export function describeFileReadError(err: unknown, fileName: string = 'the file'): string {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotReadableError':
      return `"${fileName}" could not be read. The file may have been moved, renamed, or replaced after selection, is locked by another program, or lives on a network/virtual/synced drive the browser cannot access. Re-select the file and try again.`;
    case 'SecurityError':
      return `Access to "${fileName}" was blocked by the browser for security reasons.`;
    case 'NotFoundError':
      return `"${fileName}" no longer exists at its original location.`;
    case 'AbortError':
      return `Reading "${fileName}" was interrupted. Please try again.`;
    default:
      return err instanceof Error && err.message ? err.message : `Failed to read "${fileName}".`;
  }
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

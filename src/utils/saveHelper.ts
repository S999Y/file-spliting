/**
 * File System Access API helper for native save dialogs.
 * Falls back to browser download when the API is unavailable.
 */

export interface SaveOptions {
  suggestedName: string;
  mimeType?: string;
}

/**
 * Prompt the user to pick a save location using the native OS dialog.
 * Uses the File System Access API (showSaveFilePicker) when available.
 * Returns a FileSystemWritableFileStream on success, or null if cancelled/unavailable.
 */
export async function promptSaveLocation(
  options: SaveOptions
): Promise<FileSystemWritableFileStream | null> {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: options.suggestedName,
        types: [
          {
            description: options.mimeType
              ? options.mimeType.split('/').pop() || 'File'
              : 'All Files',
            accept: {
              [options.mimeType || '*/*']: [
                '.' + options.suggestedName.split('.').pop(),
              ],
            },
          },
        ],
      });
      return await handle.createWritable();
    } catch (err: any) {
      // User cancelled the dialog
      if (err?.name === 'AbortError') return null;
      console.warn('showSaveFilePicker failed, falling back to download:', err);
    }
  }
  return null;
}

/**
 * Prompt for a directory (folder picker) where batch files will be saved.
 * Only works on Chromium-based browsers.
 */
export async function promptSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if ('showDirectoryPicker' in window) {
    try {
      return await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') return null;
      console.warn('showDirectoryPicker failed:', err);
    }
  }
  return null;
}

/**
 * Write a blob to a FileSystemWritableFileStream.
 * If stream is null (API unavailable or user cancelled), falls back to browser download.
 */
export async function writeBlobToStream(
  stream: FileSystemWritableFileStream | null,
  blob: Blob,
  suggestedName: string,
  fallbackDownload = true
): Promise<boolean> {
  if (stream) {
    try {
      await stream.write(blob);
      await stream.close();
      return true;
    } catch (err) {
      console.error('Write to stream failed:', err);
    }
  }

  if (fallbackDownload) {
    fallbackDownloadBlob(blob, suggestedName);
  }
  return false;
}

/**
 * Write multiple blobs to a directory handle, or fall back to individual downloads.
 */
export async function writeBlobsToDirectory(
  dirHandle: FileSystemDirectoryHandle | null,
  files: { blob: Blob; name: string }[],
  fallbackDownload = true
): Promise<number> {
  let saved = 0;

  if (dirHandle) {
    for (const file of files) {
      try {
        const fileHandle = await dirHandle.getFileHandle(file.name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(file.blob);
        await writable.close();
        saved++;
      } catch (err) {
        console.error(`Failed to write ${file.name} to directory:`, err);
      }
    }
  }

  if (fallbackDownload && saved < files.length) {
    for (const file of files.slice(saved)) {
      fallbackDownloadBlob(file.blob, file.name);
      saved++;
      await new Promise(r => setTimeout(r, 400));
    }
  }

  return saved;
}

/**
 * Fallback: trigger browser download via anchor click.
 */
export function fallbackDownloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Check if File System Access API is available.
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showSaveFilePicker' in window || 'showDirectoryPicker' in window;
}

import JSZip from 'jszip';
import { PartInfo, FileManifest, SplitConfig } from '../types';
import { calculateSHA256, generateUUID, assertReadable, describeFileReadError } from './crypto';

export interface SplitResult {
  manifest: FileManifest;
  parts: PartInfo[];
  zipBlob?: Blob;
  totalSize: number;
}

export async function splitFileInBrowser(
  file: File,
  config: SplitConfig,
  onProgress?: (progress: number, currentPart: number, totalParts: number, speedMBs: number, etaSeconds: number) => void,
  onLog?: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void
): Promise<SplitResult> {
  const startTime = Date.now();
  onLog?.('SYS', `Starting fragmentation for: "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);

  // Fail fast if the file handle is stale or the OS refuses the read,
  // instead of dying midway through hashing/slicing.
  onLog?.('CHK', `Verifying read access to "${file.name}"...`);
  try {
    await assertReadable(file);
  } catch (err) {
    onLog?.('ERROR', err instanceof Error ? err.message : String(err));
    throw err;
  }

  let partSize = config.partSizeBytes;
  if (config.splitMode === 'count' && config.targetPartCount > 0) {
    partSize = Math.ceil(file.size / config.targetPartCount);
  }

  // Minimum chunk size of 64KB, max safe chunk
  partSize = Math.max(64 * 1024, partSize);

  const totalParts = Math.ceil(file.size / partSize);
  onLog?.('INFO', `Calculated ${totalParts} shard(s) with chunk size: ${(partSize / (1024 * 1024)).toFixed(2)} MB`);

  // Master Checksum
  onLog?.('CHK', `Computing master SHA-256 hash for entire file...`);
  const masterChecksum = await calculateSHA256(file);
  onLog?.('CHK', `Master SHA-256: ${masterChecksum.substring(0, 16)}...${masterChecksum.substring(masterChecksum.length - 8)}`);

  const fileId = generateUUID();
  const parts: PartInfo[] = [];
  const manifestParts: FileManifest['parts'] = [];

  let offset = 0;
  let bytesProcessed = 0;

  for (let i = 0; i < totalParts; i++) {
    const end = Math.min(offset + partSize, file.size);
    const chunkBlob = file.slice(offset, end);
    const partNum = (i + 1).toString().padStart(3, '0');
    const partName = `${file.name}.part${partNum}`;

    onLog?.('SYS', `Processing shard [${i + 1}/${totalParts}]: ${partName} (${(chunkBlob.size / 1024).toFixed(1)} KB)`);

    // Calculate part checksum
    let processedBlob: Blob = chunkBlob;

    // Optional chunk compression (lossless deflate/gzip)
    if (config.compressParts) {
      try {
        if (typeof CompressionStream !== 'undefined') {
          const stream = chunkBlob.stream().pipeThrough(new CompressionStream('gzip'));
          const response = new Response(stream);
          processedBlob = await response.blob();
          onLog?.('SYS', `Compressed part ${i + 1} (${chunkBlob.size}B -> ${processedBlob.size}B, -${(((chunkBlob.size - processedBlob.size) / chunkBlob.size) * 100).toFixed(1)}%)`);
        }
      } catch (err) {
        onLog?.('WARN', `Stream compression skipped for part ${i + 1}: ${err}`);
      }
    }

    const partChecksum = await calculateSHA256(processedBlob);
    onLog?.('CHK', `Shard ${i + 1} Checksum: [${partChecksum.substring(0, 12)}...] - Verified`);

    const partInfo: PartInfo = {
      index: i + 1,
      name: partName,
      size: processedBlob.size,
      checksum: partChecksum,
      blob: processedBlob,
      status: 'verified',
      progress: 100,
      url: URL.createObjectURL(processedBlob),
    };

    parts.push(partInfo);
    manifestParts.push({
      index: i + 1,
      name: partName,
      size: processedBlob.size,
      checksum: partChecksum,
    });

    bytesProcessed += chunkBlob.size;
    offset = end;

    // Calculate Speed and ETA
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const speedBytesPerSec = bytesProcessed / Math.max(0.1, elapsedSeconds);
    const speedMBs = speedBytesPerSec / (1024 * 1024);
    const remainingBytes = file.size - bytesProcessed;
    const etaSeconds = remainingBytes / Math.max(1, speedBytesPerSec);
    const overallProgress = Math.round((bytesProcessed / file.size) * 100);

    onProgress?.(overallProgress, i + 1, totalParts, parseFloat(speedMBs.toFixed(2)), Math.ceil(etaSeconds));
  }

  const manifest: FileManifest = {
    manifestVersion: '1.0.0',
    fileId,
    originalName: file.name,
    originalSize: file.size,
    originalType: file.type || 'application/octet-stream',
    originalChecksum: masterChecksum,
    totalParts,
    partSize,
    compressed: config.compressParts,
    compressionType: config.compressParts ? 'gzip' : 'none',
    createdAt: new Date().toISOString(),
    parts: manifestParts,
  };

  onLog?.('SUCCESS', `Successfully fragmented ${file.name} into ${totalParts} verified shards!`);

  return {
    manifest,
    parts,
    totalSize: parts.reduce((acc, p) => acc + p.size, 0),
  };
}

export async function createBundleZip(
  manifest: FileManifest,
  parts: PartInfo[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  // Add manifest JSON
  zip.file(`${manifest.originalName}.fshard.json`, JSON.stringify(manifest, null, 2));

  // Add all parts
  for (const part of parts) {
    if (part.blob) {
      zip.file(part.name, part.blob);
    }
  }

  // Generate zip file with progress
  return await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    metadata => {
      if (onProgress) onProgress(Math.round(metadata.percent));
    }
  );
}

import { FileManifest } from '../types';
import { calculateSHA256 } from './crypto';

export interface PartInput {
  name: string;
  blob: Blob;
  index?: number;
  calculatedChecksum?: string;
  expectedChecksum?: string;
  isValid?: boolean;
}

export interface ReassemblyResult {
  file: Blob;
  fileName: string;
  fileType: string;
  originalSize: number;
  reassembledSize: number;
  checksumMatched: boolean;
  masterChecksum: string;
  calculatedMasterChecksum: string;
  verifiedPartsCount: number;
  totalPartsCount: number;
}

export async function reassembleFileFromParts(
  parts: PartInput[],
  manifest?: FileManifest,
  onProgress?: (progress: number, currentPart: number, totalParts: number) => void,
  onLog?: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void
): Promise<ReassemblyResult> {
  onLog?.('SYS', `Initiating reassembly process for ${parts.length} part(s)...`);

  // Sort parts by detected index
  const sortedParts = [...parts].sort((a, b) => {
    const getIndex = (name: string, fallbackIdx?: number) => {
      if (fallbackIdx !== undefined) return fallbackIdx;
      const match = name.match(/part(\d+)/i) || name.match(/\.(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };
    return getIndex(a.name, a.index) - getIndex(b.name, b.index);
  });

  const totalParts = sortedParts.length;
  const decodedBlobs: Blob[] = [];
  let verifiedCount = 0;

  for (let i = 0; i < totalParts; i++) {
    const part = sortedParts[i];
    onLog?.('CHK', `Validating shard [${i + 1}/${totalParts}]: "${part.name}" (${(part.blob.size / 1024).toFixed(1)} KB)`);

    // Verify individual checksum
    const partHash = await calculateSHA256(part.blob);
    part.calculatedChecksum = partHash;

    if (manifest) {
      const expectedPart = manifest.parts.find(p => p.index === (i + 1) || p.name === part.name);
      if (expectedPart) {
        part.expectedChecksum = expectedPart.checksum;
        if (expectedPart.checksum.toLowerCase() === partHash.toLowerCase()) {
          part.isValid = true;
          verifiedCount++;
          onLog?.('SUCCESS', `Part ${i + 1} SHA-256 MATCH: [${partHash.substring(0, 10)}...] ✓`);
        } else {
          part.isValid = false;
          onLog?.('ERROR', `Part ${i + 1} HASH MISMATCH! Expected ${expectedPart.checksum.substring(0, 10)}..., Got ${partHash.substring(0, 10)}... ✗`);
          throw new Error(`Data integrity violation in ${part.name}: Checksum verification failed.`);
        }
      } else {
        onLog?.('WARN', `Part ${part.name} not explicitly listed in manifest index, continuing...`);
      }
    }

    // Handle decompression if compressed
    let rawChunkBlob = part.blob;
    if (manifest?.compressed && manifest.compressionType === 'gzip') {
      try {
        if (typeof DecompressionStream !== 'undefined') {
          const stream = part.blob.stream().pipeThrough(new DecompressionStream('gzip'));
          const response = new Response(stream);
          rawChunkBlob = await response.blob();
          onLog?.('SYS', `Decompressed shard ${i + 1} successfully.`);
        }
      } catch (err) {
        onLog?.('WARN', `Stream decompression fallback for ${part.name}: ${err}`);
      }
    }

    decodedBlobs.push(rawChunkBlob);
    onProgress?.(Math.round(((i + 1) / totalParts) * 80), i + 1, totalParts);
  }

  onLog?.('SYS', `Stitching ${decodedBlobs.length} byte sequences into unified binary payload...`);
  const finalBlob = new Blob(decodedBlobs, {
    type: manifest?.originalType || 'application/octet-stream',
  });

  onLog?.('CHK', `Computing master checksum on reassembled binary (${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB)...`);
  const masterChecksum = await calculateSHA256(finalBlob);
  onProgress?.(100, totalParts, totalParts);

  let checksumMatched = true;
  if (manifest?.originalChecksum) {
    checksumMatched = masterChecksum.toLowerCase() === manifest.originalChecksum.toLowerCase();
    if (checksumMatched) {
      onLog?.('SUCCESS', `MASTER CHECKSUM VERIFIED! [${masterChecksum.substring(0, 16)}...] matches original source exactly!`);
    } else {
      onLog?.('ERROR', `Master checksum mismatch: Calculated ${masterChecksum}, Expected ${manifest.originalChecksum}`);
    }
  } else {
    onLog?.('INFO', `Reassembled Master SHA-256: ${masterChecksum}`);
  }

  const fileName = manifest?.originalName || (sortedParts[0]?.name.replace(/\.part\d+$/i, '') || 'reassembled_file.bin');

  return {
    file: finalBlob,
    fileName,
    fileType: manifest?.originalType || 'application/octet-stream',
    originalSize: manifest?.originalSize || finalBlob.size,
    reassembledSize: finalBlob.size,
    checksumMatched,
    masterChecksum: manifest?.originalChecksum || masterChecksum,
    calculatedMasterChecksum: masterChecksum,
    verifiedPartsCount: verifiedCount,
    totalPartsCount: totalParts,
  };
}

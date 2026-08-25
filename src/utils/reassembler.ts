import { FileManifest } from '../types';
import { calculateSHA256, decryptBlob } from './crypto';

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

export function parsePartIndex(name: string, fallbackIdx?: number): number {
  if (fallbackIdx !== undefined && fallbackIdx > 0) return fallbackIdx;
  
  // Matches: .part1.rar, .part01.rar, .part1, .part001, .part01.bin
  const winrarMatch = name.match(/\.part(\d+)(\.rar|\.bin)?$/i);
  if (winrarMatch) return parseInt(winrarMatch[1], 10);

  // Matches: Movie.mp4.001, Movie.002
  const numExtMatch = name.match(/\.(\d{3,4})$/);
  if (numExtMatch) return parseInt(numExtMatch[1], 10);

  // Matches: .r00, .r01 (old WinRAR convention)
  const rMatch = name.match(/\.r(\d{2})$/i);
  if (rMatch) return parseInt(rMatch[1], 10) + 1;

  // General part(\d+) anywhere
  const generalMatch = name.match(/part(\d+)/i);
  if (generalMatch) return parseInt(generalMatch[1], 10);

  return 0;
}

export function inferOriginalFileName(partNames: string[], manifestName?: string): string {
  if (manifestName) return manifestName;
  if (!partNames.length) return 'reassembled_file.bin';

  const first = partNames[0];

  // If WinRAR style: Movie.mp4.part1.rar -> Movie.mp4
  const withoutArchiveExt = first.replace(/\.(rar|zip|7z)$/i, '');
  const winrarMatch = withoutArchiveExt.match(/^(.*?)\.part\d+$/i);
  if (winrarMatch) return winrarMatch[1];

  // If Movie.mp4.part001 -> Movie.mp4
  const partMatch = first.match(/^(.*?)\.part\d+(\.bin)?$/i);
  if (partMatch) return partMatch[1];

  // If Movie.mp4.001 -> Movie.mp4
  const numMatch = first.match(/^(.*?)\.\d{3,4}$/);
  if (numMatch) return numMatch[1];

  return first.replace(/\.part\d+.*$/i, '') || 'reassembled_file.bin';
}

export async function reassembleFileFromParts(
  parts: PartInput[],
  manifest?: FileManifest,
  onProgress?: (progress: number, currentPart: number, totalParts: number) => void,
  onLog?: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void,
  password?: string
): Promise<ReassemblyResult> {
  onLog?.('SYS', `Initiating WinRAR-compatible volume reassembly process for ${parts.length} part(s)...`);

  // Sort parts by detected index
  const sortedParts = [...parts].sort((a, b) => {
    return parsePartIndex(a.name, a.index) - parsePartIndex(b.name, b.index);
  });

  const totalParts = sortedParts.length;
  const decodedBlobs: Blob[] = [];
  let verifiedCount = 0;

  for (let i = 0; i < totalParts; i++) {
    const part = sortedParts[i];
    const detectedIdx = parsePartIndex(part.name, part.index);
    onLog?.('CHK', `Validating volume [${i + 1}/${totalParts}] (Part #${detectedIdx || (i + 1)}): "${part.name}" (${(part.blob.size / (1024 * 1024)).toFixed(2)} MB)`);

    // Verify individual checksum (before decryption, checksum is of encrypted data)
    const partHash = await calculateSHA256(part.blob);
    part.calculatedChecksum = partHash;

    if (manifest) {
      const expectedPart = manifest.parts.find(p => p.index === (i + 1) || p.name === part.name);
      if (expectedPart) {
        part.expectedChecksum = expectedPart.checksum;
        if (expectedPart.checksum.toLowerCase() === partHash.toLowerCase()) {
          part.isValid = true;
          verifiedCount++;
          onLog?.('SUCCESS', `Volume ${i + 1} SHA-256 MATCH: [${partHash.substring(0, 10)}...] ✓`);
        } else {
          part.isValid = false;
          onLog?.('ERROR', `Volume ${i + 1} HASH MISMATCH! Expected ${expectedPart.checksum.substring(0, 10)}..., Got ${partHash.substring(0, 10)}... ✗`);
          throw new Error(`Data integrity violation in ${part.name}: Checksum verification failed.`);
        }
      } else {
        onLog?.('WARN', `Volume ${part.name} not explicitly listed in manifest index, continuing...`);
      }
    }

    let rawChunkBlob = part.blob;

    // Handle decryption if encrypted
    if (manifest?.encrypted && password) {
      try {
        onLog?.('SYS', `Decrypting volume ${i + 1} with AES-256-GCM...`);
        rawChunkBlob = await decryptBlob(rawChunkBlob, password);
        onLog?.('SYS', `Decrypted volume ${i + 1} successfully (${rawChunkBlob.size}B).`);
      } catch (err) {
        onLog?.('ERROR', `Decryption failed for volume ${i + 1}. Wrong password? ${err}`);
        throw new Error(`Decryption failed for ${part.name}. Please check your password.`);
      }
    } else if (manifest?.encrypted && !password) {
      onLog?.('WARN', `Volume ${i + 1} is encrypted but no password provided.`);
      throw new Error('This archive is password-protected. Please provide the decryption password.');
    }

    // Handle decompression if compressed
    if (manifest?.compressed && manifest.compressionType === 'gzip') {
      try {
        if (typeof DecompressionStream !== 'undefined') {
          const stream = rawChunkBlob.stream().pipeThrough(new DecompressionStream('gzip'));
          const response = new Response(stream);
          rawChunkBlob = await response.blob();
          onLog?.('SYS', `Decompressed volume ${i + 1} successfully.`);
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

  const fileName = inferOriginalFileName(sortedParts.map(p => p.name), manifest?.originalName);

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

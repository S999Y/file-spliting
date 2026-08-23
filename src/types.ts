export interface PartInfo {
  index: number;
  name: string;
  size: number;
  checksum: string;
  blob?: Blob;
  status: 'pending' | 'processing' | 'verified' | 'error' | 'uploaded';
  progress: number;
  url?: string;
}

export interface FileManifest {
  manifestVersion: string;
  fileId: string;
  originalName: string;
  originalSize: number;
  originalType: string;
  originalChecksum: string;
  totalParts: number;
  partSize: number;
  compressed: boolean;
  compressionType?: 'gzip' | 'zip' | 'deflate' | 'none';
  createdAt: string;
  parts: {
    index: number;
    name: string;
    size: number;
    checksum: string;
  }[];
}

export interface SplitConfig {
  partSizeBytes: number;
  splitMode: 'size' | 'count';
  targetPartCount: number;
  compressParts: boolean;
  compressionLevel: number;
  verifyChecksums: boolean;
  destination: 'local' | 'cloud' | 'both';
  cloudProvider: 's3' | 'r2' | 'vercel' | 'gcs' | 'vault';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  details?: string;
}

export interface BatchItem {
  id: string;
  file: File;
  operation: 'split' | 'compress' | 'verify';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'paused';
  progress: number;
  speed: string;
  result?: {
    partsCount?: number;
    originalSize: number;
    outputSize: number;
    savedPercentage?: number;
    manifest?: FileManifest;
    downloadUrl?: string;
  };
  error?: string;
}

export interface CloudBackupItem {
  id: string;
  originalName: string;
  fileId: string;
  totalParts: number;
  totalSize: number;
  provider: string;
  region: string;
  checksum: string;
  uploadedAt: string;
  parts: {
    index: number;
    name: string;
    size: number;
    checksum: string;
    cloudUrl: string;
  }[];
}

export interface SystemStats {
  totalProcessedBytes: number;
  totalSavedBytes: number;
  successfulOperations: number;
  failedOperations: number;
  activeEdgeNode: string;
  checksumVerifications: number;
}

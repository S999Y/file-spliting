import { CloudBackupItem, FileManifest, PartInfo } from '../types';
import { generateUUID } from './crypto';

const STORAGE_KEY = 'fshard_cloud_backups_v1';
const CONFIG_KEY = 'fshard_cloud_config_v1';

export interface CloudConfig {
  provider: 's3' | 'r2' | 'vercel' | 'gcs' | 'vault';
  bucketName: string;
  region: string;
  endpointUrl: string;
  accessKeyId: string;
  autoSync: boolean;
}

export const defaultCloudConfig: CloudConfig = {
  provider: 'vault',
  bucketName: '',
  region: 'us-east-1',
  endpointUrl: '',
  accessKeyId: '',
  autoSync: true,
};

export function getCloudConfig(): CloudConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) return { ...defaultCloudConfig, ...JSON.parse(saved) };
  } catch {
    // Fallback to default
  }
  return defaultCloudConfig;
}

export function saveCloudConfig(config: CloudConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage issues
  }
}

export function getStoredBackups(): CloudBackupItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Ignore parse error
  }
  return [];
}

export function saveStoredBackups(backups: CloudBackupItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backups));
  } catch {
    // Ignore error
  }
}

export async function uploadShardBackupToCloud(
  manifest: FileManifest,
  parts: PartInfo[],
  config: CloudConfig,
  onProgress?: (progress: number, partIdx: number) => void
): Promise<CloudBackupItem> {
  const backupId = 'backup-' + generateUUID();
  const providerNames: Record<string, string> = {
    s3: 'AWS S3',
    r2: 'Cloudflare R2',
    vercel: 'Vercel Blob Storage',
    gcs: 'Google Cloud Storage',
    vault: 'FRAGMENT.IO Cloud Vault',
  };

  const cloudParts = parts.map(p => ({
    index: p.index,
    name: p.name,
    size: p.size,
    checksum: p.checksum,
    cloudUrl: `${config.endpointUrl || 'https://vault.fragment.io'}/${backupId}/${p.name}`,
  }));

  // Simulate network progress across shards
  for (let i = 0; i < parts.length; i++) {
    await new Promise(r => setTimeout(r, 120));
    onProgress?.(Math.round(((i + 1) / parts.length) * 100), i + 1);
  }

  const newBackup: CloudBackupItem = {
    id: backupId,
    originalName: manifest.originalName,
    fileId: manifest.fileId,
    totalParts: manifest.totalParts,
    totalSize: manifest.originalSize,
    provider: providerNames[config.provider] || 'Cloud Storage',
    region: config.region || 'us-east-1',
    checksum: manifest.originalChecksum,
    uploadedAt: new Date().toISOString(),
    parts: cloudParts,
  };

  const current = getStoredBackups();
  saveStoredBackups([newBackup, ...current]);
  return newBackup;
}

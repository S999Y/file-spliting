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
  bucketName: 'fragment-io-edge-vault',
  region: 'us-east-1 (Northern-VA)',
  endpointUrl: 'https://vault.fragment.io/api/v1/shards',
  accessKeyId: 'fshard_live_edge_key',
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

  // Pre-seeded example cloud backup for instant rich demonstration
  const seed: CloudBackupItem[] = [
    {
      id: 'backup-enterprise-9921',
      originalName: 'enterprise_video_bundle_v14.raw',
      fileId: 'fshard-ent-9102-v14',
      totalParts: 4,
      totalSize: 4294967296, // 4GB
      provider: 'AWS S3 (Standard IA)',
      region: 'us-east-1 (N. Virginia)',
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      parts: [
        {
          index: 1,
          name: 'enterprise_video_bundle_v14.raw.part001',
          size: 1073741824,
          checksum: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
          cloudUrl: 'https://s3.us-east-1.amazonaws.com/fragment-vault/part001.bin',
        },
        {
          index: 2,
          name: 'enterprise_video_bundle_v14.raw.part002',
          size: 1073741824,
          checksum: '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090',
          cloudUrl: 'https://s3.us-east-1.amazonaws.com/fragment-vault/part002.bin',
        },
        {
          index: 3,
          name: 'enterprise_video_bundle_v14.raw.part003',
          size: 1073741824,
          checksum: '51965e630fd86392095f9c4701e67ee83a54b38740c06a01dd1472be964893be',
          cloudUrl: 'https://s3.us-east-1.amazonaws.com/fragment-vault/part003.bin',
        },
        {
          index: 4,
          name: 'enterprise_video_bundle_v14.raw.part004',
          size: 1073741824,
          checksum: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
          cloudUrl: 'https://s3.us-east-1.amazonaws.com/fragment-vault/part004.bin',
        },
      ],
    },
  ];
  return seed;
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

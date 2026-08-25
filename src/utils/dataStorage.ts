/**
 * Persistent data storage using localStorage.
 * Each browser/device gets a unique ID so different users on the same
 * deployment see their own separate activity.
 */

import { SystemStats, AuditLog } from '../types';

// --- Device ID (per-browser/per-device identity) ---

const DEVICE_ID_KEY = 'fileshard_device_id';
const DEVICE_LABEL_KEY = 'fileshard_device_label';

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';

  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceLabel(): string {
  let label = localStorage.getItem(DEVICE_LABEL_KEY);
  if (!label) {
    label = detectDeviceLabel();
    localStorage.setItem(DEVICE_LABEL_KEY, label);
  }
  return label;
}

function pk(key: string): string {
  return `${getDeviceId()}_${key}`;
}

// --- Keys ---

const KEYS = {
  stats: 'stats',
  logs: 'logs',
  history: 'history',
  cloudBackups: 'cloud_backups',
  cloudConfig: 'cloud_config',
} as const;

// --- Stats ---

const defaultStats: SystemStats = {
  totalProcessedBytes: 0,
  totalSavedBytes: 0,
  successfulOperations: 0,
  failedOperations: 0,
  checksumVerifications: 0,
};

export function loadStats(): SystemStats {
  try {
    const raw = localStorage.getItem(pk(KEYS.stats));
    if (raw) return { ...defaultStats, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultStats;
}

export function saveStats(stats: SystemStats): void {
  try {
    localStorage.setItem(pk(KEYS.stats), JSON.stringify(stats));
  } catch { /* ignore */ }
}

// --- Audit Logs ---

export function loadLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(pk(KEYS.logs));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveLogs(logs: AuditLog[]): void {
  try {
    localStorage.setItem(pk(KEYS.logs), JSON.stringify(logs.slice(-150)));
  } catch { /* ignore */ }
}

export function clearLogs(): void {
  try {
    localStorage.removeItem(pk(KEYS.logs));
  } catch { /* ignore */ }
}

// --- Operation History ---

export interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'split' | 'reassemble' | 'compress' | 'batch';
  fileName: string;
  originalSize: number;
  outputSize?: number;
  partsCount?: number;
  success: boolean;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(pk(KEYS.history));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  try {
    const history = loadHistory();
    history.unshift(entry);
    localStorage.setItem(pk(KEYS.history), JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore */ }
}

export function deleteHistoryEntry(id: string): void {
  try {
    const history = loadHistory().filter(e => e.id !== id);
    localStorage.setItem(pk(KEYS.history), JSON.stringify(history));
  } catch { /* ignore */ }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(pk(KEYS.history));
  } catch { /* ignore */ }
}

// --- Cloud Storage (device-scoped) ---

export function loadCloudBackups<T>(): T[] {
  try {
    const raw = localStorage.getItem(pk(KEYS.cloudBackups));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveCloudBackups<T>(data: T[]): void {
  try {
    localStorage.setItem(pk(KEYS.cloudBackups), JSON.stringify(data));
  } catch { /* ignore */ }
}

export function loadCloudConfig<T extends object>(): T | null {
  try {
    const raw = localStorage.getItem(pk(KEYS.cloudConfig));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export function saveCloudConfig<T>(data: T): void {
  try {
    localStorage.setItem(pk(KEYS.cloudConfig), JSON.stringify(data));
  } catch { /* ignore */ }
}

// --- Clear all data for this device ---

export function clearAllDeviceData(): void {
  const deviceId = getDeviceId();
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(deviceId + '_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

// --- Export all data as JSON ---

export function exportAllData(): string {
  return JSON.stringify({
    deviceId: getDeviceId(),
    deviceLabel: getDeviceLabel(),
    stats: loadStats(),
    logs: loadLogs(),
    history: loadHistory(),
    exportedAt: new Date().toISOString(),
    version: '3.0.0',
  }, null, 2);
}

export function downloadDataJson(): void {
  const data = exportAllData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fileshard_${getDeviceLabel().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

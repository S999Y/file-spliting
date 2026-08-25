/**
 * Persistent data storage using localStorage.
 * When deployed on Vercel, data persists across page refreshes per browser.
 * On Vercel serverless, the filesystem is ephemeral — localStorage is the
 * only reliable client-side persistence layer without an external database.
 */

import { SystemStats, AuditLog, CloudBackupItem } from '../types';

const KEYS = {
  stats: 'fileshard_stats',
  logs: 'fileshard_logs',
  history: 'fileshard_history',
  cloudBackups: 'fshard_cloud_backups_v1',
  cloudConfig: 'fshard_cloud_config_v1',
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
    const raw = localStorage.getItem(KEYS.stats);
    if (raw) return { ...defaultStats, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultStats;
}

export function saveStats(stats: SystemStats): void {
  try {
    localStorage.setItem(KEYS.stats, JSON.stringify(stats));
  } catch { /* ignore */ }
}

// --- Audit Logs ---

export function loadLogs(): AuditLog[] {
  try {
    const raw = localStorage.getItem(KEYS.logs);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveLogs(logs: AuditLog[]): void {
  try {
    localStorage.setItem(KEYS.logs, JSON.stringify(logs.slice(-150)));
  } catch { /* ignore */ }
}

export function clearLogs(): void {
  try {
    localStorage.removeItem(KEYS.logs);
  } catch { /* ignore */ }
}

// --- Operation History (for dashboard recent activity) ---

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
    const raw = localStorage.getItem(KEYS.history);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  try {
    const history = loadHistory();
    history.unshift(entry);
    localStorage.setItem(KEYS.history, JSON.stringify(history.slice(0, 50)));
  } catch { /* ignore */ }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEYS.history);
  } catch { /* ignore */ }
}

// --- Export all data as JSON ---

export function exportAllData(): string {
  return JSON.stringify({
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
  a.download = `fileshard_data_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

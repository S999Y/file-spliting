import React, { useState, useEffect } from 'react';
import {
  Cloud,
  HardDrive,
  Download,
  Trash2,
  CheckCircle,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Settings,
  Server,
  Database
} from 'lucide-react';
import { CloudBackupItem } from '../types';
import { formatBytes } from '../utils/crypto';
import {
  getStoredBackups,
  saveStoredBackups,
  getCloudConfig,
  saveCloudConfig,
  CloudConfig
} from '../utils/cloudStorage';
import { soundManager } from '../utils/sound';

interface CloudStorageViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onNavigateToReassemble: (backupId?: string) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const CloudStorageView: React.FC<CloudStorageViewProps> = ({
  onLog,
  onNavigateToReassemble,
  onSendNotification,
}) => {
  const [backups, setBackups] = useState<CloudBackupItem[]>([]);
  const [config, setConfig] = useState<CloudConfig>(getCloudConfig());
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    setBackups(getStoredBackups());
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveCloudConfig(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    onLog('AUTH', `Updated Cloud Storage provider config (${config.provider.toUpperCase()} - ${config.region})`);
    soundManager.playSuccess();
  };

  const handleDeleteBackup = (id: string) => {
    const updated = backups.filter(b => b.id !== id);
    setBackups(updated);
    saveStoredBackups(updated);
    onLog('INFO', `Removed Cloud Vault archive backup: ${id}`);
  };

  const handleDownloadCloudShards = (backup: CloudBackupItem) => {
    onLog('SYS', `Initiating download of all ${backup.totalParts} shards for "${backup.originalName}"...`);
    soundManager.playSuccess();
    onSendNotification(
      'Cloud Shards Download',
      `Downloading all shard chunks for ${backup.originalName}.`
    );
  };

  const totalCloudStorageBytes = backups.reduce((acc, b) => acc + b.totalSize, 0);

  return (
    <div className="space-y-6">
      {/* Cloud Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Cloud Vault</span>
            <Cloud className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 font-mono">
            {formatBytes(totalCloudStorageBytes)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Across {backups.length} archived backups</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Connected Provider</span>
            <Server className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 capitalize font-mono">
            {config.provider.toUpperCase()} Edge
          </h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1">Status: Active & Synchronized</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Edge Redundancy</span>
            <Database className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 font-mono">Multi-Region</h3>
          <p className="text-xs text-slate-500 mt-1">{config.region}</p>
        </div>
      </div>

      {/* Cloud Storage Config Form */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <span>Cloud Storage Integration Provider</span>
          </h3>
          {isSaved && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 font-mono">
              <CheckCircle className="w-3.5 h-3.5" /> Settings Persisted
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConfig} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Storage Provider</label>
            <select
              value={config.provider}
              onChange={e => setConfig({ ...config, provider: e.target.value as CloudConfig['provider'] })}
              className="w-full rounded-lg border border-slate-300 p-2 font-medium bg-white text-slate-800"
            >
              <option value="vault">FRAGMENT.IO Cloud Vault (Built-in)</option>
              <option value="s3">Amazon AWS S3</option>
              <option value="r2">Cloudflare R2 Storage</option>
              <option value="vercel">Vercel Blob Storage</option>
              <option value="gcs">Google Cloud Storage</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Target Bucket / Vault Name</label>
            <input
              type="text"
              value={config.bucketName}
              onChange={e => setConfig({ ...config, bucketName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Cloud Region</label>
            <input
              type="text"
              value={config.region}
              onChange={e => setConfig({ ...config, region: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 font-mono"
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
            >
              Save Cloud Settings
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Cloud Backups Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Archived Shard Backups ({backups.length})
          </h3>
        </div>

        <div className="p-6 overflow-x-auto">
          {backups.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No cloud backups registered yet. Split a file with "Cloud Vault" destination to create backups.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="pb-3 px-2 font-bold">Archive Name</th>
                  <th className="pb-3 font-bold">Total Size</th>
                  <th className="pb-3 font-bold">Shards</th>
                  <th className="pb-3 font-bold">Provider / Region</th>
                  <th className="pb-3 font-bold">Checksum Hash</th>
                  <th className="pb-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-2 font-bold text-slate-800">
                      {b.originalName}
                    </td>
                    <td className="py-3 text-slate-600">{formatBytes(b.totalSize)}</td>
                    <td className="py-3 text-blue-600 font-bold">{b.totalParts} Parts</td>
                    <td className="py-3 text-slate-500">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px]">
                        {b.provider}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500">{b.checksum.substring(0, 14)}...</td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={() => onNavigateToReassemble(b.id)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-bold text-[11px] transition inline-flex items-center gap-1"
                        title="Import to Reassembler"
                      >
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handleDownloadCloudShards(b)}
                        className="p-1 text-slate-500 hover:text-slate-700 rounded transition"
                        title="Download Cloud Shards"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(b.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        title="Delete Backup"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

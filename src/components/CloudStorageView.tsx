import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Download,
  Trash2,
  CheckCircle,
  RefreshCw,
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
    onLog('AUTH', `Updated Cloud config (${config.provider.toUpperCase()} - ${config.region})`);
    soundManager.playSuccess();
  };

  const handleDeleteBackup = (id: string) => {
    const updated = backups.filter(b => b.id !== id);
    setBackups(updated);
    saveStoredBackups(updated);
    onLog('INFO', `Removed backup: ${id}`);
  };

  const handleDownloadCloudShards = (backup: CloudBackupItem) => {
    onLog('SYS', `Downloading ${backup.totalParts} shards for "${backup.originalName}"...`);
    soundManager.playSuccess();
    onSendNotification('Cloud Download', `Downloading shards for ${backup.originalName}.`);
  };

  const totalCloudStorageBytes = backups.reduce((acc, b) => acc + b.totalSize, 0);

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cloud Storage</span>
            <Cloud className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-lg md:text-xl font-bold text-slate-900 font-mono">
            {formatBytes(totalCloudStorageBytes)}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 mt-1">{backups.length} backup(s)</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Provider</span>
            <Server className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 capitalize font-mono">
            {config.provider.toUpperCase()}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 mt-1">{config.region}</p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bucket</span>
            <Database className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-slate-900 font-mono truncate">
            {config.bucketName || 'Not configured'}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 mt-1">Auto-sync {config.autoSync ? 'on' : 'off'}</p>
        </div>
      </div>

      {/* Config Form */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-600" />
            <span>Cloud Provider</span>
          </h3>
          {isSaved && (
            <span className="text-[10px] md:text-xs font-bold text-emerald-600 flex items-center gap-1 font-mono">
              <CheckCircle className="w-3 h-3 md:w-3.5 md:h-3.5" /> Saved
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4 text-[11px] md:text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Provider</label>
            <select
              value={config.provider}
              onChange={e => setConfig({ ...config, provider: e.target.value as CloudConfig['provider'] })}
              className="w-full rounded-lg border border-slate-300 p-2 font-medium bg-white text-slate-800"
            >
              <option value="vault">FRAGMENT.IO Cloud Vault</option>
              <option value="s3">Amazon S3</option>
              <option value="r2">Cloudflare R2</option>
              <option value="vercel">Vercel Blob</option>
              <option value="gcs">Google Cloud Storage</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Bucket Name</label>
            <input
              type="text"
              value={config.bucketName}
              onChange={e => setConfig({ ...config, bucketName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 font-mono"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Region</label>
            <input
              type="text"
              value={config.region}
              onChange={e => setConfig({ ...config, region: e.target.value })}
              className="w-full rounded-lg border border-slate-300 p-2 font-mono"
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-2 md:pt-0">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition text-[11px] md:text-xs"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>

      {/* Backups Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3 md:p-4 px-4 md:px-6 border-b border-slate-100 bg-slate-50/70">
          <h3 className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">
            Backups ({backups.length})
          </h3>
        </div>

        <div className="p-4 md:p-6 overflow-x-auto">
          {backups.length === 0 ? (
            <div className="text-center py-8 md:py-10 text-slate-400 text-[11px] md:text-xs">
              No cloud backups yet. Split with "Cloud Vault" destination to create backups.
            </div>
          ) : (
            <table className="w-full text-left text-[10px] md:text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] md:text-[10px]">
                  <th className="pb-2 md:pb-3 px-1 md:px-2 font-bold">Name</th>
                  <th className="pb-2 md:pb-3 font-bold">Size</th>
                  <th className="pb-2 md:pb-3 font-bold hidden sm:table-cell">Shards</th>
                  <th className="pb-2 md:pb-3 font-bold hidden md:table-cell">Provider</th>
                  <th className="pb-2 md:pb-3 font-bold hidden lg:table-cell">Checksum</th>
                  <th className="pb-2 md:pb-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition">
                    <td className="py-2 md:py-3 px-1 md:px-2 font-bold text-slate-800 max-w-[120px] md:max-w-none truncate">
                      {b.originalName}
                    </td>
                    <td className="py-2 md:py-3 text-slate-600">{formatBytes(b.totalSize)}</td>
                    <td className="py-2 md:py-3 text-blue-600 font-bold hidden sm:table-cell">{b.totalParts}</td>
                    <td className="py-2 md:py-3 text-slate-500 hidden md:table-cell">
                      <span className="bg-slate-100 text-slate-700 px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px]">
                        {b.provider}
                      </span>
                    </td>
                    <td className="py-2 md:py-3 text-slate-500 hidden lg:table-cell">{b.checksum.substring(0, 14)}...</td>
                    <td className="py-2 md:py-3 text-right space-x-1 md:space-x-2">
                      <button
                        onClick={() => onNavigateToReassemble(b.id)}
                        className="px-1.5 md:px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-bold text-[9px] md:text-[11px] transition"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDownloadCloudShards(b)}
                        className="p-1 text-slate-500 hover:text-slate-700 rounded transition"
                      >
                        <Download className="w-3 h-3 md:w-3.5 md:h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBackup(b.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                      >
                        <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
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

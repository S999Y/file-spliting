import React from 'react';
import {
  Scissors,
  Link as LinkIcon,
  Zap,
  Package,
  ShieldCheck,
  TrendingUp,
  HardDrive,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Download
} from 'lucide-react';
import { SystemStats } from '../types';
import { formatBytes } from '../utils/crypto';
import { loadHistory, HistoryEntry } from '../utils/dataStorage';

interface DashboardViewProps {
  stats: SystemStats;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigate,
}) => {
  const history = loadHistory();
  const recentHistory = history.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Processed</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">
            {formatBytes(stats.totalProcessedBytes)}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Lifetime throughput
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Bandwidth Saved</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">
            {formatBytes(stats.totalSavedBytes)}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Via compression and optimization
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operations</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">
            {stats.successfulOperations}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {stats.failedOperations > 0 ? `${stats.failedOperations} failed` : 'All successful'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Integrity Checks</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">
            {stats.checksumVerifications.toLocaleString()}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            SHA-256 verifications
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('split')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Scissors className="w-4 h-4" />
            <span>Split File</span>
          </button>
          <button
            onClick={() => onNavigate('reassemble')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
          >
            <LinkIcon className="w-4 h-4 text-slate-600" />
            <span>Reassemble</span>
          </button>
          <button
            onClick={() => onNavigate('compress')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
          >
            <Zap className="w-4 h-4 text-slate-600" />
            <span>Compress</span>
          </button>
          <button
            onClick={() => onNavigate('batch')}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
          >
            <Package className="w-4 h-4 text-slate-600" />
            <span>Batch Queue</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Activity</h3>
          <span className="text-[11px] font-mono text-slate-500">{history.length} total operations</span>
        </div>

        <div className="p-6">
          {recentHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No operations yet</p>
              <p className="text-xs text-slate-400 mt-1">Split, compress, or reassemble a file to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentHistory.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50/80 transition"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    entry.type === 'split' ? 'bg-blue-50 text-blue-600' :
                    entry.type === 'reassemble' ? 'bg-emerald-50 text-emerald-600' :
                    entry.type === 'compress' ? 'bg-amber-50 text-amber-600' :
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    {entry.type === 'split' && <Scissors className="w-4 h-4" />}
                    {entry.type === 'reassemble' && <LinkIcon className="w-4 h-4" />}
                    {entry.type === 'compress' && <Zap className="w-4 h-4" />}
                    {entry.type === 'batch' && <Package className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{entry.fileName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {entry.type.toUpperCase()} - {formatBytes(entry.originalSize)}
                      {entry.partsCount ? ` - ${entry.partsCount} parts` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {entry.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <span className="text-[10px] text-rose-600 font-bold">FAILED</span>
                    )}
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

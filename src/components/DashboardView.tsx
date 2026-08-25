import React, { useState } from 'react';
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
  Trash2
} from 'lucide-react';
import { SystemStats } from '../types';
import { formatBytes } from '../utils/crypto';
import { loadHistory, deleteHistoryEntry, clearHistory, getDeviceLabel } from '../utils/dataStorage';

interface DashboardViewProps {
  stats: SystemStats;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigate,
}) => {
  const [history, setHistory] = useState(() => loadHistory());
  const recentHistory = history.slice(0, 10);

  const handleDeleteEntry = (id: string) => {
    deleteHistoryEntry(id);
    setHistory(prev => prev.filter(e => e.id !== id));
  };

  const handleClearAll = () => {
    if (!confirm('Clear all recent activity? This cannot be undone.')) return;
    clearHistory();
    setHistory([]);
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Device Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
          <span className="text-[11px] font-mono text-slate-500">
            Session: <span className="font-bold text-slate-700">{getDeviceLabel()}</span>
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Processed</p>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
            {formatBytes(stats.totalProcessedBytes)}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 hidden sm:block flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Lifetime throughput
          </p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saved</p>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
            {formatBytes(stats.totalSavedBytes)}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 hidden sm:block">
            Via compression
          </p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operations</p>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
            {stats.successfulOperations}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 hidden sm:block">
            {stats.failedOperations > 0 ? `${stats.failedOperations} failed` : 'All successful'}
          </p>
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-wider">Checks</p>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-slate-900 font-mono">
            {stats.checksumVerifications.toLocaleString()}
          </h3>
          <p className="text-[10px] md:text-xs text-slate-500 font-medium mt-1 hidden sm:block">
            SHA-256 verifications
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6">
        <h3 className="text-xs md:text-sm font-bold text-slate-900 mb-3 md:mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <button
            onClick={() => onNavigate('split')}
            className="flex items-center justify-center gap-2 py-2.5 md:py-3 px-3 md:px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            <Scissors className="w-4 h-4" />
            <span>Split File</span>
          </button>
          <button
            onClick={() => onNavigate('reassemble')}
            className="flex items-center justify-center gap-2 py-2.5 md:py-3 px-3 md:px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
          >
            <LinkIcon className="w-4 h-4 text-slate-600" />
            <span>Reassemble</span>
          </button>
          <button
            onClick={() => onNavigate('compress')}
            className="flex items-center justify-center gap-2 py-2.5 md:py-3 px-3 md:px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
          >
            <Zap className="w-4 h-4 text-slate-600" />
            <span>Compress</span>
          </button>
          <button
            onClick={() => onNavigate('batch')}
            className="flex items-center justify-center gap-2 py-2.5 md:py-3 px-3 md:px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
          >
            <Package className="w-4 h-4 text-slate-600" />
            <span>Batch</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 px-4 md:px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Activity</h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] md:text-[11px] font-mono text-slate-500">{history.length}</span>
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[10px] md:text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition"
              >
                <Trash2 className="w-3 h-3" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4 md:p-6">
          {recentHistory.length === 0 ? (
            <div className="text-center py-6 md:py-8">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No operations yet</p>
              <p className="text-xs text-slate-400 mt-1">Split, compress, or reassemble a file to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentHistory.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 border border-slate-100 rounded-lg hover:bg-slate-50/80 transition group"
                >
                  <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    entry.type === 'split' ? 'bg-blue-50 text-blue-600' :
                    entry.type === 'reassemble' ? 'bg-emerald-50 text-emerald-600' :
                    entry.type === 'compress' ? 'bg-amber-50 text-amber-600' :
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    {entry.type === 'split' && <Scissors className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {entry.type === 'reassemble' && <LinkIcon className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {entry.type === 'compress' && <Zap className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                    {entry.type === 'batch' && <Package className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] md:text-xs font-bold text-slate-800 truncate">{entry.fileName}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-mono">
                      {entry.type.toUpperCase()} · {formatBytes(entry.originalSize)}
                      {entry.partsCount ? ` · ${entry.partsCount} parts` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      {entry.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
                      ) : (
                        <span className="text-[9px] md:text-[10px] text-rose-600 font-bold">FAIL</span>
                      )}
                      <p className="text-[9px] md:text-[10px] text-slate-400 font-mono mt-0.5 hidden sm:block">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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

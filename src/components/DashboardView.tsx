import React from 'react';
import {
  Scissors,
  Link as LinkIcon,
  Zap,
  Package,
  ShieldCheck,
  TrendingUp,
  HardDrive,
  Cpu,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { SystemStats, AuditLog } from '../types';
import { formatBytes } from '../utils/crypto';
import { LiveAuditLogs } from './LiveAuditLogs';

interface DashboardViewProps {
  stats: SystemStats;
  logs: AuditLog[];
  onClearLogs: () => void;
  onNavigate: (tab: string) => void;
  onQuickSplitDemo: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  logs,
  onClearLogs,
  onNavigate,
  onQuickSplitDemo,
}) => {
  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Processed</p>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">
            {formatBytes(stats.totalProcessedBytes || 1560000000000)}
          </h3>
          <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% throughput this week
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Compression Ratio</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">64.2%</h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {formatBytes(stats.totalSavedBytes || 480000000000)} bandwidth saved
          </p>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Task Completion</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono">99.9%</h3>
          <p className="text-xs text-blue-600 font-semibold mt-1">
            {stats.successfulOperations} verified tasks
          </p>
        </div>

        {/* Card 4 */}
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
          <p className="text-xs text-emerald-600 font-semibold mt-1">
            100% SHA-256 Bitwise Validated
          </p>
        </div>
      </div>

      {/* Main Grid: Active Asset Fragmentation + Live Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Asset Fragmentation (8 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
              <h4 className="font-bold text-sm text-slate-900">Active Asset Fragmentation</h4>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('split')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                <span>Launch Custom Split</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Active Task Hero Progress */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/80">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-mono">
                    enterprise_video_bundle_v14.raw
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Splitting: <span className="font-semibold text-slate-700">4.00 GB total</span> • Target: <span className="font-semibold text-slate-700">1.00 GB shards</span> • Algorithm: <span className="font-semibold text-blue-700">SHA-256 Lossless</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-blue-600 font-mono">75%</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: '75%' }}
                ></div>
              </div>

              <div className="flex flex-wrap justify-between items-center text-[11px] font-mono text-slate-500 gap-2">
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200">
                  MASTER HASH: <span className="text-slate-800 font-bold">SHA-256 [0x4F8B...9E2A]</span>
                </span>
                <span className="text-blue-600 font-semibold">
                  SPEED: 142.8 MB/s • REMAINING: 6s
                </span>
              </div>
            </div>

            {/* Shard Parts List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                <span>Fragment Shards (4 Parts)</span>
                <span>Checksum Integrity</span>
              </div>

              {[
                { part: '01', name: 'enterprise_video_bundle_v14.raw.part001', size: '1.00 GB', status: 'VERIFIED', hash: '8f43...aa4', color: 'emerald' },
                { part: '02', name: 'enterprise_video_bundle_v14.raw.part002', size: '1.00 GB', status: 'VERIFIED', hash: '6ca1...090', color: 'emerald' },
                { part: '03', name: 'enterprise_video_bundle_v14.raw.part003', size: '1.00 GB', status: 'PROCESSING', hash: 'Computing...', color: 'blue' },
                { part: '04', name: 'enterprise_video_bundle_v14.raw.part004', size: '1.00 GB', status: 'QUEUED', hash: 'Pending', color: 'slate' },
              ].map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3.5 p-3 border border-slate-200 rounded-lg bg-white hover:bg-slate-50/80 transition"
                >
                  <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-xs font-mono font-bold text-slate-700 border border-slate-200 shrink-0">
                    {p.part}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate font-mono">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {p.size} • Hash: {p.hash}
                    </p>
                  </div>
                  <div
                    className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 font-mono ${
                      p.color === 'emerald'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.color === 'blue'
                        ? 'bg-blue-100 text-blue-800 animate-pulse'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {p.status}
                  </div>
                </div>
              ))}
            </div>

            {/* Fast Action Buttons */}
            <div className="pt-2 grid grid-cols-3 gap-3">
              <button
                onClick={() => onNavigate('split')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Split New File</span>
              </button>
              <button
                onClick={() => onNavigate('reassemble')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
              >
                <LinkIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Merge & Verify</span>
              </button>
              <button
                onClick={() => onNavigate('batch')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition border border-slate-200"
              >
                <Package className="w-3.5 h-3.5 text-slate-600" />
                <span>Batch Queue</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Audit Logs (5 Cols) */}
        <div className="lg:col-span-5 h-[580px]">
          <LiveAuditLogs logs={logs} onClearLogs={onClearLogs} />
        </div>
      </div>
    </div>
  );
};

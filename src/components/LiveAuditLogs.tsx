import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Download, Trash2, CheckCircle, AlertTriangle, AlertCircle, Info, Shield } from 'lucide-react';
import { AuditLog } from '../types';

interface LiveAuditLogsProps {
  logs: AuditLog[];
  onClearLogs: () => void;
}

export const LiveAuditLogs: React.FC<LiveAuditLogsProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true;
    return log.level === filter;
  });

  const exportLogs = () => {
    const text = logs
      .map(l => `[${l.timestamp}] [${l.level}] ${l.message}${l.details ? ` - ${l.details}` : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fragment_audit_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: AuditLog['level']) => {
    switch (level) {
      case 'INFO': return 'text-slate-300';
      case 'SYS': return 'text-blue-400';
      case 'AUTH': return 'text-purple-400';
      case 'CHK': return 'text-emerald-400';
      case 'WARN': return 'text-amber-400';
      case 'ERROR': return 'text-rose-400 font-semibold';
      case 'SUCCESS': return 'text-emerald-300 font-semibold';
      default: return 'text-slate-400';
    }
  };

  const getLevelIcon = (level: AuditLog['level']) => {
    switch (level) {
      case 'CHK': return <Shield className="w-3 h-3 text-emerald-400 inline mr-1" />;
      case 'SUCCESS': return <CheckCircle className="w-3 h-3 text-emerald-400 inline mr-1" />;
      case 'WARN': return <AlertTriangle className="w-3 h-3 text-amber-400 inline mr-1" />;
      case 'ERROR': return <AlertCircle className="w-3 h-3 text-rose-400 inline mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="bg-slate-950 rounded-xl shadow-lg border border-slate-800 flex flex-col overflow-hidden h-full">
      {/* Terminal Title Bar */}
      <div className="p-3.5 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <h4 className="font-bold text-xs text-white uppercase tracking-wider">Live Audit Logs</h4>
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/60 text-blue-300 rounded font-mono font-bold">
            REALTIME
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            className="text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded transition flex items-center gap-1 disabled:opacity-40"
            title="Export full log as .txt"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>
          <button
            onClick={onClearLogs}
            disabled={logs.length === 0}
            className="text-[11px] font-semibold text-slate-400 hover:text-rose-300 bg-slate-800/60 hover:bg-rose-950/40 p-1.5 rounded transition disabled:opacity-40"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-slate-900/50 border-b border-slate-800/60 text-[10px] font-mono overflow-x-auto">
        {['ALL', 'CHK', 'SYS', 'SUCCESS', 'WARN', 'ERROR'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded transition ${
              filter === f
                ? 'bg-blue-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className="p-4 flex-1 font-mono text-[11px] overflow-y-auto leading-relaxed space-y-1.5 bg-slate-950 select-text max-h-[380px] min-h-[220px]"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-slate-500 italic py-6 text-center">
            No audit logs captured yet. Perform a split, compress, or merge operation to view telemetry.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="flex items-start gap-2 break-all hover:bg-slate-900/40 px-1 py-0.5 rounded">
              <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
              <span className={`shrink-0 font-bold ${getLevelColor(log.level)}`}>
                [{log.level}]
              </span>
              <span className={getLevelColor(log.level)}>
                {getLevelIcon(log.level)}
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

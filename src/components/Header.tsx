import React from 'react';
import { Bell, ShieldCheck, Cpu, Terminal, Download, Sparkles } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface HeaderProps {
  activeTab: string;
  onOpenLogs?: () => void;
  logsCount: number;
  onTriggerTestNotification?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenLogs,
  logsCount,
  onTriggerTestNotification,
}) => {
  const getTabLabel = (id: string) => {
    switch (id) {
      case 'dashboard': return 'Active Operations';
      case 'split': return 'Split Engine';
      case 'reassemble': return 'Reassembly & Merging';
      case 'compress': return 'Asset Compressor';
      case 'batch': return 'Batch Processing Queue';
      case 'cloud': return 'Cloud Storage Backups';
      case 'integrity': return 'Integrity & Checksums';
      default: return 'File Operations';
    }
  };

  const handleRequestNotification = async () => {
    const granted = await soundManager.requestNotificationPermission();
    if (granted) {
      soundManager.playSuccess();
      soundManager.sendSystemNotification(
        'FRAGMENT.IO System Connected',
        'Automated task completion notifications are active.'
      );
    }
    if (onTriggerTestNotification) onTriggerTestNotification();
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2.5 text-sm text-slate-500 font-medium">
        <span>FRAGMENT.IO</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">{getTabLabel(activeTab)}</span>
      </div>

      {/* Right Action & Status Area */}
      <div className="flex items-center gap-4">
        {/* Checksum Badge */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Checksums</span>
          <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wide">
            SHA-256 VERIFIED
          </span>
        </div>

        {/* Vercel Edge Badge */}
        <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <Cpu className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Runtime</span>
          <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wide">
            VERCEL EDGE
          </span>
        </div>

        {/* Live Logs Button */}
        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition"
            title="View Live Audit Logs"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Logs</span>
            {logsCount > 0 && (
              <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {logsCount}
              </span>
            )}
          </button>
        )}

        {/* Notification Bell */}
        <button
          onClick={handleRequestNotification}
          className="relative w-9 h-9 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200 transition"
          title="Enable/Test System Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
};

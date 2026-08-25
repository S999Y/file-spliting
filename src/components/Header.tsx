import React from 'react';
import { Bell, Terminal, Menu } from 'lucide-react';
import { soundManager } from '../utils/sound';

interface HeaderProps {
  activeTab: string;
  onOpenLogs?: () => void;
  logsCount: number;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenLogs,
  logsCount,
  onToggleSidebar,
}) => {
  const getTabLabel = (id: string) => {
    switch (id) {
      case 'dashboard': return 'Dashboard';
      case 'split': return 'Split Engine';
      case 'reassemble': return 'Reassembly';
      case 'compress': return 'Compressor';
      case 'batch': return 'Batch Queue';
      case 'cloud': return 'Cloud Storage';
      case 'integrity': return 'Checksum Verifier';
      default: return 'File Operations';
    }
  };

  const handleRequestNotification = async () => {
    const granted = await soundManager.requestNotificationPermission();
    if (granted) {
      soundManager.playSuccess();
      soundManager.sendSystemNotification(
        'Notifications Enabled',
        'Task completion alerts are now active.'
      );
    }
  };

  return (
    <header className="h-14 md:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 z-10">
      <div className="flex items-center gap-2.5 text-sm text-slate-500 font-medium">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <span className="text-slate-900 font-bold">FileShard</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">{getTabLabel(activeTab)}</span>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {onOpenLogs && (
          <button
            onClick={onOpenLogs}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 md:px-3 py-1.5 rounded-lg border border-slate-200 transition"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Audit Logs</span>
            {logsCount > 0 && (
              <span className="bg-slate-700 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {logsCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={handleRequestNotification}
          className="relative w-9 h-9 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-600 border border-slate-200 transition"
          title="Enable Test Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
};

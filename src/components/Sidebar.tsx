import React from 'react';
import {
  LayoutDashboard,
  Scissors,
  Link as LinkIcon,
  Zap,
  Package,
  Cloud,
  ShieldCheck,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  X
} from 'lucide-react';
import { soundManager } from '../utils/sound';
import { downloadDataJson, getDeviceLabel, clearAllDeviceData } from '../utils/dataStorage';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  soundEnabled,
  setSoundEnabled,
  onClose,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'split', label: 'Split Engine', icon: Scissors },
    { id: 'reassemble', label: 'Reassembly', icon: LinkIcon },
    { id: 'compress', label: 'Compressor', icon: Zap },
    { id: 'batch', label: 'Batch Queue', icon: Package },
    { id: 'cloud', label: 'Cloud Storage', icon: Cloud },
    { id: 'integrity', label: 'Checksum Verifier', icon: ShieldCheck },
  ];

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.setEnabled(next);
    if (next) soundManager.playSuccess();
  };

  const handleClearAll = () => {
    if (!confirm('Delete ALL data for this device? Stats, history, logs, and settings will be lost. This cannot be undone.')) return;
    clearAllDeviceData();
    window.location.reload();
  };

  return (
    <aside className="w-64 h-full bg-slate-900 flex flex-col shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 md:p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-xl shadow-md shadow-blue-500/20 tracking-wider">
            F
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black text-lg tracking-tight leading-none">
              FRAGMENT<span className="text-blue-400">.IO</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
              v3.0
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Device Label */}
      <div className="mx-3 mb-2 px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
          <span className="text-[10px] font-mono text-slate-400">
            <span className="text-slate-500">Session:</span>{' '}
            <span className="text-slate-300 font-bold">{getDeviceLabel()}</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 mt-auto border-t border-slate-800 space-y-2 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute notification chimes' : 'Enable notification chimes'}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={downloadDataJson}
              title="Export all data as JSON"
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
            <button
              onClick={handleClearAll}
              title="Delete all data for this device"
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-rose-400 px-2 py-1 rounded hover:bg-slate-800 transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

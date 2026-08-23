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
  HardDrive
} from 'lucide-react';
import { soundManager } from '../utils/sound';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  soundEnabled,
  setSoundEnabled,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'split', label: 'Split Engine', icon: Scissors },
    { id: 'reassemble', label: 'Reassembly', icon: LinkIcon },
    { id: 'compress', label: 'Asset Compressor', icon: Zap },
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

  return (
    <aside className="w-64 bg-slate-900 flex flex-col shrink-0 select-none border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white text-xl shadow-md shadow-blue-500/20 tracking-wider">
          F
        </div>
        <div className="flex flex-col">
          <span className="text-white font-black text-lg tracking-tight leading-none">
            FRAGMENT<span className="text-blue-400">.IO</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
            v2.4 • Edge Edition
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

      {/* Storage & Edge Node Status footer */}
      <div className="p-4 mt-auto border-t border-slate-800 space-y-3 bg-slate-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-[11px] text-slate-300 font-medium tracking-tight">
              Edge: Northern-VA
            </span>
          </div>
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute notification chimes' : 'Enable notification chimes'}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-400" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-slate-400" /> Local Vault
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold">Ready</span>
          </div>
          <div className="w-full bg-slate-700 h-1.5 rounded-full mb-1.5 overflow-hidden">
            <div className="bg-blue-500 h-full w-[68%] rounded-full"></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-300 font-mono">
            <span>842.5 GB</span>
            <span className="text-slate-500">1.2 TB</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

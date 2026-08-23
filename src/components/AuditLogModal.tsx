import React from 'react';
import { X } from 'lucide-react';
import { AuditLog } from '../types';
import { LiveAuditLogs } from './LiveAuditLogs';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: AuditLog[];
  onClearLogs: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  isOpen,
  onClose,
  logs,
  onClearLogs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            System Telemetry & Audit Logs
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-hidden">
          <LiveAuditLogs logs={logs} onClearLogs={onClearLogs} />
        </div>
      </div>
    </div>
  );
};

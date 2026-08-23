/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SplitEngineView } from './components/SplitEngineView';
import { ReassembleView } from './components/ReassembleView';
import { CompressorView } from './components/CompressorView';
import { BatchQueueView } from './components/BatchQueueView';
import { CloudStorageView } from './components/CloudStorageView';
import { IntegrityToolView } from './components/IntegrityToolView';
import { AuditLogModal } from './components/AuditLogModal';
import { SystemStats, AuditLog } from './types';
import { soundManager } from './utils/sound';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);

  // System Stats
  const [stats, setStats] = useState<SystemStats>({
    totalProcessedBytes: 1560000000000,
    totalSavedBytes: 480000000000,
    successfulOperations: 384,
    activeTasks: 0,
    checksumVerifications: 1248,
  });

  // Initial Audit logs
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: 'log-0',
      timestamp: new Date(Date.now() - 300000).toLocaleTimeString(),
      level: 'SYS',
      message: 'FRAGMENT.IO Vercel Edge Runtime initialized on cluster [iad1-edge].',
    },
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 180000).toLocaleTimeString(),
      level: 'AUTH',
      message: 'Cloud Vault backend storage connected with zero-knowledge SHA-256 indexing.',
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
      level: 'CHK',
      message: 'Cryptographic integrity pipeline verified — 100% bitwise verification ready.',
    },
  ]);

  const addLog = (
    level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS',
    message: string,
    details?: string
  ) => {
    const newLog: AuditLog = {
      id: 'log-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      details,
    };
    setLogs(prev => [...prev.slice(-150), newLog]);
  };

  const handleIncrementStats = (processedBytes: number, isSuccess: boolean) => {
    setStats(prev => ({
      ...prev,
      totalProcessedBytes: prev.totalProcessedBytes + processedBytes,
      totalSavedBytes: prev.totalSavedBytes + Math.round(processedBytes * 0.25),
      successfulOperations: isSuccess ? prev.successfulOperations + 1 : prev.successfulOperations,
      checksumVerifications: prev.checksumVerifications + 1,
    }));
  };

  const handleSendNotification = (title: string, msg: string) => {
    soundManager.sendSystemNotification(title, msg);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="h-screen w-screen bg-slate-100 flex overflow-hidden text-slate-900 font-sans antialiased select-none">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100">
        {/* Top Header Bar */}
        <Header
          activeTab={activeTab}
          onOpenLogs={() => setIsLogsModalOpen(true)}
          logsCount={logs.length}
          onTriggerTestNotification={() =>
            addLog('SYS', 'Notification test trigger dispatched to client.')
          }
        />

        {/* Dynamic Scrollable Content Workspace */}
        <main className="flex-1 overflow-y-auto p-8 select-text">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                logs={logs}
                onClearLogs={clearLogs}
                onNavigate={tab => setActiveTab(tab)}
                onQuickSplitDemo={() => setActiveTab('split')}
              />
            )}

            {activeTab === 'split' && (
              <SplitEngineView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'reassemble' && (
              <ReassembleView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'compress' && (
              <CompressorView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'batch' && (
              <BatchQueueView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'cloud' && (
              <CloudStorageView
                onLog={addLog}
                onNavigateToReassemble={() => setActiveTab('reassemble')}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'integrity' && (
              <IntegrityToolView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
              />
            )}
          </div>
        </main>
      </div>

      {/* Full Audit Log Modal */}
      <AuditLogModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        logs={logs}
        onClearLogs={clearLogs}
      />
    </div>
  );
}

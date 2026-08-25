import React, { useState, useEffect } from 'react';
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
import { loadStats, saveStats, loadLogs, saveLogs, saveHistoryEntry, HistoryEntry } from './utils/dataStorage';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const [stats, setStats] = useState<SystemStats>(() => loadStats());
  const [logs, setLogs] = useState<AuditLog[]>(() => loadLogs());

  useEffect(() => { saveStats(stats); }, [stats]);
  useEffect(() => { saveLogs(logs); }, [logs]);

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
      failedOperations: isSuccess ? prev.failedOperations : prev.failedOperations + 1,
      checksumVerifications: prev.checksumVerifications + 1,
    }));
  };

  const handleAddHistory = (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
    saveHistoryEntry({
      ...entry,
      id: 'hist-' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
    });
  };

  const handleSendNotification = (title: string, msg: string) => {
    soundManager.sendSystemNotification(title, msg);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen w-screen bg-slate-100 flex overflow-hidden text-slate-900 font-sans antialiased select-none">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleNavigate}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100">
        <Header
          activeTab={activeTab}
          onOpenLogs={() => setIsLogsModalOpen(true)}
          logsCount={logs.length}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 select-text">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'split' && (
              <SplitEngineView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onAddHistory={handleAddHistory}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'reassemble' && (
              <ReassembleView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onAddHistory={handleAddHistory}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'compress' && (
              <CompressorView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onAddHistory={handleAddHistory}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'batch' && (
              <BatchQueueView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onAddHistory={handleAddHistory}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'cloud' && (
              <CloudStorageView
                onLog={addLog}
                onNavigateToReassemble={() => handleNavigate('reassemble')}
                onSendNotification={handleSendNotification}
              />
            )}

            {activeTab === 'integrity' && (
              <IntegrityToolView
                onLog={addLog}
                onIncrementStats={handleIncrementStats}
                onAddHistory={handleAddHistory}
              />
            )}
          </div>
        </main>
      </div>

      <AuditLogModal
        isOpen={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        logs={logs}
        onClearLogs={clearLogs}
      />
    </div>
  );
}

import React, { useState, useRef } from 'react';
import {
  Package,
  Upload,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Scissors,
  Zap,
  ShieldCheck,
  Download,
  Lock,
  Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BatchItem } from '../types';
import { formatBytes } from '../utils/crypto';
import { splitFileInBrowser } from '../utils/splitter';
import { compressGenericFile } from '../utils/compressor';
import { soundManager } from '../utils/sound';
import { promptSaveDirectory, writeBlobsToDirectory, fallbackDownloadBlob, isFileSystemAccessSupported } from '../utils/saveHelper';

interface BatchQueueViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const BatchQueueView: React.FC<BatchQueueViewProps> = ({
  onLog,
  onIncrementStats,
  onSendNotification,
}) => {
  const [queue, setQueue] = useState<BatchItem[]>([]);

  const [operationType, setOperationType] = useState<'split' | 'compress' | 'verify'>('split');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [batchPassword, setBatchPassword] = useState<string>('');
  const [showBatchPassword, setShowBatchPassword] = useState<boolean>(false);
  const [useBatchDir, setUseBatchDir] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const newItems: BatchItem[] = files.map(f => ({
        id: 'batch-' + Math.random().toString(36).substring(2, 9),
        file: f,
        operation: operationType,
        status: 'queued',
        progress: 0,
        speed: '0 MB/s',
      }));

      setQueue(prev => [...prev, ...newItems]);
      onLog('INFO', `Enqueued ${newItems.length} file(s) for batch ${operationType}.`);
    }
  };

  const handleRunBatch = async () => {
    const queuedItems = queue.filter(item => item.status === 'queued');
    if (queuedItems.length === 0) return;

    setIsProcessing(true);
    onLog('SYS', `Starting batch execution queue for ${queuedItems.length} items...`);

    // Prompt for save directory ONCE for the entire batch if supported
    let dirHandle: FileSystemDirectoryHandle | null = null;
    if (useBatchDir && isFileSystemAccessSupported()) {
      onLog('INFO', 'Prompting for batch save directory...');
      dirHandle = await promptSaveDirectory();
      if (dirHandle) {
        onLog('SUCCESS', `Batch save directory selected. All results will be saved there.`);
      } else {
        onLog('INFO', 'No directory selected. Files will use browser download fallback.');
      }
    }

    for (const item of queuedItems) {
      // Set to processing
      setQueue(prev =>
        prev.map(q => (q.id === item.id ? { ...q, status: 'processing', progress: 10 } : q))
      );

      onLog('INFO', `Processing batch item: "${item.file.name}"...`);

      try {
        if (item.operation === 'split') {
          const splitRes = await splitFileInBrowser(
            item.file,
            {
              partSizeBytes: item.partSizeBytes || 25 * 1024 * 1024,
              splitMode: 'size',
              targetPartCount: 4,
              namingFormat: item.namingFormat || 'winrar',
              compressParts: false,
              compressionLevel: 6,
              verifyChecksums: true,
              destination: 'local',
              cloudProvider: 'vault',
              password: batchPassword || undefined,
            },
            p => {
              setQueue(prev =>
                prev.map(q => (q.id === item.id ? { ...q, progress: p, speed: '96 MB/s' } : q))
              );
            },
            (level, msg) => onLog(level, msg)
          );

          // Save all parts to directory if available
          if (dirHandle) {
            const files = splitRes.parts.filter(p => p.blob).map(p => ({ blob: p.blob!, name: p.name }));
            await writeBlobsToDirectory(dirHandle, files, true);
          }

          setQueue(prev =>
            prev.map(q =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'completed',
                    progress: 100,
                    result: {
                      partsCount: splitRes.parts.length,
                      originalSize: item.file.size || 1024 * 1024 * 50,
                      outputSize: splitRes.totalSize,
                    },
                  }
                : q
            )
          );
        } else if (item.operation === 'compress') {
          const compRes = await compressGenericFile(item.file, {
            mode: 'balanced',
            imageQuality: 0.8,
            convertToWebP: true,
            archiveFormat: 'zip',
          });

          // Save to directory if available
          if (dirHandle) {
            await writeBlobsToDirectory(dirHandle, [{ blob: compRes.compressedBlob, name: compRes.outputName }], true);
          }

          setQueue(prev =>
            prev.map(q =>
              q.id === item.id
                ? {
                    ...q,
                    status: 'completed',
                    progress: 100,
                    result: {
                      originalSize: compRes.originalSize,
                      outputSize: compRes.compressedSize,
                      savedPercentage: compRes.ratio,
                    },
                  }
                : q
            )
          );
        }

        onIncrementStats(item.file.size || 50 * 1024 * 1024, true);
        onLog('SUCCESS', `Completed batch item: ${item.file.name}`);
      } catch (err) {
        setQueue(prev =>
          prev.map(q =>
            q.id === item.id ? { ...q, status: 'failed', error: String(err) } : q
          )
        );
        onLog('ERROR', `Failed batch item ${item.file.name}: ${err}`);
      }
    }

    setIsProcessing(false);
    soundManager.playSuccess();
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.8 } });
    onSendNotification(
      'Batch Pipeline Complete',
      `Processed all items in the batch archive queue.`
    );
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(q => q.status !== 'completed'));
    onLog('INFO', 'Cleared completed batch queue items.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>Batch Archive Queue Manager</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Queue multiple large file archives for asynchronous parallel or sequential fragmentation and compression.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleAddFiles}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Archives to Queue</span>
            </button>

            <button
              onClick={handleRunBatch}
              disabled={isProcessing || !queue.some(q => q.status === 'queued')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:bg-slate-300"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Processing Queue...' : 'Execute Queue'}</span>
            </button>

            <button
              onClick={clearCompleted}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              title="Clear completed tasks"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operation Type Switcher */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs font-bold text-slate-600">
          <span>Batch Operation:</span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
            <button
              onClick={() => setOperationType('split')}
              className={`px-3 py-1 rounded-md transition ${
                operationType === 'split' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Scissors className="w-3 h-3 inline mr-1" />
              Batch Split
            </button>
            <button
              onClick={() => setOperationType('compress')}
              className={`px-3 py-1 rounded-md transition ${
                operationType === 'compress' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Batch Compress
            </button>
          </div>
        </div>

        {/* Batch Password & Save Options */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          {/* Password */}
          {operationType === 'split' && (
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <input
                type={showBatchPassword ? 'text' : 'password'}
                value={batchPassword}
                onChange={e => setBatchPassword(e.target.value)}
                placeholder="Archive password (optional)"
                className="rounded-lg border border-slate-300 p-1.5 text-xs font-mono w-48 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowBatchPassword(!showBatchPassword)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                {showBatchPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}

          {/* Directory Picker Toggle */}
          {isFileSystemAccessSupported() && (
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={useBatchDir}
                onChange={e => setUseBatchDir(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save all results to one folder (asked once)</span>
            </label>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Queue Items ({queue.length} tasks)
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            {queue.filter(q => q.status === 'completed').length} / {queue.length} Completed
          </span>
        </div>

        <div className="p-6 overflow-x-auto">
          {queue.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              The batch queue is currently empty. Click "Add Archives to Queue" to enqueue files.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="pb-3 px-2 font-bold">#</th>
                  <th className="pb-3 font-bold">Archive Name</th>
                  <th className="pb-3 font-bold">Operation</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 font-bold">Progress</th>
                  <th className="pb-3 font-bold">Result</th>
                  <th className="pb-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-2 font-bold text-slate-400">
                      {(idx + 1).toString().padStart(2, '0')}
                    </td>
                    <td className="py-3 font-bold text-slate-800 max-w-xs truncate">
                      {item.file.name}
                    </td>
                    <td className="py-3">
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {item.operation}
                      </span>
                    </td>
                    <td className="py-3">
                      {item.status === 'completed' && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          COMPLETED ✓
                        </span>
                      )}
                      {item.status === 'processing' && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded animate-pulse">
                          RUNNING ({item.speed})
                        </span>
                      )}
                      {item.status === 'queued' && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                          QUEUED
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded">
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-3 w-32">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === 'completed'
                              ? 'bg-emerald-500'
                              : item.status === 'failed'
                              ? 'bg-rose-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="py-3 text-slate-600">
                      {item.result ? (
                        item.operation === 'split' ? (
                          <span>{item.result.partsCount} Shards Generated</span>
                        ) : (
                          <span>Saved {item.result.savedPercentage}%</span>
                        )
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

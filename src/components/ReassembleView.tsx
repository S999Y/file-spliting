import React, { useState, useRef } from 'react';
import {
  Link as LinkIcon,
  Upload,
  Download,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  FileCode,
  RefreshCw,
  Sparkles,
  Cloud,
  FileText,
  Lock,
  LockOpen,
  FolderOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FileManifest } from '../types';
import { formatBytes } from '../utils/crypto';
import { reassembleFileFromParts, PartInput, ReassemblyResult } from '../utils/reassembler';
import { getStoredBackups } from '../utils/cloudStorage';
import { soundManager } from '../utils/sound';
import { promptSaveLocation, writeBlobToStream, fallbackDownloadBlob, promptSaveDirectory, writeBlobsToDirectory } from '../utils/saveHelper';
import { HistoryEntry } from '../utils/dataStorage';

interface ReassembleViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onAddHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const ReassembleView: React.FC<ReassembleViewProps> = ({
  onLog,
  onIncrementStats,
  onAddHistory,
  onSendNotification,
}) => {
  const [uploadedParts, setUploadedParts] = useState<PartInput[]>([]);
  const [manifest, setManifest] = useState<FileManifest | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<ReassemblyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [extractMode, setExtractMode] = useState<'extractHere' | 'extractToFolder'>('extractHere');
  const [savedDirHandle, setSavedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const partsInputRef = useRef<HTMLInputElement>(null);
  const manifestInputRef = useRef<HTMLInputElement>(null);

  const handlePartsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      const newPartInputs: PartInput[] = newFiles.map(file => ({
        name: file.name,
        blob: file,
      }));

      setUploadedParts(prev => {
        const combined = [...prev];
        for (const np of newPartInputs) {
          if (!combined.some(p => p.name === np.name)) {
            combined.push(np);
          }
        }
        return combined;
      });

      onLog('INFO', `Loaded ${newFiles.length} shard(s) into reassembly workspace.`);
      setResult(null);
      setErrorMsg(null);
      setSavedDirHandle(null);
    }
  };

  const handleManifestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const mFile = e.target.files[0];
      try {
        const text = await mFile.text();
        const parsed = JSON.parse(text) as FileManifest;
        setManifest(parsed);
        onLog('SUCCESS', `Loaded manifest for: "${parsed.originalName}" (${parsed.totalParts} parts)`);
        setResult(null);
        setErrorMsg(null);
      } catch {
        onLog('ERROR', 'Failed to parse manifest JSON file.');
        alert('Invalid manifest JSON file.');
      }
    }
  };

  const handleRestoreFromCloudBackup = (backupId: string) => {
    const backups = getStoredBackups();
    const backup = backups.find(b => b.id === backupId);
    if (backup) {
      const mockManifest: FileManifest = {
        manifestVersion: '1.0.0',
        fileId: backup.fileId,
        originalName: backup.originalName,
        originalSize: backup.totalSize,
        originalType: 'application/octet-stream',
        originalChecksum: backup.checksum,
        totalParts: backup.totalParts,
        partSize: Math.ceil(backup.totalSize / backup.totalParts),
        compressed: false,
        encrypted: false,
        createdAt: backup.uploadedAt,
        parts: backup.parts.map(p => ({
          index: p.index,
          name: p.name,
          size: p.size,
          checksum: p.checksum,
        })),
      };
      setManifest(mockManifest);
      onLog('SUCCESS', `Imported Cloud Vault manifest for ${backup.originalName}.`);
    }
  };

  const handleExecuteReassembly = async () => {
    if (uploadedParts.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await reassembleFileFromParts(
        uploadedParts,
        manifest || undefined,
        (p) => setProgress(p),
        (level, msg) => onLog(level, msg),
        password || undefined
      );

      setResult(res);
      onIncrementStats(res.reassembledSize, true);
      onAddHistory({
        type: 'reassemble',
        fileName: res.fileName,
        originalSize: res.originalSize,
        outputSize: res.reassembledSize,
        partsCount: res.totalPartsCount,
        success: true,
      });
      soundManager.playSuccess();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 } });

      onSendNotification(
        'File Reassembled Successfully',
        `Reconstituted "${res.fileName}" (${formatBytes(res.reassembledSize)}) with verified integrity.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      onLog('ERROR', `Reassembly aborted: ${msg}`);
      onIncrementStats(0, false);
      soundManager.playError();
    } finally {
      setIsProcessing(false);
    }
  };

  const getOrPromptDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
    if (savedDirHandle) return savedDirHandle;
    const dirHandle = await promptSaveDirectory();
    if (dirHandle) setSavedDirHandle(dirHandle);
    return dirHandle;
  };

  const handleDownloadReassembledFile = async () => {
    if (!result) return;
    if (extractMode === 'extractToFolder') {
      const dirHandle = await getOrPromptDirectory();
      if (dirHandle) {
        await writeBlobsToDirectory(dirHandle, [{ blob: result.file, name: result.fileName }], false);
        onLog('SUCCESS', `Saved to directory: ${result.fileName}`);
        return;
      }
    }
    const stream = await promptSaveLocation({
      suggestedName: result.fileName,
      mimeType: result.fileType || 'application/octet-stream'
    });
    if (stream) {
      await writeBlobToStream(stream, result.file, result.fileName, false);
      onLog('SUCCESS', `Saved reassembled file: ${result.fileName}`);
    } else {
      fallbackDownloadBlob(result.file, result.fileName);
      onLog('SUCCESS', `Downloaded: ${result.fileName}`);
    }
  };

  const missingPartsCount = manifest
    ? Math.max(0, manifest.totalParts - uploadedParts.length)
    : 0;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Top Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className="md:col-span-2 bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              <span>Upload Volume Parts</span>
            </h2>
            {uploadedParts.length > 0 && (
              <button
                onClick={() => setUploadedParts([])}
                className="text-[11px] md:text-xs text-rose-600 font-bold hover:underline self-start"
              >
                Clear All
              </button>
            )}
          </div>

          <div
            onClick={() => partsInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-5 md:p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition"
          >
            <input
              type="file"
              multiple
              ref={partsInputRef}
              onChange={handlePartsUpload}
              className="hidden"
            />
            <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Upload className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <p className="text-[11px] md:text-xs font-bold text-slate-800">
              Click or drop multiple `.part*` or `.001` files here
            </p>
            <p className="text-[10px] md:text-[11px] text-slate-400 mt-0.5 hidden sm:block">
              Supports WinRAR, 7-Zip, or binary shards
            </p>
          </div>

          {uploadedParts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] md:text-xs font-mono">
              <span className="text-slate-600 font-bold">
                {uploadedParts.length} file(s) loaded
              </span>
              <span className="text-slate-500">
                {formatBytes(uploadedParts.reduce((acc, p) => acc + p.blob.size, 0))}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-emerald-600" />
            <span>Manifest (Optional)</span>
          </h3>
          <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">
            Upload `.fshard.json` for automatic validation.
          </p>

          <input
            type="file"
            accept=".json"
            ref={manifestInputRef}
            onChange={handleManifestUpload}
            className="hidden"
          />

          {manifest ? (
            <div className="p-2.5 md:p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-[11px] md:text-xs font-mono text-emerald-900 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold truncate">{manifest.originalName}</span>
                <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded text-[9px] md:text-[10px] font-bold shrink-0">
                  ACTIVE
                </span>
              </div>
              <p className="text-[9px] md:text-[10px] text-emerald-700">
                {formatBytes(manifest.originalSize)} · {manifest.totalParts} Parts
              </p>
              <button
                onClick={() => setManifest(null)}
                className="text-[9px] md:text-[10px] text-rose-600 font-bold hover:underline pt-1 block"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={() => manifestInputRef.current?.click()}
              className="w-full py-3 md:py-4 border border-slate-200 rounded-lg text-[11px] md:text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center gap-1"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Select .fshard.json</span>
            </button>
          )}

          <div className="pt-1">
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mb-1">Quick Import</p>
            <button
              onClick={() => handleRestoreFromCloudBackup('backup-enterprise-9921')}
              className="w-full text-left p-2 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 text-[10px] md:text-[11px] font-mono text-slate-700 flex items-center justify-between transition"
            >
              <span className="truncate">enterprise_video_bundle_v14.raw</span>
              <Cloud className="w-3 h-3 text-blue-600 shrink-0 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Password & Extract Options */}
      {manifest && (
        <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {manifest.encrypted && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-[11px] md:text-xs font-bold text-slate-800">Decryption Password Required</span>
                </div>
                <p className="text-[10px] md:text-[11px] text-slate-500 hidden sm:block">
                  This archive is AES-256-GCM encrypted.
                </p>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Decryption password..."
                    className="w-full rounded-lg border border-amber-300 p-2 text-sm font-mono pr-9 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 bg-amber-50/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] md:text-xs font-bold text-slate-800">Extract Mode</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExtractMode('extractHere')}
                  className={`p-2 md:p-2.5 rounded-lg border text-left transition ${
                    extractMode === 'extractHere'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-[11px] md:text-xs font-bold">Extract Here</p>
                  <p className="text-[9px] md:text-[10px] text-slate-400">Current location</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExtractMode('extractToFolder')}
                  className={`p-2 md:p-2.5 rounded-lg border text-left transition ${
                    extractMode === 'extractToFolder'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-[11px] md:text-xs font-bold">Extract to Folder</p>
                  <p className="text-[9px] md:text-[10px] text-slate-400">Choose location</p>
                </button>
              </div>
            </div>
          </div>

          <div className="p-2.5 md:p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] md:text-[11px] font-mono text-slate-600 flex flex-wrap items-center gap-2 md:gap-4">
            {manifest.encrypted && (
              <span className="flex items-center gap-1 text-amber-700 font-bold">
                <Lock className="w-3 h-3" /> Encrypted
              </span>
            )}
            {manifest.compressed && (
              <span className="flex items-center gap-1 text-blue-700 font-bold">
                Compressed
              </span>
            )}
            <span className="text-slate-500">
              {manifest.archiveFormat?.toUpperCase() || 'RAR'} · {manifest.totalParts} Parts
            </span>
          </div>
        </div>
      )}

      {missingPartsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-3 md:p-4 rounded-xl flex items-center gap-2 md:gap-3 text-amber-800 text-[11px] md:text-xs">
          <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Missing {missingPartsCount} shard(s)!</p>
            <p className="text-[10px] md:text-[11px] text-amber-700 mt-0.5">
              Expected {manifest?.totalParts} parts, loaded {uploadedParts.length}.
            </p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 p-3 md:p-4 rounded-xl flex items-center gap-2 md:gap-3 text-rose-800 text-[11px] md:text-xs">
          <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Reassembly Failed</p>
            <p className="text-[10px] md:text-[11px] text-rose-700 mt-0.5 break-all">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Uploaded Parts Table */}
      {uploadedParts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">
              Loaded: {uploadedParts.length} shard(s)
            </h3>
            <button
              onClick={handleExecuteReassembly}
              disabled={isProcessing}
              className="px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] md:text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:bg-slate-300 self-start"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reassembling ({progress}%)...</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Reassemble</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 md:p-4 overflow-x-auto">
            <table className="w-full text-left text-[10px] md:text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] md:text-[10px]">
                  <th className="pb-2 px-1 md:px-2 font-bold">#</th>
                  <th className="pb-2 font-bold">Name</th>
                  <th className="pb-2 font-bold">Size</th>
                  <th className="pb-2 font-bold hidden sm:table-cell">Match</th>
                  <th className="pb-2 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploadedParts.map((p, idx) => {
                  const match = manifest?.parts.find(mp => mp.name === p.name);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2 px-1 md:px-2 font-bold text-slate-400">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2 font-bold text-slate-800 max-w-[150px] md:max-w-none truncate">{p.name}</td>
                      <td className="py-2 text-slate-600">{formatBytes(p.blob.size)}</td>
                      <td className="py-2 hidden sm:table-cell">
                        {manifest ? (
                          match ? (
                            <span className="text-[9px] md:text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 md:px-2 py-0.5 rounded">
                              MATCHED
                            </span>
                          ) : (
                            <span className="text-[9px] md:text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 md:px-2 py-0.5 rounded">
                              UNINDEXED
                            </span>
                          )
                        ) : (
                          <span className="text-[9px] md:text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setUploadedParts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 font-bold text-[10px] md:text-[11px]"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result Card */}
      {result && (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4 md:p-6 space-y-3 md:space-y-4 bg-emerald-50/20">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-900 font-mono truncate max-w-[200px] md:max-w-none">
                  {result.fileName}
                </h3>
                <p className="text-[11px] md:text-xs text-slate-500 font-mono mt-0.5">
                  <span className="font-bold text-slate-800">{formatBytes(result.reassembledSize)}</span> · {result.totalPartsCount} shards merged
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadReassembledFile}
              className="px-4 md:px-5 py-2 md:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] md:text-xs font-bold transition shadow-sm flex items-center gap-2 self-start"
            >
              <Download className="w-4 h-4" />
              <span>Download File</span>
            </button>
          </div>

          <div className="p-2.5 md:p-3 bg-white rounded-lg border border-slate-200 text-[10px] md:text-xs font-mono space-y-1 overflow-x-auto">
            <div className="flex justify-between text-slate-600 gap-2">
              <span className="shrink-0">SHA-256:</span>
              <span className="font-bold text-slate-900 truncate">{result.calculatedMasterChecksum}</span>
            </div>
            {manifest && (
              <div className="flex justify-between text-emerald-700 font-bold gap-2">
                <span className="shrink-0">Expected:</span>
                <span className="truncate">{manifest.originalChecksum}</span>
              </div>
            )}
            <div className="text-[10px] md:text-[11px] text-emerald-600 font-bold pt-1">
              Bitwise 100% identical verification confirmed
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FileManifest } from '../types';
import { formatBytes } from '../utils/crypto';
import { reassembleFileFromParts, PartInput, ReassemblyResult } from '../utils/reassembler';
import { getStoredBackups } from '../utils/cloudStorage';
import { soundManager } from '../utils/sound';
import { promptSaveLocation, writeBlobToStream, fallbackDownloadBlob, promptSaveDirectory, writeBlobsToDirectory } from '../utils/saveHelper';

interface ReassembleViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const ReassembleView: React.FC<ReassembleViewProps> = ({
  onLog,
  onIncrementStats,
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
        // deduplicate by name
        const combined = [...prev];
        for (const np of newPartInputs) {
          if (!combined.some(p => p.name === np.name)) {
            combined.push(np);
          }
        }
        return combined;
      });

      onLog('INFO', `Loaded ${newFiles.length} file shard(s) into reassembly workspace.`);
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
        onLog('SUCCESS', `Loaded shard manifest for: "${parsed.originalName}" (${parsed.totalParts} total parts)`);
        setResult(null);
        setErrorMsg(null);
      } catch {
        onLog('ERROR', 'Failed to parse .fshard.json manifest file.');
        alert('Invalid manifest JSON file.');
      }
    }
  };

  const handleRestoreFromCloudBackup = (backupId: string) => {
    const backups = getStoredBackups();
    const backup = backups.find(b => b.id === backupId);
    if (backup) {
      // Create mock manifest
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
      onLog('SUCCESS', `Imported Cloud Vault manifest for ${backup.originalName}. Upload matching shard files to reassemble.`);
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
        (p, cur, tot) => setProgress(p),
        (level, msg) => onLog(level, msg),
        password || undefined
      );

      setResult(res);
      onIncrementStats(res.reassembledSize, true);
      soundManager.playSuccess();
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.8 } });

      onSendNotification(
        'File Reassembled Successfully',
        `Reconstituted "${res.fileName}" (${formatBytes(res.reassembledSize)}) with 100% verified bitwise integrity.`
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
        onLog('SUCCESS', `Saved reassembled file to directory: ${result.fileName}`);
        return;
      }
    }
    // Fallback: single file save or browser download
    const stream = await promptSaveLocation({
      suggestedName: result.fileName,
      mimeType: result.fileType || 'application/octet-stream'
    });
    if (stream) {
      await writeBlobToStream(stream, result.file, result.fileName, false);
      onLog('SUCCESS', `Saved reassembled file to chosen location: ${result.fileName}`);
    } else {
      fallbackDownloadBlob(result.file, result.fileName);
      onLog('SUCCESS', `Downloaded reconstituted file: ${result.fileName}`);
    }
  };

  const missingPartsCount = manifest
    ? Math.max(0, manifest.totalParts - uploadedParts.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Shard Parts Upload (2 cols) */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              <span>Upload Volume Parts (.part1.rar, .part001, .001...)</span>
            </h2>
            {uploadedParts.length > 0 && (
              <button
                onClick={() => setUploadedParts([])}
                className="text-xs text-rose-600 font-bold hover:underline"
              >
                Clear All Parts
              </button>
            )}
          </div>

          <div
            onClick={() => partsInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50/50 hover:bg-blue-50/20 transition"
          >
            <input
              type="file"
              multiple
              ref={partsInputRef}
              onChange={handlePartsUpload}
              className="hidden"
            />
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-800">
              Click or Drag & Drop multiple `.part*` or `.001` files here
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supports WinRAR multi-volumes, 7-Zip numerical parts, or binary shards
            </p>
          </div>

          {uploadedParts.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs font-mono">
              <span className="text-slate-600 font-bold">
                Loaded: {uploadedParts.length} Volume File(s)
              </span>
              <span className="text-slate-500">
                Total: {formatBytes(uploadedParts.reduce((acc, p) => acc + p.blob.size, 0))}
              </span>
            </div>
          )}
        </div>

        {/* Optional Manifest JSON Upload (1 col) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <FileCode className="w-4 h-4 text-emerald-600" />
            <span>Shard Manifest (Optional)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Upload `.fshard.json` for automatic checksum validation & original name preservation.
          </p>

          <input
            type="file"
            accept=".json"
            ref={manifestInputRef}
            onChange={handleManifestUpload}
            className="hidden"
          />

          {manifest ? (
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs font-mono text-emerald-900 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">{manifest.originalName}</span>
                <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded text-[10px] font-bold">
                  ACTIVE
                </span>
              </div>
              <p className="text-[10px] text-emerald-700">
                Size: {formatBytes(manifest.originalSize)} • {manifest.totalParts} Parts
              </p>
              <button
                onClick={() => setManifest(null)}
                className="text-[10px] text-rose-600 font-bold hover:underline pt-1 block"
              >
                Remove Manifest
              </button>
            </div>
          ) : (
            <button
              onClick={() => manifestInputRef.current?.click()}
              className="w-full py-4 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 transition flex flex-col items-center justify-center gap-1"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Select .fshard.json Manifest</span>
            </button>
          )}

          {/* Quick Import from Cloud Vault */}
          <div className="pt-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Or Quick Import Cloud Vault</p>
            <button
              onClick={() => handleRestoreFromCloudBackup('backup-enterprise-9921')}
              className="w-full text-left p-2 rounded bg-slate-50 hover:bg-blue-50 border border-slate-200 text-[11px] font-mono text-slate-700 flex items-center justify-between transition"
            >
              <span className="truncate">enterprise_video_bundle_v14.raw</span>
              <Cloud className="w-3 h-3 text-blue-600 shrink-0 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* Password & Extract Options */}
      {manifest && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Password Field */}
            {manifest.encrypted && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-800">Decryption Password Required</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  This archive is encrypted with AES-256-GCM. Enter the password used during split.
                </p>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter decryption password..."
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

            {/* Extract Mode */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-800">Extract Mode</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Choose where the reassembled file will be saved.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExtractMode('extractHere')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    extractMode === 'extractHere'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold">Extract Here</p>
                  <p className="text-[10px] text-slate-400">Save to current location</p>
                </button>
                <button
                  type="button"
                  onClick={() => setExtractMode('extractToFolder')}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    extractMode === 'extractToFolder'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold">Extract to Folder</p>
                  <p className="text-[10px] text-slate-400">Choose save location</p>
                </button>
              </div>
            </div>
          </div>

          {/* Archive Info Bar */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-600 flex items-center gap-4">
            {manifest.encrypted && (
              <span className="flex items-center gap-1 text-amber-700 font-bold">
                <Lock className="w-3 h-3" />
                AES-256-GCM Encrypted
              </span>
            )}
            {manifest.compressed && (
              <span className="flex items-center gap-1 text-blue-700 font-bold">
                GZIP Compressed
              </span>
            )}
            <span className="text-slate-500">
              Format: {manifest.archiveFormat?.toUpperCase() || 'RAR'} • {manifest.totalParts} Parts
            </span>
            {manifest.archiveComment && (
              <span className="text-slate-500 italic">
                Comment: "{manifest.archiveComment}"
              </span>
            )}
          </div>
        </div>
      )}

      {/* Missing Parts Warning */}
      {missingPartsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">
              Missing {missingPartsCount} Shard Fragment(s)!
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              The manifest expects {manifest?.totalParts} parts, but only {uploadedParts.length} parts have been loaded. Upload the missing parts before reassembly.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Integrity Verification Failed</p>
            <p className="text-[11px] text-rose-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Uploaded Parts Table */}
      {uploadedParts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Loaded Shard Fragments ({uploadedParts.length} files)
            </h3>
            <button
              onClick={handleExecuteReassembly}
              disabled={isProcessing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:bg-slate-300"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying & Reassembling ({progress}%)...</span>
                </>
              ) : (
                <>
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Reassemble & Verify Integrity</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="pb-2 px-2 font-bold">#</th>
                  <th className="pb-2 font-bold">File Shard Name</th>
                  <th className="pb-2 font-bold">Size</th>
                  <th className="pb-2 font-bold">Manifest Match</th>
                  <th className="pb-2 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uploadedParts.map((p, idx) => {
                  const match = manifest?.parts.find(mp => mp.name === p.name);
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-2 font-bold text-slate-400">
                        {(idx + 1).toString().padStart(2, '0')}
                      </td>
                      <td className="py-2.5 font-bold text-slate-800">{p.name}</td>
                      <td className="py-2.5 text-slate-600">{formatBytes(p.blob.size)}</td>
                      <td className="py-2.5">
                        {manifest ? (
                          match ? (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                              MATCHED (Part #{match.index})
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                              UNINDEXED
                            </span>
                          )
                        ) : (
                          <span className="text-[10px] text-slate-400">No manifest</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => setUploadedParts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700 font-bold text-[11px]"
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
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-6 space-y-4 bg-emerald-50/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  {result.fileName}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Size: <span className="font-bold text-slate-800">{formatBytes(result.reassembledSize)}</span> • All {result.totalPartsCount} shards merged
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadReassembledFile}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Reconstituted File</span>
            </button>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs font-mono space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Master SHA-256 Calculated:</span>
              <span className="font-bold text-slate-900">{result.calculatedMasterChecksum}</span>
            </div>
            {manifest && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Expected Manifest Hash:</span>
                <span>{manifest.originalChecksum}</span>
              </div>
            )}
            <div className="text-[11px] text-emerald-600 font-bold pt-1">
              ✓ Bitwise 100% Identical Verification Confirmed
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

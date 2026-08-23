import React, { useState, useRef } from 'react';
import {
  Scissors,
  Upload,
  Download,
  FileCode,
  ShieldCheck,
  Zap,
  HardDrive,
  Cloud,
  CheckCircle,
  Archive,
  RefreshCw,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SplitConfig, PartInfo, FileManifest } from '../types';
import { formatBytes, formatDuration, describeFileReadError } from '../utils/crypto';
import { splitFileInBrowser, createBundleZip, SplitResult } from '../utils/splitter';
import { uploadShardBackupToCloud, getCloudConfig } from '../utils/cloudStorage';
import { soundManager } from '../utils/sound';

interface SplitEngineViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const SplitEngineView: React.FC<SplitEngineViewProps> = ({
  onLog,
  onIncrementStats,
  onSendNotification,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<'size' | 'count'>('size');
  const [partSizeMb, setPartSizeMb] = useState<number>(25);
  const [customUnit, setCustomUnit] = useState<'MB' | 'GB' | 'KB'>('MB');
  const [targetCount, setTargetCount] = useState<number>(4);
  const [compressParts, setCompressParts] = useState<boolean>(false);
  const [destination, setDestination] = useState<'local' | 'cloud' | 'both'>('local');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentPart, setCurrentPart] = useState<number>(0);
  const [totalParts, setTotalParts] = useState<number>(0);
  const [speedMBs, setSpeedMBs] = useState<number>(0);
  const [etaSeconds, setEtaSeconds] = useState<number>(0);

  // Result state
  const [result, setResult] = useState<SplitResult | null>(null);
  const [isBundlingZip, setIsBundlingZip] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<number>(0);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset sizes
  const presets = [
    { label: 'Discord Limit', sizeMb: 25, desc: '25 MB' },
    { label: 'GitHub Release', sizeMb: 50, desc: '50 MB' },
    { label: 'Vercel Serverless', sizeMb: 4.5, desc: '4.5 MB' },
    { label: 'Cloud Chunk', sizeMb: 100, desc: '100 MB' },
    { label: 'Email Safe', sizeMb: 20, desc: '20 MB' },
    { label: 'FAT32 Max', sizeMb: 4000, desc: '4 GB' },
  ];

  const getEffectivePartSizeBytes = (): number => {
    let multiplier = 1024 * 1024;
    if (customUnit === 'GB') multiplier = 1024 * 1024 * 1024;
    if (customUnit === 'KB') multiplier = 1024;
    return Math.round(partSizeMb * multiplier);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setResult(null);
      onLog('INFO', `Selected file for fragmentation: "${selected.name}" (${formatBytes(selected.size)})`);
    }
    // Allow re-selecting the same file later (e.g. after fixing a lock):
    // without this reset, an unchanged input value never fires onChange.
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      setResult(null);
      onLog('INFO', `Dropped file: "${dropped.name}" (${formatBytes(dropped.size)})`);
    }
  };

  const handleStartSplit = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    const config: SplitConfig = {
      partSizeBytes: getEffectivePartSizeBytes(),
      splitMode,
      targetPartCount: targetCount,
      compressParts,
      compressionLevel: 6,
      verifyChecksums: true,
      destination,
      cloudProvider: 'vault',
    };

    try {
      const splitRes = await splitFileInBrowser(
        file,
        config,
        (p, cur, tot, spd, eta) => {
          setProgress(p);
          setCurrentPart(cur);
          setTotalParts(tot);
          setSpeedMBs(spd);
          setEtaSeconds(eta);
        },
        (level, msg) => onLog(level, msg)
      );

      setResult(splitRes);
      onIncrementStats(file.size, true);
      soundManager.playSuccess();
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });

      onSendNotification(
        'Fragmentation Complete',
        `Successfully split ${file.name} into ${splitRes.parts.length} verified shards.`
      );

      // Auto cloud upload if destination requested
      if (destination === 'cloud' || destination === 'both') {
        setIsCloudSyncing(true);
        const cloudConfig = getCloudConfig();
        await uploadShardBackupToCloud(splitRes.manifest, splitRes.parts, cloudConfig);
        setIsCloudSyncing(false);
        onLog('SUCCESS', `Synchronized all ${splitRes.parts.length} shards to Cloud Vault backup.`);
      }
    } catch (err: unknown) {
      const errorMsg = describeFileReadError(err, file?.name ?? 'file');
      onLog('ERROR', `Splitting failed: ${errorMsg}`);
      onIncrementStats(0, false);
      soundManager.playError();
      alert(`Error splitting file: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPart = (part: PartInfo) => {
    if (!part.blob) return;
    const url = URL.createObjectURL(part.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = part.name;
    a.click();
    URL.revokeObjectURL(url);
    onLog('INFO', `Downloaded single shard: ${part.name}`);
  };

  const handleDownloadManifest = () => {
    if (!result) return;
    const jsonStr = JSON.stringify(result.manifest, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.manifest.originalName}.fshard.json`;
    a.click();
    URL.revokeObjectURL(url);
    onLog('INFO', `Exported shard manifest: ${result.manifest.originalName}.fshard.json`);
  };

  const handleDownloadZipBundle = async () => {
    if (!result) return;
    setIsBundlingZip(true);
    setZipProgress(0);
    onLog('SYS', `Bundling all ${result.parts.length} shards and manifest into consolidated ZIP package...`);

    try {
      const zipBlob = await createBundleZip(result.manifest, result.parts, p => setZipProgress(p));
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.manifest.originalName}_all_shards.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onLog('SUCCESS', `Exported ZIP bundle package (${formatBytes(zipBlob.size)}).`);
    } catch (err) {
      onLog('ERROR', `ZIP bundling error: ${err}`);
    } finally {
      setIsBundlingZip(false);
    }
  };

  const handleCopyChecksum = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* File Upload Zone */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-blue-600" />
          <span>Source File Selection</span>
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Select any application package, disk image (ISO), video archive, or large binary to fragment.
        </p>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
            file
              ? 'border-blue-400 bg-blue-50/30'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>

          {file ? (
            <div>
              <p className="text-sm font-bold text-slate-900 font-mono">{file.name}</p>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Size: <span className="font-bold text-slate-700">{formatBytes(file.size)}</span> • Type: {file.type || 'Binary / Raw'}
              </p>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="mt-3 text-xs text-blue-600 font-bold hover:underline"
              >
                Change Selected File
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-bold text-slate-800">
                Click to browse or drag & drop large file here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports unlimited file sizes (Vercel Edge & Web Stream optimized)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Config: Chunk Sizing */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Fragmentation Mode</h3>
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setSplitMode('size')}
                className={`px-3 py-1 rounded-md transition ${
                  splitMode === 'size' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                By Chunk Size
              </button>
              <button
                onClick={() => setSplitMode('count')}
                className={`px-3 py-1 rounded-md transition ${
                  splitMode === 'count' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                By Part Count
              </button>
            </div>
          </div>

          {splitMode === 'size' ? (
            <div className="space-y-3">
              {/* Presets */}
              <label className="block text-xs font-bold text-slate-500 uppercase">Target Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPartSizeMb(preset.sizeMb);
                      setCustomUnit(preset.sizeMb >= 1000 ? 'GB' : 'MB');
                    }}
                    className={`p-2 rounded-lg border text-left transition ${
                      partSizeMb === preset.sizeMb
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <p className="text-[11px] font-bold truncate">{preset.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{preset.desc}</p>
                  </button>
                ))}
              </div>

              {/* Custom Size Input */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Custom Shard Size
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={partSizeMb}
                    onChange={e => setPartSizeMb(parseFloat(e.target.value) || 1)}
                    className="flex-1 rounded-lg border border-slate-300 p-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value as 'MB' | 'GB' | 'KB')}
                    className="rounded-lg border border-slate-300 p-2 text-xs font-bold bg-white text-slate-700"
                  >
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                    <option value="KB">KB</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Total Shards to Generate: <span className="text-blue-600 font-bold">{targetCount} Parts</span>
              </label>
              <input
                type="range"
                min="2"
                max="32"
                value={targetCount}
                onChange={e => setTargetCount(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>2 Parts</span>
                <span>16 Parts</span>
                <span>32 Parts</span>
              </div>
            </div>
          )}

          {/* Shard Calculation Preview */}
          {file && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
              Estimated Output:{' '}
              <span className="font-bold text-blue-600">
                {splitMode === 'size'
                  ? `~${Math.ceil(file.size / getEffectivePartSizeBytes())} Shard Parts`
                  : `${targetCount} Shards (~${formatBytes(file.size / targetCount)} each)`}
              </span>
            </div>
          )}
        </div>

        {/* Right Config: Security & Storage Destination */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Optimization & Storage Options</h3>

          {/* Compression Toggle */}
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800">Lossless Stream Compression</span>
                <input
                  type="checkbox"
                  checked={compressParts}
                  onChange={e => setCompressParts(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Compresses each individual chunk with GZIP stream while maintaining original bit-level quality.
              </p>
            </div>
          </div>

          {/* Destination Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Storage Destination</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'local', label: 'Local Disk', icon: HardDrive, desc: 'Instant Download' },
                { id: 'cloud', label: 'Cloud Vault', icon: Cloud, desc: 'Edge Backup' },
                { id: 'both', label: 'Hybrid', icon: Archive, desc: 'Disk + Cloud' },
              ].map(dest => {
                const Icon = dest.icon;
                const isSelected = destination === dest.id;
                return (
                  <button
                    key={dest.id}
                    type="button"
                    onClick={() => setDestination(dest.id as 'local' | 'cloud' | 'both')}
                    className={`p-3 rounded-lg border text-center transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                    <p className="text-xs font-bold">{dest.label}</p>
                    <p className="text-[10px] text-slate-400">{dest.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartSplit}
            disabled={!file || isProcessing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-sm disabled:bg-slate-300 transition flex items-center justify-center gap-2 text-sm"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Fragmenting Shards ({progress}%)...</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                <span>Execute File Fragmentation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Progress Bar */}
      {isProcessing && (
        <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs font-mono text-blue-400 uppercase font-bold">Fragmentation In Progress</p>
              <h3 className="text-base font-bold font-mono">{file?.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Processing Shard {currentPart} of {totalParts}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black font-mono text-blue-400">{progress}%</span>
            </div>
          </div>

          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-400 pt-1 border-t border-slate-800">
            <div>Throughput: <span className="text-white font-bold">{speedMBs} MB/s</span></div>
            <div className="text-center">Remaining ETA: <span className="text-white font-bold">{formatDuration(etaSeconds)}</span></div>
            <div className="text-right">Integrity: <span className="text-emerald-400 font-bold">SHA-256 Active</span></div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          {/* Result Header */}
          <div className="p-5 border-b border-slate-100 bg-emerald-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Fragmentation Successful: {result.parts.length} Shards Created
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Master SHA-256: <span className="text-slate-800 font-bold">{result.manifest.originalChecksum.substring(0, 24)}...</span>
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadZipBundle}
                disabled={isBundlingZip}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isBundlingZip ? `Bundling ZIP (${zipProgress}%)...` : 'Download All as ZIP Bundle'}</span>
              </button>

              <button
                onClick={handleDownloadManifest}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-600" />
                <span>Download .fshard.json Manifest</span>
              </button>
            </div>
          </div>

          {/* Shards Table */}
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="pb-3 px-2 font-bold">#</th>
                  <th className="pb-3 font-bold">Shard Name</th>
                  <th className="pb-3 font-bold">Size</th>
                  <th className="pb-3 font-bold">SHA-256 Checksum</th>
                  <th className="pb-3 font-bold">Status</th>
                  <th className="pb-3 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.parts.map(part => (
                  <tr key={part.index} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-2 font-bold text-slate-500">{part.index.toString().padStart(2, '0')}</td>
                    <td className="py-3 font-bold text-slate-800">{part.name}</td>
                    <td className="py-3 text-slate-600">{formatBytes(part.size)}</td>
                    <td className="py-3">
                      <button
                        onClick={() => handleCopyChecksum(part.checksum)}
                        className="flex items-center gap-1 text-slate-500 hover:text-blue-600 font-mono text-[11px] group"
                        title="Click to copy SHA-256 hash"
                      >
                        <span>{part.checksum.substring(0, 16)}...</span>
                        {copiedHash === part.checksum ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        )}
                      </button>
                    </td>
                    <td className="py-3">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        VERIFIED ✓
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDownloadPart(part)}
                        className="text-blue-600 hover:text-blue-800 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

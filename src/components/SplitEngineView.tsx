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
  AlertCircle,
  Terminal,
  FolderArchive,
  HelpCircle,
  Layers,
  Lock,
  LockOpen,
  Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SplitConfig, PartInfo, FileManifest } from '../types';
import { formatBytes, formatDuration, parseSizeString } from '../utils/crypto';
import { splitFileInBrowser, createBundleZip, SplitResult, generateExtractionScripts } from '../utils/splitter';
import { uploadShardBackupToCloud, getCloudConfig } from '../utils/cloudStorage';
import { soundManager } from '../utils/sound';
import { promptSaveLocation, writeBlobToStream, promptSaveDirectory, writeBlobsToDirectory, fallbackDownloadBlob } from '../utils/saveHelper';
import { HistoryEntry } from '../utils/dataStorage';

interface SplitEngineViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onAddHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const SplitEngineView: React.FC<SplitEngineViewProps> = ({
  onLog,
  onIncrementStats,
  onAddHistory,
  onSendNotification,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<'size' | 'count'>('size');
  const [partSizeMb, setPartSizeMb] = useState<number>(500);
  const [customSizeText, setCustomSizeText] = useState<string>('500M');
  const [customUnit, setCustomUnit] = useState<'MB' | 'GB' | 'KB'>('MB');
  const [namingFormat, setNamingFormat] = useState<SplitConfig['namingFormat']>('winrar');
  const [targetCount, setTargetCount] = useState<number>(4);
  const [compressParts, setCompressParts] = useState<boolean>(false);
  const [destination, setDestination] = useState<'local' | 'cloud' | 'both'>('local');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [archiveFormat, setArchiveFormat] = useState<'rar' | 'zip' | '7z'>('rar');
  const [archiveComment, setArchiveComment] = useState<string>('');

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
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);
  const [savedDirHandle, setSavedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [checksumFormat, setChecksumFormat] = useState<'txt' | 'csv' | 'json'>('txt');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preset sizes matching WinRAR & popular platforms
  const presets = [
    { label: '500 MB', sizeMb: 500, text: '500M', desc: 'WinRAR Standard' },
    { label: '1 GB', sizeMb: 1024, text: '1G', desc: '1024 MB Volume' },
    { label: '100 MB', sizeMb: 100, text: '100M', desc: 'Web Upload' },
    { label: '25 MB', sizeMb: 25, text: '25M', desc: 'Discord Limit' },
    { label: '50 MB', sizeMb: 50, text: '50M', desc: 'GitHub Release' },
    { label: '700 MB', sizeMb: 700, text: '700M', desc: 'CD-ROM (700M)' },
    { label: '4.37 GB', sizeMb: 4480, text: '4480M', desc: 'DVD-R Max' },
  ];

  const getEffectivePartSizeBytes = (): number => {
    const parsedFromText = parseSizeString(customSizeText);
    if (parsedFromText && parsedFromText > 64 * 1024) {
      return parsedFromText;
    }
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
      setSavedDirHandle(null);
      onLog('INFO', `Selected file: "${selected.name}" (${formatBytes(selected.size)})`);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      setResult(null);
      setSavedDirHandle(null);
      onLog('INFO', `Dropped file: "${dropped.name}" (${formatBytes(dropped.size)})`);
    }
  };

  const getOrPromptDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
    if (savedDirHandle) return savedDirHandle;
    const dirHandle = await promptSaveDirectory();
    if (dirHandle) setSavedDirHandle(dirHandle);
    return dirHandle;
  };

  const handleStartSplit = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    setSavedDirHandle(null);

    const config: SplitConfig = {
      partSizeBytes: getEffectivePartSizeBytes(),
      splitMode,
      targetPartCount: targetCount,
      namingFormat,
      compressParts,
      compressionLevel: 6,
      verifyChecksums: true,
      destination,
      cloudProvider: 'vault',
      password: password || undefined,
      archiveFormat,
      archiveComment: archiveComment || undefined,
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
      onAddHistory({
        type: 'split',
        fileName: file.name,
        originalSize: file.size,
        outputSize: splitRes.totalSize,
        partsCount: splitRes.parts.length,
        success: true,
      });
      soundManager.playSuccess();
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });

      onSendNotification(
        'WinRAR Multi-Volume Split Complete',
        `Successfully split ${file.name} into ${splitRes.parts.length} volumes${password ? ' (AES-256-GCM encrypted)' : ''}.`
      );

      // Auto cloud upload if destination requested
      if (destination === 'cloud' || destination === 'both') {
        setIsCloudSyncing(true);
        const cloudConfig = getCloudConfig();
        await uploadShardBackupToCloud(splitRes.manifest, splitRes.parts, cloudConfig);
        setIsCloudSyncing(false);
        onLog('SUCCESS', `Synchronized all ${splitRes.parts.length} volumes to Cloud Vault.`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onLog('ERROR', `Splitting failed: ${errorMsg}`);
      onIncrementStats(0, false);
      soundManager.playError();
      alert(`Error splitting file: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPart = async (part: PartInfo) => {
    if (!part.blob) return;
    const stream = await promptSaveLocation({
      suggestedName: part.name,
      mimeType: 'application/octet-stream',
    });
    if (stream) {
      await writeBlobToStream(stream, part.blob, part.name, false);
      onLog('SUCCESS', `Saved volume to chosen location: ${part.name}`);
    } else {
      fallbackDownloadBlob(part.blob, part.name);
      onLog('INFO', `Downloaded volume: ${part.name}`);
    }
  };

  const handleDownloadAllPartsSequential = async () => {
    if (!result) return;
    setIsBatchDownloading(true);
    onLog('INFO', `Triggering sequential download for all ${result.parts.length} volume parts...`);

    const dirHandle = await getOrPromptDirectory();
    if (dirHandle) {
      const files = result.parts.filter(p => p.blob).map(p => ({ blob: p.blob!, name: p.name }));
      const savedCount = await writeBlobsToDirectory(dirHandle, files, true);
      onLog('SUCCESS', `Saved ${savedCount}/${result.parts.length} volumes to chosen directory.`);
    } else {
      for (let i = 0; i < result.parts.length; i++) {
        const part = result.parts[i];
        if (part.blob) {
          fallbackDownloadBlob(part.blob, part.name);
          await new Promise(r => setTimeout(r, 400));
        }
      }
      onLog('SUCCESS', `All ${result.parts.length} volumes dispatched to browser downloads.`);
    }

    setIsBatchDownloading(false);
  };

  const handleDownloadManifest = async () => {
    if (!result) return;
    const jsonStr = JSON.stringify(result.manifest, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const fileName = `${result.manifest.originalName}.fshard.json`;
    const dirHandle = await getOrPromptDirectory();
    if (dirHandle) {
      await writeBlobsToDirectory(dirHandle, [{ blob, name: fileName }], false);
      onLog('SUCCESS', `Saved manifest to directory: ${fileName}`);
    } else {
      fallbackDownloadBlob(blob, fileName);
      onLog('INFO', `Exported shard manifest: ${fileName}`);
    }
  };

  const handleDownloadChecksums = async () => {
    if (!result) return;
    const lines = result.parts.map(p => `${p.name}:${p.checksum}`);

    let content: string;
    let mimeType: string;
    let ext: string;

    if (checksumFormat === 'csv') {
      content = 'Filename,SHA-256\n' + result.parts.map(p => `${p.name},${p.checksum}`).join('\n');
      mimeType = 'text/csv';
      ext = 'csv';
    } else if (checksumFormat === 'json') {
      const obj = Object.fromEntries(result.parts.map(p => [p.name, p.checksum]));
      content = JSON.stringify(obj, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    } else {
      content = lines.join('\n');
      mimeType = 'text/plain';
      ext = 'txt';
    }

    const blob = new Blob([content], { type: mimeType });
    const fileName = `${result.manifest.originalName}.checksums.${ext}`;
    const dirHandle = await getOrPromptDirectory();
    if (dirHandle) {
      await writeBlobsToDirectory(dirHandle, [{ blob, name: fileName }], false);
      onLog('SUCCESS', `Saved checksums to directory: ${fileName}`);
    } else {
      fallbackDownloadBlob(blob, fileName);
      onLog('INFO', `Exported checksums: ${fileName}`);
    }
  };

  const handleDownloadScript = async (type: 'bat' | 'sh') => {
    if (!result) return;
    const content = type === 'bat' ? result.windowsBatchScript : result.unixBashScript;
    const fileName = type === 'bat' ? `extract_${result.manifest.originalName}.bat` : `extract_${result.manifest.originalName}.sh`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const dirHandle = await getOrPromptDirectory();
    if (dirHandle) {
      await writeBlobsToDirectory(dirHandle, [{ blob, name: fileName }], false);
      onLog('SUCCESS', `Saved extraction script to directory: ${fileName}`);
    } else {
      fallbackDownloadBlob(blob, fileName);
      onLog('SUCCESS', `Downloaded 1-click reassembly script: ${fileName}`);
    }
  };

  const handleDownloadZipBundle = async () => {
    if (!result) return;
    if (result.totalSize > 1.8 * 1024 * 1024 * 1024) {
      const proceed = confirm('This file is larger than 1.8 GB. Creating a single in-memory ZIP in the browser might exceed JavaScript memory limits. We recommend using "Download All Volumes" directly instead. Proceed with ZIP creation?');
      if (!proceed) return;
    }

    setIsBundlingZip(true);
    setZipProgress(0);
    onLog('SYS', `Bundling all ${result.parts.length} volumes and extractors into ZIP package...`);

    try {
      const zipBlob = await createBundleZip(result.manifest, result.parts, p => setZipProgress(p), password || undefined);
      const zipName = `${result.manifest.originalName}_volumes.zip`;
      const dirHandle = await getOrPromptDirectory();
      if (dirHandle) {
        await writeBlobsToDirectory(dirHandle, [{ blob: zipBlob, name: zipName }], false);
        onLog('SUCCESS', `Saved ZIP bundle to directory (${formatBytes(zipBlob.size)}).`);
      } else {
        fallbackDownloadBlob(zipBlob, zipName);
        onLog('SUCCESS', `Exported ZIP bundle package (${formatBytes(zipBlob.size)}).`);
      }
    } catch (err) {
      onLog('ERROR', `ZIP bundling error: ${err}`);
      alert(`ZIP bundling error: ${err}. For files 2GB+, please download the volume parts individually or using "Download All Volumes".`);
    } finally {
      setIsBundlingZip(false);
    }
  };

  const handleCopyChecksum = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const estimatedPartSize = getEffectivePartSizeBytes();
  const estimatedPartCount = file ? (splitMode === 'size' ? Math.ceil(file.size / estimatedPartSize) : targetCount) : 0;

  return (
    <div className="space-y-6">
      {/* File Upload Zone */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-blue-600" />
            <span>WinRAR Multi-Volume Split Engine</span>
          </h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
            Multi-GB Stream Hashing Enabled
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Split large video files, disc images (ISO), archives, or installers (2GB, 5GB, 10GB+) into smaller volume parts with zero RAM bloat.
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
                Size: <span className="font-bold text-slate-700">{formatBytes(file.size)}</span> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
              {file.size > 1024 * 1024 * 1024 && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  ⚡ 2+ GB Large File Detected: Zero-RAM Chunk Slicing will be used.
                </p>
              )}
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
                Click to browse or drag & drop large file here (e.g. 2.24 GB MP4)
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Zero RAM limits • Supports multi-gigabyte files with native WinRAR volume compatibility
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Config: Volume Sizing (WinRAR style) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Split to Volumes, Size</span>
            </h3>
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setSplitMode('size')}
                className={`px-3 py-1 rounded-md transition ${
                  splitMode === 'size' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
                }`}
              >
                By Volume Size
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
              <label className="block text-xs font-bold text-slate-500 uppercase">WinRAR & Standard Presets</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {presets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setPartSizeMb(preset.sizeMb);
                      setCustomSizeText(preset.text);
                      setCustomUnit(preset.sizeMb >= 1000 ? 'GB' : 'MB');
                    }}
                    className={`p-2 rounded-lg border text-left transition ${
                      customSizeText === preset.text || partSizeMb === preset.sizeMb
                        ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <p className="text-[11px] font-bold truncate">{preset.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{preset.desc}</p>
                  </button>
                ))}
              </div>

              {/* Custom Size Input with WinRAR syntax */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Volume Size (e.g. <span className="font-mono text-blue-600">500M</span>, <span className="font-mono text-blue-600">1G</span>, <span className="font-mono text-blue-600">100M</span>)
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSizeText}
                    onChange={e => {
                      setCustomSizeText(e.target.value);
                      const parsed = parseSizeString(e.target.value);
                      if (parsed) {
                        setPartSizeMb(parsed / (1024 * 1024));
                      }
                    }}
                    placeholder="e.g. 500M or 1G"
                    className="flex-1 rounded-lg border border-slate-300 p-2 text-sm font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={customUnit}
                    onChange={e => {
                      const newUnit = e.target.value as 'MB' | 'GB' | 'KB';
                      setCustomUnit(newUnit);
                      if (newUnit === 'GB') setCustomSizeText(`${partSizeMb / 1024}G`);
                      else if (newUnit === 'MB') setCustomSizeText(`${partSizeMb}M`);
                    }}
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
                Total Volumes to Generate: <span className="text-blue-600 font-bold">{targetCount} Parts</span>
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

          {/* Volume Calculation Preview */}
          {file && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
              Output Estimate: <span className="font-bold text-blue-600">{estimatedPartCount} Volumes</span> (~{formatBytes(file.size / Math.max(1, estimatedPartCount))} each)
            </div>
          )}
        </div>

        {/* Right Config: Naming Scheme & Options */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Volume Naming & Export Format</h3>

          {/* Naming Scheme */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Volume Naming Convention</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'winrar', label: 'WinRAR Archive', sample: '.part1.rar, .part2.rar' },
                { id: 'standard', label: 'Multi-Part Volume', sample: '.part001, .part002' },
                { id: 'numeric', label: '7-Zip Numeric', sample: '.001, .002' },
                { id: 'bin', label: 'Binary Shard', sample: '.part1.bin, .part2.bin' },
              ].map(fmt => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setNamingFormat(fmt.id as SplitConfig['namingFormat'])}
                  className={`p-2.5 rounded-lg border text-left transition ${
                    namingFormat === fmt.id
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold">{fmt.label}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{fmt.sample}</p>
                </button>
              ))}
            </div>
          </div>

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
                Losslessly compresses chunks using GZIP streams. (Leave off for raw bitwise slice compatibility).
              </p>
            </div>
          </div>

          {/* Password Protection */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-800">Password Protection (AES-256-GCM)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Encrypt each volume with military-grade AES-256 encryption. Password required for reassembly.
            </p>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter archive password (optional)"
                className="w-full rounded-lg border border-slate-300 p-2 text-sm font-mono pr-9 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              </button>
            </div>
            {password && (
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold">
                <ShieldCheck className="w-3 h-3" />
                <span>AES-256-GCM encryption will be applied to all volumes</span>
              </div>
            )}
          </div>

          {/* Archive Format */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Archive Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'rar' as const, label: 'RAR', sample: '.part1.rar' },
                { id: 'zip' as const, label: 'ZIP', sample: '.part1.zip' },
                { id: '7z' as const, label: '7Z', sample: '.part1.7z' },
              ].map(fmt => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setArchiveFormat(fmt.id)}
                  className={`p-2 rounded-lg border text-center transition ${
                    archiveFormat === fmt.id
                      ? 'border-blue-500 bg-blue-50/50 text-blue-900'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <p className="text-xs font-bold">{fmt.label}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{fmt.sample}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Archive Comment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Archive Comment (optional)</label>
            <input
              type="text"
              value={archiveComment}
              onChange={e => setArchiveComment(e.target.value)}
              placeholder="Add a comment to the archive..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
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
                <span>Splitting Volumes ({progress}%)...</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4" />
                <span>Split Into Volumes</span>
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
              <p className="text-xs font-mono text-blue-400 uppercase font-bold">Multi-Volume Slicing In Progress</p>
              <h3 className="text-base font-bold font-mono">{file?.name}</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Processing Volume {currentPart} of {totalParts} ({formatBytes(getEffectivePartSizeBytes())} per part)
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
            <div className="text-right">RAM Mode: <span className="text-emerald-400 font-bold">Streaming (0-bloat)</span></div>
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
                  Split Complete: {result.parts.length} Volumes Generated
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Master SHA-256: <span className="text-slate-800 font-bold">{result.manifest.originalChecksum.substring(0, 24)}...</span>
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadAllPartsSequential}
                disabled={isBatchDownloading}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isBatchDownloading ? 'Downloading Volumes...' : 'Download All Volumes'}</span>
              </button>

              <button
                onClick={handleDownloadZipBundle}
                disabled={isBundlingZip}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isBundlingZip ? `Bundling ZIP (${zipProgress}%)...` : 'Download as ZIP Bundle'}</span>
              </button>

              <button
                onClick={() => handleDownloadScript('bat')}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
                title="Windows CMD copy /b 1-click script"
              >
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                <span>Windows (.bat)</span>
              </button>

              <button
                onClick={() => handleDownloadScript('sh')}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
                title="Unix/macOS cat 1-click script"
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unix/Mac (.sh)</span>
              </button>

              <button
                onClick={handleDownloadManifest}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-200"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-600" />
                <span>Manifest (.fshard.json)</span>
              </button>

              {/* Checksums Download */}
              <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={handleDownloadChecksums}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Checksums</span>
                </button>
                <select
                  value={checksumFormat}
                  onChange={e => setChecksumFormat(e.target.value as 'txt' | 'csv' | 'json')}
                  className="px-1.5 py-2 text-[10px] font-bold text-slate-600 bg-slate-50 border-l border-slate-200 cursor-pointer focus:outline-none"
                >
                  <option value="txt">.txt</option>
                  <option value="csv">.csv</option>
                  <option value="json">.json</option>
                </select>
              </div>
            </div>
          </div>

          {/* WinRAR Extraction Help Box */}
          <div className="p-4 bg-blue-50/50 border-b border-blue-100 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-0.5">
              <p className="font-bold">How to Reassemble These Volumes Offline (WinRAR / CLI):</p>
              <p className="text-blue-800">
                1. Put all downloaded volume parts in the <strong>same folder</strong>.<br />
                2. <strong>In WinRAR / 7-Zip:</strong> Right-click the 1st part (<span className="font-mono">{result.parts[0]?.name}</span>) and select <strong>"Extract Here"</strong>.<br />
                3. <strong>Or via Terminal:</strong> Run the downloaded <span className="font-mono">extract.bat</span> (Windows) or <span className="font-mono">extract.sh</span> (Mac/Linux) to join them instantly with zero extra software!
              </p>
            </div>
          </div>

          {/* Shards Table */}
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                  <th className="pb-3 px-2 font-bold">#</th>
                  <th className="pb-3 font-bold">Volume Name</th>
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


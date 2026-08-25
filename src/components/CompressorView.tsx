import React, { useState, useRef } from 'react';
import {
  Zap,
  Upload,
  Download,
  Archive,
  RefreshCw,
  Sliders,
  Save
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatBytes } from '../utils/crypto';
import { compressGenericFile, CompressedAssetResult, CompressionOptions } from '../utils/compressor';
import { soundManager } from '../utils/sound';
import { fallbackDownloadBlob, promptSaveDirectory, writeBlobsToDirectory } from '../utils/saveHelper';
import { HistoryEntry } from '../utils/dataStorage';

interface CompressorViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onAddHistory: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const CompressorView: React.FC<CompressorViewProps> = ({
  onLog,
  onIncrementStats,
  onAddHistory,
  onSendNotification,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'lossless' | 'balanced' | 'maximum'>('balanced');
  const [quality, setQuality] = useState<number>(0.82);
  const [convertToWebP, setConvertToWebP] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [results, setResults] = useState<CompressedAssetResult[]>([]);
  const [savedDirHandle, setSavedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setResults([]);
      setSavedDirHandle(null);
      onLog('INFO', `Loaded ${files.length} asset(s) for compression.`);
    }
  };

  const getOrPromptDirectory = async (): Promise<FileSystemDirectoryHandle | null> => {
    if (savedDirHandle) return savedDirHandle;
    const dirHandle = await promptSaveDirectory();
    if (dirHandle) setSavedDirHandle(dirHandle);
    return dirHandle;
  };

  const handleStartCompression = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setResults([]);
    onLog('SYS', `Starting asset compression pipeline...`);

    const options: CompressionOptions = {
      mode,
      imageQuality: quality,
      convertToWebP,
      archiveFormat: 'zip',
    };

    const outResults: CompressedAssetResult[] = [];

    try {
      for (const file of selectedFiles) {
        onLog('INFO', `Optimizing: "${file.name}" (${formatBytes(file.size)})...`);
        const res = await compressGenericFile(file, options);
        outResults.push(res);
        onLog('SUCCESS', `${file.name}: ${formatBytes(res.originalSize)} -> ${formatBytes(res.compressedSize)} (-${res.ratio}%)`);
      }

      setResults(outResults);
      const totalOrig = outResults.reduce((a, b) => a + b.originalSize, 0);
      const totalComp = outResults.reduce((a, b) => a + b.compressedSize, 0);
      onIncrementStats(totalOrig, true);
      onAddHistory({
        type: 'compress',
        fileName: selectedFiles.map(f => f.name).join(', '),
        originalSize: totalOrig,
        outputSize: totalComp,
        success: true,
      });
      soundManager.playSuccess();
      confetti({ particleCount: 50, spread: 45, origin: { y: 0.8 } });

      onSendNotification(
        'Compression Finished',
        `Optimized ${outResults.length} assets, saving ${formatBytes(totalOrig - totalComp)}.`
      );
    } catch (err) {
      onLog('ERROR', `Compression error: ${err}`);
      soundManager.playError();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingle = async (res: CompressedAssetResult) => {
    const dirHandle = await getOrPromptDirectory();
    if (dirHandle) {
      await writeBlobsToDirectory(dirHandle, [{ blob: res.compressedBlob, name: res.outputName }], false);
      onLog('SUCCESS', `Saved: ${res.outputName}`);
    } else {
      fallbackDownloadBlob(res.compressedBlob, res.outputName);
      onLog('INFO', `Downloaded: ${res.outputName}`);
    }
  };

  const handleDownloadAll = async () => {
    if (results.length === 0) return;
    const dirHandle = await getOrPromptDirectory();
    if (dirHandle) {
      const files = results.map(r => ({ blob: r.compressedBlob, name: r.outputName }));
      const savedCount = await writeBlobsToDirectory(dirHandle, files, true);
      onLog('SUCCESS', `Saved ${savedCount}/${results.length} assets.`);
    } else {
      for (const res of results) {
        fallbackDownloadBlob(res.compressedBlob, res.outputName);
        await new Promise(r => setTimeout(r, 400));
      }
      onLog('SUCCESS', `All ${results.length} assets dispatched.`);
    }
  };

  const totalSavedBytes = results.reduce(
    (acc, r) => acc + Math.max(0, r.originalSize - r.compressedSize),
    0
  );

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
        <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Asset Compressor</span>
        </h2>
        <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">
          Optimize images with lossless/balanced algorithms and pack raw assets into high-efficiency archives.
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl p-5 md:p-8 text-center cursor-pointer bg-slate-50/40 hover:bg-amber-50/20 transition"
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFiles}
            className="hidden"
          />
          <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <p className="text-xs md:text-sm font-bold text-slate-800">
            {selectedFiles.length > 0
              ? `${selectedFiles.length} File(s) Selected`
              : 'Click or Drag & Drop Images/Archives'}
          </p>
          <p className="text-[10px] md:text-xs text-slate-400 mt-1 hidden sm:block">
            PNG, JPEG, SVG, WebP, Binaries, Code, Archives
          </p>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 md:space-y-5">
        <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Optimization Profiles</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'lossless', title: 'Lossless', desc: '100% original quality. Ideal for icons and pixel art.' },
            { id: 'balanced', title: 'Balanced', desc: 'Perceptually lossless, 60-80% byte reduction.' },
            { id: 'maximum', title: 'Maximum', desc: 'High-density for heavy assets and slow networks.' },
          ].map(p => {
            const isSelected = mode === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setMode(p.id as typeof mode)}
                className={`p-3 md:p-4 rounded-xl border text-left transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/40 text-slate-900 shadow-xs ring-1 ring-amber-400'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <p className="text-[11px] md:text-xs font-bold text-slate-900">{p.title}</p>
                <p className="text-[10px] md:text-[11px] text-slate-500 mt-1 leading-relaxed">{p.desc}</p>
              </button>
            );
          })}
        </div>

        {mode !== 'lossless' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-[11px] md:text-xs font-bold text-slate-700 mb-1.5">
                Quality: <span className="text-blue-600 font-mono">{Math.round(quality * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.05"
                value={quality}
                onChange={e => setQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 md:p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-[11px] md:text-xs font-bold text-slate-800">Convert to WebP</span>
                <p className="text-[9px] md:text-[10px] text-slate-400 hidden sm:block">+30% savings over JPEG/PNG</p>
              </div>
              <input
                type="checkbox"
                checked={convertToWebP}
                onChange={e => setConvertToWebP(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleStartCompression}
          disabled={selectedFiles.length === 0 || isProcessing}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 md:py-3 px-4 rounded-lg shadow-sm disabled:bg-slate-300 transition flex items-center justify-center gap-2 text-xs md:text-sm"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Optimizing...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Optimize {selectedFiles.length > 0 ? `${selectedFiles.length} File(s)` : 'Assets'}</span>
            </>
          )}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-3 md:p-4 px-4 md:px-6 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-wider">
              Results ({results.length} files, {formatBytes(totalSavedBytes)} saved)
            </h3>
            {results.length > 1 && (
              <button
                onClick={handleDownloadAll}
                className="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] md:text-xs font-bold transition shadow-xs self-start"
              >
                <Save className="w-3 h-3 md:w-3.5 md:h-3.5" />
                <span>Save All</span>
              </button>
            )}
          </div>

          <div className="p-4 md:p-6 space-y-3">
            {results.map((res, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center justify-between gap-3 p-3 md:p-4 border border-slate-200 rounded-xl bg-slate-50/40 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                  {res.previewUrl ? (
                    <img
                      src={res.previewUrl}
                      alt={res.outputName}
                      className="w-10 h-10 md:w-12 md:h-12 object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                      <Archive className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <h4 className="text-[11px] md:text-xs font-bold text-slate-900 font-mono truncate max-w-[150px] md:max-w-none">
                      {res.outputName}
                    </h4>
                    <p className="text-[10px] md:text-[11px] text-slate-500 font-mono mt-0.5">
                      <span className="line-through text-slate-400">{formatBytes(res.originalSize)}</span>{' '}
                      → <span className="font-bold text-slate-800">{formatBytes(res.compressedSize)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] md:text-xs font-extrabold px-2 md:px-2.5 py-0.5 md:py-1 rounded-md font-mono">
                    -{res.ratio}%
                  </span>
                  <button
                    onClick={() => handleDownloadSingle(res)}
                    className="px-2.5 md:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] md:text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Download className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

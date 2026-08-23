import React, { useState, useRef } from 'react';
import {
  Zap,
  Upload,
  Download,
  CheckCircle,
  Archive,
  RefreshCw,
  Image as ImageIcon,
  FileCode,
  Sliders,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { formatBytes } from '../utils/crypto';
import { compressGenericFile, CompressedAssetResult, CompressionOptions } from '../utils/compressor';
import { soundManager } from '../utils/sound';

interface CompressorViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onSendNotification: (title: string, msg: string) => void;
}

export const CompressorView: React.FC<CompressorViewProps> = ({
  onLog,
  onIncrementStats,
  onSendNotification,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'lossless' | 'balanced' | 'maximum'>('balanced');
  const [quality, setQuality] = useState<number>(0.82);
  const [convertToWebP, setConvertToWebP] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [results, setResults] = useState<CompressedAssetResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setResults([]);
      onLog('INFO', `Loaded ${files.length} asset(s) for compression optimization.`);
    }
  };

  const handleStartCompression = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setResults([]);
    onLog('SYS', `Starting asset compression optimization pipeline...`);

    const options: CompressionOptions = {
      mode,
      imageQuality: quality,
      convertToWebP,
      archiveFormat: 'zip',
    };

    const outResults: CompressedAssetResult[] = [];

    try {
      for (const file of selectedFiles) {
        onLog('INFO', `Optimizing asset: "${file.name}" (${formatBytes(file.size)})...`);
        const res = await compressGenericFile(file, options);
        outResults.push(res);
        onLog(
          'SUCCESS',
          `Compressed ${file.name}: ${formatBytes(res.originalSize)} -> ${formatBytes(res.compressedSize)} (-${res.ratio}%)`
        );
      }

      setResults(outResults);
      const totalOrig = outResults.reduce((a, b) => a + b.originalSize, 0);
      const totalComp = outResults.reduce((a, b) => a + b.compressedSize, 0);
      onIncrementStats(totalOrig, true);
      soundManager.playSuccess();
      confetti({ particleCount: 50, spread: 45, origin: { y: 0.8 } });

      onSendNotification(
        'Asset Compression Finished',
        `Optimized ${outResults.length} assets, saving ${formatBytes(totalOrig - totalComp)} total bandwidth.`
      );
    } catch (err) {
      onLog('ERROR', `Compression error: ${err}`);
      soundManager.playError();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingle = (res: CompressedAssetResult) => {
    const url = URL.createObjectURL(res.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.outputName;
    a.click();
    URL.revokeObjectURL(url);
    onLog('INFO', `Downloaded optimized asset: ${res.outputName}`);
  };

  const totalSavedBytes = results.reduce(
    (acc, r) => acc + Math.max(0, r.originalSize - r.compressedSize),
    0
  );

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Asset & Archive Performance Compressor</span>
        </h2>
        <p className="text-xs text-slate-500">
          Optimize images (PNG, JPEG, WebP) with lossless/balanced algorithms and pack raw assets into high-efficiency archives without visual quality loss.
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-amber-400 rounded-xl p-8 text-center cursor-pointer bg-slate-50/40 hover:bg-amber-50/20 transition"
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFiles}
            className="hidden"
          />
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {selectedFiles.length > 0
              ? `${selectedFiles.length} File(s) Selected`
              : 'Click or Drag & Drop Images, Documents, or Archives'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Supports PNG, JPEG, SVG, WebP, Binaries, Code, and Archives
          </p>
        </div>
      </div>

      {/* Compressor Tuning Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Optimization Profiles & Settings</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'lossless',
              title: 'Lossless (Bit-Identical)',
              desc: 'Preserves 100% original pixel data. Ideal for UI icons and pixel art.',
            },
            {
              id: 'balanced',
              title: 'Balanced (Optimal)',
              desc: 'Perceptually lossless with up to 60-80% byte reduction.',
            },
            {
              id: 'maximum',
              title: 'Maximum Compression',
              desc: 'High-density compression for heavy web assets and slow networks.',
            },
          ].map(p => {
            const isSelected = mode === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setMode(p.id as typeof mode)}
                className={`p-4 rounded-xl border text-left transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50/40 text-slate-900 shadow-xs ring-1 ring-amber-400'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                }`}
              >
                <p className="text-xs font-bold text-slate-900">{p.title}</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{p.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Sliders and Toggles */}
        {mode !== 'lossless' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Target Image Quality: <span className="text-blue-600 font-mono font-bold">{Math.round(quality * 100)}%</span>
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

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-xs font-bold text-slate-800">Convert to Modern WebP</span>
                <p className="text-[10px] text-slate-400">Yields additional 30% savings over JPEG/PNG</p>
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
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-lg shadow-sm disabled:bg-slate-300 transition flex items-center justify-center gap-2 text-sm"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Optimizing Assets...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Optimize {selectedFiles.length > 0 ? `${selectedFiles.length} Selected File(s)` : 'Assets'}</span>
            </>
          )}
        </button>
      </div>

      {/* Results Comparison Grid */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          <div className="p-4 px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Optimization Summary ({results.length} files, {formatBytes(totalSavedBytes)} saved)
            </h3>
          </div>

          <div className="p-6 space-y-4">
            {results.map((res, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-center justify-between gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/40 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {res.previewUrl ? (
                    <img
                      src={res.previewUrl}
                      alt={res.outputName}
                      className="w-12 h-12 object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                      <Archive className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-mono truncate">
                      {res.outputName}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      <span className="line-through text-slate-400">{formatBytes(res.originalSize)}</span>{' '}
                      → <span className="font-bold text-slate-800">{formatBytes(res.compressedSize)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-extrabold px-2.5 py-1 rounded-md font-mono">
                      -{res.ratio}%
                    </span>
                  </div>

                  <button
                    onClick={() => handleDownloadSingle(res)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
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

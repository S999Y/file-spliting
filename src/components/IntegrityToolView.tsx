import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Upload,
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  FileCheck,
  Fingerprint
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { calculateSHA256, formatBytes } from '../utils/crypto';
import { soundManager } from '../utils/sound';
import { HistoryEntry } from '../utils/dataStorage';

interface IntegrityToolViewProps {
  onLog: (level: 'INFO' | 'SYS' | 'AUTH' | 'CHK' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) => void;
  onIncrementStats: (processedBytes: number, isSuccess: boolean) => void;
  onAddHistory?: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
}

export const IntegrityToolView: React.FC<IntegrityToolViewProps> = ({
  onLog,
  onIncrementStats,
  onAddHistory,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [calculatedHash, setCalculatedHash] = useState<string | null>(null);
  const [expectedHash, setExpectedHash] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (selected: File) => {
    setFile(selected);
    setCalculatedHash(null);
    setIsCalculating(true);
    onLog('CHK', `Computing bitwise SHA-256 checksum for: "${selected.name}"...`);

    try {
      const hash = await calculateSHA256(selected);
      setCalculatedHash(hash);
      onLog('SUCCESS', `Computed SHA-256 for ${selected.name}: [${hash}]`);
      onIncrementStats(selected.size, true);
      soundManager.playSuccess();
    } catch (err) {
      onLog('ERROR', `Checksum calculation error: ${err}`);
      soundManager.playError();
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCopy = () => {
    if (!calculatedHash) return;
    navigator.clipboard.writeText(calculatedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMatching =
    calculatedHash && expectedHash.trim()
      ? calculatedHash.toLowerCase() === expectedHash.trim().toLowerCase()
      : null;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Bitwise Cryptographic Checksum & Tamper Verifier</span>
        </h2>
        <p className="text-xs text-slate-500">
          Verify end-to-end data integrity for files, individual shards, and archives against SHA-256 signatures to guarantee zero corruption during transmission.
        </p>

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer bg-slate-50/40 hover:bg-emerald-50/20 transition"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
          />
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <Fingerprint className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            {file ? file.name : 'Drop Any File or Shard to Compute SHA-256 Hash'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {file ? `${formatBytes(file.size)} • Ready` : 'Streaming cryptographic verification in browser memory'}
          </p>
        </div>
      </div>

      {/* Hash Verification Results */}
      {isCalculating && (
        <div className="bg-slate-900 text-white p-6 rounded-xl flex items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span className="text-sm font-mono font-bold">
            Streaming bitwise SHA-256 digest calculation...
          </span>
        </div>
      )}

      {calculatedHash && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Calculated SHA-256 Hash (64-character hex)
              </label>
              <button
                onClick={handleCopy}
                className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Hash'}</span>
              </button>
            </div>
            <div className="p-3.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg border border-slate-800 break-all select-all font-semibold">
              {calculatedHash}
            </div>
          </div>

          {/* Expected Hash Comparator */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700">
              Compare Against Expected Signature
            </label>
            <input
              type="text"
              placeholder="Paste expected SHA-256 hash here to test match..."
              value={expectedHash}
              onChange={e => setExpectedHash(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Verification Verdict */}
          {expectedHash.trim() !== '' && (
            <div
              className={`p-4 rounded-xl flex items-center gap-3 ${
                isMatching
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              {isMatching ? (
                <>
                  <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold font-mono">100% BITWISE MATCH CONFIRMED</h4>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      The file's binary contents perfectly match the provided cryptographic fingerprint. Zero tampering or packet loss detected.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold font-mono">CHECKSUM SIGNATURE MISMATCH</h4>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      The computed hash differs from the expected hash. This indicates file modification, bit rot, or transmission corruption.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
  Fingerprint,
  FileText,
  Trash2
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

interface BatchResult {
  fileName: string;
  expectedHash: string;
  calculatedHash: string;
  match: boolean;
  size: number;
}

function parseChecksumsFile(content: string): Record<string, string> {
  const map: Record<string, string> = {};

  try {
    const obj = JSON.parse(content);
    if (typeof obj === 'object' && obj !== null) {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') map[k.trim()] = v.trim();
      }
      if (Object.keys(map).length > 0) return map;
    }
  } catch { /* not JSON */ }

  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.toLowerCase().startsWith('filename')) continue;
    const csvMatch = line.match(/^([^,]+),([a-fA-F0-9]{64})/);
    if (csvMatch) {
      map[csvMatch[1].trim()] = csvMatch[2].trim();
      continue;
    }
    const colonMatch = line.match(/^([^:]+):([a-fA-F0-9]{64})/);
    if (colonMatch) {
      map[colonMatch[1].trim()] = colonMatch[2].trim();
    }
  }

  return map;
}

export const IntegrityToolView: React.FC<IntegrityToolViewProps> = ({
  onLog,
  onIncrementStats,
  onAddHistory,
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');

  const [file, setFile] = useState<File | null>(null);
  const [calculatedHash, setCalculatedHash] = useState<string | null>(null);
  const [expectedHash, setExpectedHash] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const [checksumsMap, setChecksumsMap] = useState<Record<string, string>>({});
  const [checksumsFileName, setChecksumsFileName] = useState<string>('');
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const checksumsInputRef = useRef<HTMLInputElement>(null);
  const batchFilesInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (selected: File) => {
    setFile(selected);
    setCalculatedHash(null);
    setIsCalculating(true);
    onLog('CHK', `Computing SHA-256 for: "${selected.name}"...`);

    try {
      const hash = await calculateSHA256(selected);
      setCalculatedHash(hash);
      onLog('SUCCESS', `SHA-256 for ${selected.name}: [${hash}]`);
      onIncrementStats(selected.size, true);
      soundManager.playSuccess();
    } catch (err) {
      onLog('ERROR', `Checksum error: ${err}`);
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

  const handleChecksumsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const map = parseChecksumsFile(text);
    setChecksumsMap(map);
    setChecksumsFileName(f.name);
    setBatchResults([]);
    onLog('SUCCESS', `Loaded checksums: ${f.name} (${Object.keys(map).length} entries)`);
  };

  const handleBatchFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBatchFiles(Array.from(e.target.files));
      setBatchResults([]);
    }
  };

  const handleRunBatchVerify = async () => {
    if (batchFiles.length === 0 || Object.keys(checksumsMap).length === 0) return;

    setIsBatchRunning(true);
    setBatchResults([]);
    const results: BatchResult[] = [];
    let matchCount = 0;

    for (let i = 0; i < batchFiles.length; i++) {
      const f = batchFiles[i];
      setBatchProgress(`${i + 1}/${batchFiles.length}: ${f.name}`);
      onLog('CHK', `[${i + 1}/${batchFiles.length}] "${f.name}"...`);

      try {
        const hash = await calculateSHA256(f);
        const expected = checksumsMap[f.name] || '';
        const match = expected ? hash.toLowerCase() === expected.toLowerCase() : false;
        if (match) matchCount++;

        results.push({
          fileName: f.name,
          expectedHash: expected || '(not in file)',
          calculatedHash: hash,
          match,
          size: f.size,
        });

        onLog(match ? 'SUCCESS' : (expected ? 'ERROR' : 'WARN'),
          `${f.name}: ${match ? 'MATCH' : (expected ? 'MISMATCH' : 'NO HASH')}`
        );
      } catch (err) {
        results.push({
          fileName: f.name,
          expectedHash: checksumsMap[f.name] || '(not in file)',
          calculatedHash: `ERROR: ${err}`,
          match: false,
          size: f.size,
        });
      }
    }

    setBatchResults(results);
    setIsBatchRunning(false);
    setBatchProgress('');

    if (matchCount === results.length && results.length > 0) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
      soundManager.playSuccess();
    } else {
      soundManager.playError();
    }

    onLog(matchCount === results.length ? 'SUCCESS' : 'WARN',
      `Batch complete: ${matchCount}/${results.length} matched.`
    );
  };

  const expectedCount = batchFiles.filter(f => checksumsMap[f.name]).length;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
        <h2 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>SHA-256 Checksum Verifier</span>
        </h2>
        <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">
          Verify file integrity against SHA-256 hashes. Single file or batch verify.
        </p>

        <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit text-[11px] md:text-xs font-bold">
          <button
            onClick={() => setMode('single')}
            className={`px-3 md:px-4 py-1.5 rounded-md transition ${
              mode === 'single' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
            }`}
          >
            <Fingerprint className="w-3 h-3 inline mr-1" />
            Single
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`px-3 md:px-4 py-1.5 rounded-md transition ${
              mode === 'batch' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500'
            }`}
          >
            <FileCheck className="w-3 h-3 inline mr-1" />
            Batch
          </button>
        </div>
      </div>

      {/* ========== SINGLE FILE MODE ========== */}
      {mode === 'single' && (
        <>
          <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-5 md:p-8 text-center cursor-pointer bg-slate-50/40 hover:bg-emerald-50/20 transition"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <Fingerprint className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <p className="text-xs md:text-sm font-bold text-slate-800">
                {file ? file.name : 'Drop any file to compute SHA-256'}
              </p>
              <p className="text-[10px] md:text-xs text-slate-400 mt-1">
                {file ? `${formatBytes(file.size)} • Ready` : 'Streaming cryptographic verification'}
              </p>
            </div>
          </div>

          {isCalculating && (
            <div className="bg-slate-900 text-white p-4 md:p-6 rounded-xl flex items-center justify-center gap-3">
              <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin text-emerald-400" />
              <span className="text-[11px] md:text-sm font-mono font-bold">
                Computing SHA-256...
              </span>
            </div>
          )}

          {calculatedHash && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4 md:space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
                    SHA-256 Hash
                  </label>
                  <button
                    onClick={handleCopy}
                    className="text-[11px] md:text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 md:p-3.5 bg-slate-900 text-emerald-400 font-mono text-[10px] md:text-xs rounded-lg border border-slate-800 break-all select-all font-semibold">
                  {calculatedHash}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-[11px] md:text-xs font-bold text-slate-700">
                  Compare Against Expected Hash
                </label>
                <input
                  type="text"
                  placeholder="Paste expected SHA-256 hash..."
                  value={expectedHash}
                  onChange={e => setExpectedHash(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 md:p-2.5 text-[11px] md:text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {expectedHash.trim() !== '' && (
                <div
                  className={`p-3 md:p-4 rounded-xl flex items-center gap-2 md:gap-3 ${
                    isMatching
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  {isMatching ? (
                    <>
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="text-[11px] md:text-xs font-bold font-mono">100% BITWISE MATCH</h4>
                        <p className="text-[10px] md:text-[11px] text-emerald-700 mt-0.5">
                          File contents perfectly match the expected hash.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 md:w-6 md:h-6 text-rose-600 shrink-0" />
                      <div>
                        <h4 className="text-[11px] md:text-xs font-bold font-mono">CHECKSUM MISMATCH</h4>
                        <p className="text-[10px] md:text-[11px] text-rose-700 mt-0.5">
                          Hash differs — file may be modified or corrupted.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========== BATCH VERIFY MODE ========== */}
      {mode === 'batch' && (
        <>
          <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
            <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Step 1: Upload Checksums File</span>
            </h3>
            <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">
              Upload a <code className="bg-slate-100 px-1 rounded">.txt</code>, <code className="bg-slate-100 px-1 rounded">.csv</code>, or <code className="bg-slate-100 px-1 rounded">.json</code> file from the split engine.
            </p>

            <input
              type="file"
              accept=".txt,.csv,.json"
              ref={checksumsInputRef}
              onChange={handleChecksumsUpload}
              className="hidden"
            />

            {checksumsFileName ? (
              <div className="flex items-center justify-between p-2.5 md:p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] md:text-xs font-bold text-emerald-800 truncate">{checksumsFileName}</span>
                  <span className="text-[9px] md:text-[10px] text-emerald-600 font-mono shrink-0">
                    {Object.keys(checksumsMap).length} hashes
                  </span>
                </div>
                <button
                  onClick={() => {
                    setChecksumsMap({});
                    setChecksumsFileName('');
                    setBatchResults([]);
                    checksumsInputRef.current && (checksumsInputRef.current.value = '');
                  }}
                  className="text-rose-500 hover:text-rose-700 shrink-0 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => checksumsInputRef.current?.click()}
                className="w-full py-3 md:py-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg text-[11px] md:text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-1"
              >
                <Upload className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                <span>Select checksums file</span>
              </button>
            )}

            {Object.keys(checksumsMap).length > 0 && (
              <div className="max-h-28 md:max-h-32 overflow-y-auto rounded-lg border border-slate-200 text-[10px] md:text-[11px] font-mono">
                {Object.entries(checksumsMap).map(([name, hash]: [string, string]) => (
                  <div key={name} className="flex items-center gap-2 px-2 md:px-3 py-1.5 border-b border-slate-100 last:border-0">
                    <span className="font-bold text-slate-800 truncate shrink-0 max-w-[150px] md:max-w-[200px]">{name}</span>
                    <span className="text-slate-400">:</span>
                    <span className="text-slate-500 truncate">{hash.substring(0, 20)}...</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-3 md:space-y-4">
            <h3 className="text-xs md:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Step 2: Upload Files to Verify</span>
            </h3>
            <p className="text-[11px] md:text-xs text-slate-500 hidden sm:block">
              Select all the split part files to verify against the checksums.
            </p>

            <input
              type="file"
              multiple
              ref={batchFilesInputRef}
              onChange={handleBatchFilesUpload}
              className="hidden"
            />

            {batchFiles.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] md:text-xs font-bold text-slate-700">
                    {batchFiles.length} file(s) · {expectedCount} matched
                  </span>
                  <button
                    onClick={() => {
                      setBatchFiles([]);
                      setBatchResults([]);
                      batchFilesInputRef.current && (batchFilesInputRef.current.value = '');
                    }}
                    className="text-[11px] md:text-xs text-rose-600 font-bold hover:underline"
                  >
                    Clear
                  </button>
                </div>

                <div className="max-h-36 md:max-h-40 overflow-y-auto rounded-lg border border-slate-200 text-[10px] md:text-[11px] font-mono divide-y divide-slate-100">
                  {batchFiles.map(f => {
                    const hasExpected = !!checksumsMap[f.name];
                    return (
                      <div key={f.name} className="flex items-center gap-2 px-2 md:px-3 py-1.5 md:py-2">
                        <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full shrink-0 ${hasExpected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span className="font-bold text-slate-800 truncate flex-1">{f.name}</span>
                        <span className="text-slate-400 shrink-0">{formatBytes(f.size)}</span>
                        <span className={`text-[9px] md:text-[10px] font-bold shrink-0 ${hasExpected ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {hasExpected ? 'IN FILE' : 'NO HASH'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button
                onClick={() => batchFilesInputRef.current?.click()}
                className="w-full py-3 md:py-4 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg text-[11px] md:text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50/30 transition flex flex-col items-center justify-center gap-1"
              >
                <Upload className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                <span>Select part files to verify</span>
              </button>
            )}
          </div>

          {batchFiles.length > 0 && Object.keys(checksumsMap).length > 0 && batchResults.length === 0 && (
            <button
              onClick={handleRunBatchVerify}
              disabled={isBatchRunning}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 md:py-3 px-4 rounded-lg shadow-sm disabled:bg-slate-300 transition flex items-center justify-center gap-2 text-xs md:text-sm"
            >
              {isBatchRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{batchProgress}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify All {batchFiles.length} Files</span>
                </>
              )}
            </button>
          )}

          {batchResults.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 md:p-4 px-4 md:px-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <h3 className="text-[10px] md:text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Results
                </h3>
                <span className={`text-[11px] md:text-xs font-bold ${
                  batchResults.every(r => r.match) ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {batchResults.filter(r => r.match).length}/{batchResults.length} Matched
                </span>
              </div>

              <div className="p-3 md:p-4 overflow-x-auto">
                <table className="w-full text-left text-[10px] md:text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase text-[9px] md:text-[10px]">
                      <th className="pb-2 px-1 md:px-2 font-bold">#</th>
                      <th className="pb-2 font-bold">File</th>
                      <th className="pb-2 font-bold hidden sm:table-cell">Size</th>
                      <th className="pb-2 font-bold hidden md:table-cell">Calculated</th>
                      <th className="pb-2 font-bold hidden lg:table-cell">Expected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchResults.map(r => (
                      <tr key={r.fileName} className={`transition ${
                        r.match ? 'bg-emerald-50/30' : r.expectedHash.startsWith('(') ? '' : 'bg-rose-50/30'
                      }`}>
                        <td className="py-2 px-1 md:px-2">
                          {r.match ? (
                            <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-emerald-500" />
                          ) : r.calculatedHash.startsWith('ERROR') ? (
                            <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-rose-500" />
                          )}
                        </td>
                        <td className="py-2 font-bold text-slate-800 max-w-[120px] md:max-w-[200px] truncate">{r.fileName}</td>
                        <td className="py-2 text-slate-500 hidden sm:table-cell">{formatBytes(r.size)}</td>
                        <td className="py-2 text-slate-600 max-w-[100px] md:max-w-[150px] truncate hidden md:table-cell" title={r.calculatedHash}>
                          {r.calculatedHash.startsWith('ERROR') ? (
                            <span className="text-amber-600">{r.calculatedHash}</span>
                          ) : (
                            r.calculatedHash.substring(0, 16) + '...'
                          )}
                        </td>
                        <td className="py-2 text-slate-600 max-w-[100px] md:max-w-[150px] truncate hidden lg:table-cell" title={r.expectedHash}>
                          {r.expectedHash.startsWith('(') ? (
                            <span className="text-amber-500 italic">{r.expectedHash}</span>
                          ) : (
                            r.expectedHash.substring(0, 16) + '...'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 md:p-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setBatchResults([])}
                  className="px-3 md:px-4 py-1.5 md:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] md:text-xs font-bold transition border border-slate-200 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  <span>Verify Again</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

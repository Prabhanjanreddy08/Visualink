'use me';
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ReceiverSession, ReceiverResult } from '../../lib/transfer/receiver';
import { TransferMetrics } from '../../lib/performance/metrics';
import { FileMetadata } from '../../lib/protocol/metadata';
import { CameraScanner } from './CameraScanner';
import { playLockBeep, playSuccessBeep } from '../../lib/audio/sounds';
import { Download, CheckCircle2, AlertTriangle, ShieldCheck, Terminal, XCircle, Zap } from 'lucide-react';

export interface ReceiverDashboardProps {
  pairCode?: string;
  onCancel: () => void;
}

export function ReceiverDashboard({ pairCode, onCancel }: ReceiverDashboardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const receiverRef = useRef<ReceiverSession | null>(null);
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [guidanceText, setGuidanceText] = useState('Point camera at sender screen');
  const [result, setResult] = useState<ReceiverResult | null>(null);
  const [sessionIdHex, setSessionIdHex] = useState('—');
  const [enteredPairCode, setEnteredPairCode] = useState(pairCode || '8492');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const hasAutoDownloadedRef = useRef<boolean>(false);

  // Monitor for file download completion & auto-finalize
  useEffect(() => {
    if (result) return;

    const interval = setInterval(async () => {
      if (receiverRef.current) {
        const completedResult = await receiverRef.current.checkAndFinalize();
        if (completedResult) {
          setIsCameraActive(false);
          setResult(completedResult);
          playSuccessBeep();
          addLog(`FILE DOWNLOAD COMPLETE: SHA256_MATCH=${completedResult.sha256Match}`);
          if (completedResult.sha256Match && !hasAutoDownloadedRef.current) {
            hasAutoDownloadedRef.current = true;
            triggerFileDownload(completedResult);
          }
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [result]);

  useEffect(() => {
    const session = new ReceiverSession(enteredPairCode);
    receiverRef.current = session;

    addLog('INIT CAMERA SCANNER ENGINE... POINT CAMERA AT SENDER QR CODE');

    if (videoRef.current && isCameraActive) {
      session.startScanning(
        videoRef.current,
        (meta) => {
          setMetadata(meta);
          setSessionIdHex(session.getSessionIdHex());
          addLog(`OPTICAL LOCK ESTABLISHED: 0x${session.getSessionIdHex()} FILE=${meta.fileName} TOTAL_BLOCKS=${meta.totalBlocks}`);
          playLockBeep();
        },
        (m, guidance) => {
          setMetrics(m);
          setGuidanceText(guidance);
        },
        (res) => {
          setIsCameraActive(false);
          setResult(res);
          addLog(`FILE DOWNLOAD COMPLETE: SHA256_MATCH=${res.sha256Match}`);
          playSuccessBeep();

          // UPI-Style Auto Download Trigger
          if (res.sha256Match && !hasAutoDownloadedRef.current) {
            hasAutoDownloadedRef.current = true;
            setTimeout(() => {
              triggerFileDownload(res);
            }, 300);
          }
        },
        (err) => {
          console.error(err);
        }
      );
    }

    return () => {
      session.stopScanning();
    };
  }, [enteredPairCode, isCameraActive]);

  const handleReopenCamera = () => {
    setIsCameraActive(true);
    addLog('CAMERA SCANNER ACTIVE (POINT CAMERA AT SENDER QR CODE)');
  };

  const addLog = (msg: string) => {
    const time = new Date().toISOString().substring(11, 19);
    setLogLines(prev => [`[${time}] ${msg}`, ...prev.slice(0, 4)]);
  };

  const triggerFileDownload = (res: ReceiverResult) => {
    const url = URL.createObjectURL(res.fileBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (result) triggerFileDownload(result);
  };

  const formatSeconds = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const pct = metrics?.progressPercentage ?? 0;
  const filledBlocks = Math.floor((pct / 100) * 30);
  const asciiProgressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(Math.max(0, 30 - filledBlocks))}] ${pct.toFixed(1)}%`;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 font-mono">
      {/* Terminal Header */}
      <div className="term-box-cyan rounded-lg overflow-hidden">
        <div className="term-header-bar text-cyan-400 border-cyan-500/30">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-bold">visualink-cli@receiver:~$ ./scan_optical</span>
          </div>
          <span className="text-cyan-500/60">UPI-STYLE INSTANT SCANNER</span>
        </div>

        <div className="p-4 space-y-3 text-cyan-300">
          <div className="text-xs flex justify-between items-center border-b border-cyan-500/20 pb-2">
            <span>&gt; RECEIVER_STATUS: <span className="font-bold text-cyan-100">{metadata ? 'SESSION_LOCKED' : 'SCANNING_OPTICAL_LINK'}</span></span>
            <span className="text-cyan-400 text-[11px]">[AIR-GAPPED DECODER]</span>
          </div>

          {/* ASCII Dashboard Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-1 text-center text-xs">
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">CAPT_FPS</div>
              <div className="metric-value text-cyan-300">{metrics?.captureFps ?? 30}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">DECD_FPS</div>
              <div className="metric-value text-cyan-300">{metrics?.decodeFps ?? 0}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">LOCK</div>
              <div className="metric-value text-[11px] pt-1 text-cyan-200">{sessionIdHex}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">DROPPED</div>
              <div className="metric-value text-amber-400">{metrics?.droppedFrames ?? 0}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">GOODPUT</div>
              <div className="metric-value text-emerald-400">{metrics?.goodputKBps ?? 0}K/s</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">ELAPSED</div>
              <div className="metric-value text-cyan-300">{formatSeconds(metrics?.elapsedSeconds ?? 0)}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">FRAMES</div>
              <div className="metric-value text-cyan-300">{metrics?.totalFrames ?? 0}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">NEW/DUP/RED</div>
              <div className="metric-value text-[10px] pt-1 text-cyan-200">
                {metrics?.newPackets ?? 0}/{metrics?.duplicatePackets ?? 0}/{metrics?.redundantPackets ?? 0}
              </div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">BLOCKS</div>
              <div className="metric-value text-[11px] pt-1 text-cyan-300">{metrics?.currentBlocks ?? 0}/{metrics?.totalBlocks ?? 0}</div>
            </div>
            <div className="metric-box border-cyan-500/30">
              <div className="metric-label text-cyan-400">PAYLOAD</div>
              <div className="metric-value text-cyan-300">{metrics?.payloadKBps ?? 0}K/s</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {!result ? (
        <div className="space-y-4">
          {isCameraActive ? (
            <div className="space-y-4">
              <CameraScanner
                videoRef={videoRef}
                guidanceText={guidanceText}
                isScanning={!result}
                isLocked={Boolean(metadata || (sessionIdHex && sessionIdHex !== '—'))}
              />

              {metadata && (
                <div className="term-box-cyan p-4 rounded-lg space-y-3 bg-[#020a06] border-2 border-emerald-500/50 shadow-2xl">
                  <div className="text-xs text-emerald-400 flex justify-between items-center border-b border-emerald-500/20 pb-2">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                      <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                      [ ✓ ] OPTICAL LOCK ESTABLISHED — DOWNLOADING FILE...
                    </span>
                    <span className="text-emerald-200 font-bold">{formatBytes(metadata.fileSize)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-cyan-300 bg-black/60 p-2.5 rounded border border-emerald-500/20">
                    <div>FILE_NAME: <span className="font-bold text-slate-100">{metadata.fileName}</span></div>
                    <div>TOTAL_BLOCKS: <span className="font-bold text-cyan-400">{metadata.totalBlocks}</span></div>
                    <div>ENCRYPTION: <span className="text-amber-400 font-bold">{metadata.encrypted ? 'AES-256-GCM ACTIVE' : 'DISABLED'}</span></div>
                    <div>STATUS: <span className="text-emerald-400 font-bold">RECEIVING PACKETS...</span></div>
                  </div>

                  {metadata.encrypted && (
                    <div className="bg-amber-950/40 p-2.5 rounded border border-amber-500/40 flex items-center justify-between">
                      <span className="text-amber-300 font-bold text-xs flex items-center gap-1.5">
                        🔒 ENTER PAIR CODE TO DECRYPT:
                      </span>
                      <input
                        type="text"
                        maxLength={6}
                        value={enteredPairCode}
                        onChange={async (e) => {
                          const code = e.target.value;
                          setEnteredPairCode(code);
                          if (receiverRef.current) {
                            receiverRef.current.setPairCode(code);
                            const res = await receiverRef.current.checkAndFinalize();
                            if (res) {
                              setIsCameraActive(false);
                              setResult(res);
                              playSuccessBeep();
                              if (res.sha256Match && !hasAutoDownloadedRef.current) {
                                hasAutoDownloadedRef.current = true;
                                triggerFileDownload(res);
                              }
                            }
                          }
                        }}
                        className="px-3 py-1 bg-black border border-amber-500 text-amber-300 text-center font-bold tracking-widest rounded w-28 text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-emerald-400 font-bold text-xs">
                      <span>DOWNLOADING PROGRESS:</span>
                      <span>{asciiProgressBar}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Camera Off / Inactive State Card */
            <div className="term-box-cyan p-5 rounded-lg space-y-4 bg-[#020a06] border-2 border-emerald-500/50 shadow-2xl text-center">
              <div className="text-xs text-amber-300 font-bold uppercase tracking-wider">[!] CAMERA SHUTDOWN (INACTIVE)</div>
              <p className="text-slate-400 text-xs">
                No QR code scanned within 10 seconds. Re-open camera scanner when sender screen is displaying QR code.
              </p>
              <button
                type="button"
                onClick={handleReopenCamera}
                className="px-5 py-2.5 bg-emerald-950 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-bold text-xs rounded cursor-pointer transition-colors"
              >
                📷 RE-OPEN CAMERA SCANNER
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Transfer Complete View (UPI Style Auto-Complete) */
        <div className="term-box-cyan p-6 rounded-lg text-center space-y-4 bg-[#010a06] border-2 border-emerald-500/60 shadow-2xl shadow-emerald-500/20">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <div className="text-xs font-mono text-emerald-400 tracking-widest uppercase mb-1">
              ✓ UPI-STYLE OPTICAL SCAN SUCCESSFUL
            </div>
            <h2 className="text-2xl font-bold text-emerald-300">[ ✓ ] FILE RECEIVED & VERIFIED!</h2>
            <p className="text-xs text-slate-300 mt-1">
              {result.fileName} ({formatBytes(result.fileSize)}) IN {formatSeconds(result.elapsedSeconds)} ({result.goodputKBps} KB/S)
            </p>
          </div>

          <div className="bg-black/90 p-3 rounded border border-emerald-500/40 text-xs text-left space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">FILE INTEGRITY VERIFICATION:</span>
              {result.sha256Match ? (
                <span className="text-emerald-400 font-bold">✓ SHA-256 MATCH</span>
              ) : (
                <span className="text-rose-400 font-bold">❌ HASH MISMATCH</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 break-all bg-slate-950 p-2 rounded">
              {result.calculatedHash}
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!result.sha256Match}
            className="w-full py-3 bg-emerald-950 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-bold text-sm rounded flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            [ v SAVE RECONSTRUCTED FILE ]
          </button>
        </div>
      )}

      {/* Terminal Log Console */}
      <div className="term-box-cyan p-3 rounded-lg text-[11px] text-cyan-400/90 space-y-1">
        <div className="text-cyan-500/60 font-bold pb-1 border-b border-cyan-500/20">--- RECEIVER TERMINAL LOG FEED ---</div>
        {logLines.map((line, idx) => (
          <div key={idx} className="truncate">&gt; {line}</div>
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-mono font-bold text-xs rounded shadow flex items-center gap-2 cursor-pointer"
        >
          <XCircle className="w-4 h-4" />
          [ EXIT RECEIVER ]
        </button>
      </div>
    </div>
  );
}

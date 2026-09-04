'use me';
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SenderSession } from '../../lib/transfer/sender';
import { TransferMetrics } from '../../lib/performance/metrics';
import { QRDisplay } from './QRDisplay';
import { Pause, Play, XCircle, Terminal, Radio } from 'lucide-react';

export interface SenderDashboardProps {
  file: File;
  pairCode?: string;
  onCancel: () => void;
}

export function SenderDashboard({ file, pairCode, onCancel }: SenderDashboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<SenderSession | null>(null);
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [statusText, setStatusText] = useState('Initializing Fountain Optical Transfer...');
  const [sessionIdHex, setSessionIdHex] = useState('—');
  const [logLines, setLogLines] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const session = new SenderSession({ file, pairCode });
    sessionRef.current = session;
    setSessionIdHex(session.getSessionIdHex());

    addLog(`INIT SESSION ID [0x${session.getSessionIdHex()}] FILE: ${file.name} (${formatBytes(file.size)})`);

    session.prepare((step, pct) => {
      if (isCancelled) return;
      setStatusText(`${step} (${pct}%)`);
    }).then((meta) => {
      if (isCancelled) return;
      setStatusText('Transmitting Optical Stream...');
      addLog(`METADATA COMPILED: TOTAL_BLOCKS=${meta.totalBlocks} BLOCK_SIZE=${meta.blockSize}B SHA256=${meta.sha256.substring(0, 8)}...`);
      addLog('OPTICAL ENGINE START: BROADCASTING ANIMATED QR STREAM AT 30 FPS...');

      if (canvasRef.current) {
        session.startTransmission(canvasRef.current, 30, (m) => {
          if (!isCancelled) setMetrics(m);
        });
      }
    });

    return () => {
      isCancelled = true;
      session.stop();
    };
  }, [file, pairCode]);

  const addLog = (msg: string) => {
    const time = new Date().toISOString().substring(11, 19);
    setLogLines(prev => [`[${time}] ${msg}`, ...prev.slice(0, 4)]);
  };

  const togglePause = () => {
    if (!sessionRef.current) return;
    if (isPaused) {
      sessionRef.current.resume();
      setIsPaused(false);
      addLog('SESSION RESUMED');
    } else {
      sessionRef.current.pause();
      setIsPaused(true);
      addLog('SESSION PAUSED');
    }
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

  const totalFrames = metrics?.totalFrames ?? 0;
  const totalBlocks = metrics?.totalBlocks ?? 1;
  const loopNumber = Math.floor(totalFrames / Math.max(1, totalBlocks)) + 1;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 font-mono text-emerald-400">
      {/* Terminal Window Header */}
      <div className="term-box rounded-lg overflow-hidden">
        <div className="term-header-bar">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-bold text-emerald-300">visualink-cli@transmitter:~$ ./send_optical</span>
          </div>
          <span className="text-emerald-500/60">PROTOCOL: VLQR/1</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-xs border-b border-emerald-500/30 pb-2 flex justify-between items-center">
            <span className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400 animate-ping" />
              <span>TRANSMITTER_STATUS: <span className="text-emerald-200 font-bold">{statusText}</span></span>
            </span>
            <span className="text-amber-400 text-[11px]">[AIR-GAPPED SENDER]</span>
          </div>

          {/* ASCII Dashboard Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-center text-xs">
            <div className="metric-box">
              <div className="metric-label">CAPT_FPS</div>
              <div className="metric-value">{metrics?.captureFps ?? 30}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">FILE_SIZE</div>
              <div className="metric-value text-xs pt-1.5">{formatBytes(file.size)}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">ELAPSED</div>
              <div className="metric-value">{formatSeconds(metrics?.elapsedSeconds ?? 0)}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">FRAMES_SENT</div>
              <div className="metric-value text-cyan-300">{totalFrames.toLocaleString()}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">SESSION_ID</div>
              <div className="metric-value text-cyan-400 text-[11px] pt-1.5">{sessionIdHex}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">FILE_BLOCKS</div>
              <div className="metric-value text-xs pt-1.5">{metrics?.totalBlocks ?? 0} BLOCKS</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">RATELESS_LOOP</div>
              <div className="metric-value text-emerald-300 text-xs pt-1.5">LOOP #{loopNumber}</div>
            </div>
            <div className="metric-box">
              <div className="metric-label">PAYLOAD_RATE</div>
              <div className="metric-value">{metrics?.payloadKBps ?? 0}K/s</div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Display Canvas Frame */}
      <QRDisplay canvasRef={canvasRef} sessionIdHex={sessionIdHex} />

      {/* Broadcasting Stream Status */}
      <div className="term-box p-4 rounded-lg space-y-3">
        <div className="text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold uppercase">BROADCASTING FOUNTAIN STREAM TO RECEIVER CAMERA</span>
          </div>
          <span className="text-slate-400 text-[11px] font-mono">
            POINT RECEIVER CAMERA AT SCREEN
          </span>
        </div>

        {/* Live Terminal Console Log Feed */}
        <div className="bg-[#010503] p-3 rounded border border-emerald-500/20 text-[11px] text-emerald-400/90 font-mono space-y-1 overflow-hidden">
          <div className="text-emerald-500/60 font-bold pb-1 border-b border-emerald-500/20">--- SENDER OPTICAL BROADCAST FEED ---</div>
          {logLines.map((line, idx) => (
            <div key={idx} className="truncate">
              <span className="text-emerald-600">&gt;</span> {line}
            </div>
          ))}
          {logLines.length === 0 && <div>&gt; Initializing optical transmitter...<span className="term-cursor" /></div>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-center pt-1">
        <button
          onClick={togglePause}
          className="px-6 py-2.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-mono font-bold text-xs rounded shadow flex items-center gap-2 cursor-pointer transition-colors"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? '[ RESUME TRANSMISSION ]' : '[ PAUSE TRANSMISSION ]'}
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-mono font-bold text-xs rounded shadow flex items-center gap-2 cursor-pointer transition-colors"
        >
          <XCircle className="w-4 h-4" />
          [ ABORT TRANSMISSION ]
        </button>
      </div>
    </div>
  );
}

'use me';
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FountainEncoder, FountainDecoder } from '../../lib/encoding/fountain';
import { VLPacket, PacketType, packetToQRString, stringToVLPacket } from '../../lib/protocol/packet';
import { getChunkInfo } from '../../lib/encoding/chunker';
import { computeSHA256 } from '../../lib/crypto/hashing';
import { Play, Terminal, ShieldCheck, Cpu } from 'lucide-react';

export function Simulator() {
  const [fileSizeMB, setFileSizeMB] = useState<number>(10);
  const [lossRate, setLossRate] = useState<number>(20);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const [sentCount, setSentCount] = useState<number>(0);
  const [receivedCount, setReceivedCount] = useState<number>(0);
  const [droppedCount, setDroppedCount] = useState<number>(0);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [goodputKBps, setGoodputKBps] = useState<number>(0);
  const [statusMsg, setStatusMsg] = useState<string>('Ready for simulation');
  const [sha256Result, setSha256Result] = useState<{ match: boolean; hash: string } | null>(null);

  const animRef = useRef<number | null>(null);

  const startSimulation = async () => {
    setIsRunning(true);
    setSentCount(0);
    setReceivedCount(0);
    setDroppedCount(0);
    setDuplicateCount(0);
    setProgressPct(0);
    setSha256Result(null);
    setStatusMsg('Compiling synthetic source file...');

    const bytes = fileSizeMB * 1024 * 1024;
    const { totalBlocks, blockSize } = getChunkInfo(bytes);

    const sourceBlocks: Uint8Array[] = [];
    for (let i = 0; i < totalBlocks; i++) {
      const block = new Uint8Array(blockSize);
      for (let b = 0; b < blockSize; b++) block[b] = (i * 31 + b * 11) & 0xFF;
      sourceBlocks.push(block);
    }

    const fullBuffer = new Uint8Array(bytes);
    let offset = 0;
    for (let i = 0; i < totalBlocks; i++) {
      const copyLen = Math.min(blockSize, bytes - offset);
      fullBuffer.set(sourceBlocks[i].subarray(0, copyLen), offset);
      offset += copyLen;
    }
    const originalHash = await computeSHA256(fullBuffer);

    const sessionId = 0x55AA1122;
    const encoder = new FountainEncoder(sourceBlocks, sessionId);
    const decoder = new FountainDecoder(totalBlocks, blockSize);

    setStatusMsg(`Simulating optical link [PACKET_LOSS=${lossRate}%]...`);

    let packetId = 0;
    let localSent = 0;
    let localReceived = 0;
    let localDropped = 0;
    const startTime = Date.now();

    const step = () => {
      if (decoder.isComplete()) {
        const reconstructed = decoder.getReconstructedFileBuffer(bytes);
        computeSHA256(reconstructed).then((reconHash) => {
          const match = reconHash.toLowerCase() === originalHash.toLowerCase();
          setSha256Result({ match, hash: reconHash });
          setStatusMsg(`[ ✓ ] RECONSTRUCTION COMPLETE IN ${((Date.now() - startTime) / 1000).toFixed(1)}S`);
          setIsRunning(false);
        });
        return;
      }

      for (let p = 0; p < 2; p++) {
        const packet = encoder.createPacket(packetId);
        localSent++;

        const qrString = packetToQRString(packet);
        const parsedPacket = stringToVLPacket(qrString);

        const isLost = Math.random() * 100 < lossRate;
        if (isLost || !parsedPacket) {
          localDropped++;
        } else {
          localReceived++;
          decoder.addPacket(parsedPacket);
        }
        packetId++;
      }

      const elapsed = Math.max(0.1, (Date.now() - startTime) / 1000);
      const goodput = (decoder.getDecodedCount() * blockSize / 1024) / elapsed;

      setSentCount(localSent);
      setReceivedCount(localReceived);
      setDroppedCount(localDropped);
      setDuplicateCount(decoder.duplicateCount);
      setProgressPct(Math.round(decoder.getProgressPercentage()));
      setGoodputKBps(Math.round(goodput * 10) / 10);

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const filledBlocks = Math.floor((progressPct / 100) * 30);
  const asciiProgressBar = `[${'█'.repeat(filledBlocks)}${'░'.repeat(Math.max(0, 30 - filledBlocks))}] ${progressPct}%`;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 font-mono">
      <div className="term-box rounded-lg overflow-hidden">
        <div className="term-header-bar">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">visualink-cli@simulator:~$ ./sim_optical</span>
          </div>
          <span>VLQR/1</span>
        </div>

        <div className="p-4 space-y-4 text-emerald-400">
          <div className="text-xs border-b border-emerald-500/20 pb-2">
            &gt; SIMULATOR_STATUS: <span className="text-emerald-200 font-bold">{statusMsg}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-slate-400 block">[!] FILE SIZE PRESET:</label>
              <div className="flex gap-2">
                {[10, 100, 500, 1000].map((mb) => (
                  <button
                    key={mb}
                    onClick={() => setFileSizeMB(mb)}
                    disabled={isRunning}
                    className={`flex-1 py-1.5 font-mono text-xs rounded border transition-colors ${
                      fileSizeMB === mb
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300 font-bold'
                        : 'bg-black border-emerald-500/30 text-slate-400 hover:border-emerald-500/60'
                    }`}
                  >
                    {mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">[!] PACKET LOSS RATE:</span>
                <span className="text-amber-400 font-bold">{lossRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={lossRate}
                onChange={(e) => setLossRate(Number(e.target.value))}
                disabled={isRunning}
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={startSimulation}
            disabled={isRunning}
            className="w-full py-3 bg-emerald-950 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-bold text-xs rounded shadow flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-emerald-300" />
            {isRunning ? '[ SIMULATION RUNNING... ]' : '[ EXECUTE OPTICAL SIMULATION ]'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
        <div className="metric-box">
          <div className="metric-label">SENT</div>
          <div className="metric-value">{sentCount}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">RECV</div>
          <div className="metric-value">{receivedCount}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">DROPPED</div>
          <div className="metric-value text-amber-400">{droppedCount}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">DUPLICATES</div>
          <div className="metric-value text-slate-400">{duplicateCount}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">GOODPUT</div>
          <div className="metric-value text-emerald-400">{goodputKBps} K/s</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">RECOVERY</div>
          <div className="metric-value text-cyan-300">
            {sentCount > 0 ? Math.round((receivedCount / sentCount) * 100) : 0}%
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="term-box p-4 rounded-lg space-y-2 text-xs text-emerald-400">
        <div className="flex justify-between">
          <span>PROGRESS:</span>
          <span>{asciiProgressBar}</span>
        </div>

        {sha256Result && (
          <div className="p-2 bg-black rounded border border-emerald-500/30 flex justify-between items-center text-xs">
            <span>SHA-256 INTEGRITY:</span>
            {sha256Result.match ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> ✓ SHA-256 MATCH
              </span>
            ) : (
              <span className="text-rose-400 font-bold">❌ HASH MISMATCH</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

'use me';
'use client';

import React, { useState, useRef } from 'react';
import { Upload, Lock, ShieldCheck, FileText, Play, Terminal, HardDrive, RefreshCw } from 'lucide-react';

export interface FileSelectorProps {
  onFileSelected: (file: File, pairCode?: string) => void;
}

export function FileSelector({ onFileSelected }: FileSelectorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [enableEncryption, setEnableEncryption] = useState<boolean>(false);
  const [pairCode, setPairCode] = useState<string>(() => generateRandomPairCode());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function generateRandomPairCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  const handleRegeneratePairCode = () => {
    setPairCode(generateRandomPairCode());
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const estimateTransferTime = (bytes: number): string => {
    const seconds = bytes / (50 * 1024);
    if (seconds < 60) return `${Math.ceil(seconds)} SECONDS`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    if (mins < 60) return `${mins}M ${secs}S`;
    const hours = Math.floor(mins / 60);
    return `${hours}H ${mins % 60}M`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setPairCode(generateRandomPairCode()); // New pair code on every file upload!
    }
  };

  const createSampleFile = (sizeMB: number) => {
    const bytes = sizeMB * 1024 * 1024;
    const buffer = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) buffer[i] = (i * 17) & 0xFF;
    const dummyBlob = new Blob([buffer], { type: 'video/mp4' });

    const mockFile = new File([dummyBlob], `sample-${sizeMB}MB-video.mp4`, {
      type: 'video/mp4',
    });
    Object.defineProperty(mockFile, 'size', { value: bytes });
    setSelectedFile(mockFile);
    setPairCode(generateRandomPairCode()); // New pair code on sample preset select!
  };

  const handleStart = () => {
    if (selectedFile) {
      onFileSelected(selectedFile, enableEncryption ? pairCode : undefined);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 font-mono">
      {/* Terminal Header */}
      <div className="term-box rounded-lg overflow-hidden">
        <div className="term-header-bar">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">visualink-cli@sender:~$ ./select_file</span>
          </div>
          <span>VLQR/1</span>
        </div>

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              setSelectedFile(e.dataTransfer.files[0]);
              setPairCode(generateRandomPairCode());
            }
          }}
          className="p-8 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 transition-colors cursor-pointer text-center bg-[#020704] m-4 rounded"
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-12 h-12 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-emerald-300 font-bold text-base mb-1">[ CLICK OR DROP FILE TO STREAM ]</div>
          <div className="text-xs text-emerald-500/70 mb-4">
            Supports multi-GB files without memory exhaustion via Blob streaming.
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
            <span className="text-[11px] text-emerald-500/70 w-full mb-1">
              [ SAMPLE FILE PRESETS ]
            </span>
            {[1, 10, 100, 500, 1000].map((mb) => (
              <button
                key={mb}
                type="button"
                onClick={() => createSampleFile(mb)}
                className="px-2 py-1 text-xs bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded font-mono transition-colors"
              >
                {mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected File Box */}
      {selectedFile && (
        <div className="term-box p-4 rounded-lg space-y-4">
          <div className="border-b border-emerald-500/30 pb-3 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 font-bold">FILE_SELECTED: {selectedFile.name}</span>
            </div>
            <span className="text-emerald-500">{formatBytes(selectedFile.size)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#020704] p-2.5 rounded border border-emerald-500/20">
              <span className="text-emerald-500/70 block">ESTIMATED TRANSFER TIME</span>
              <span className="text-emerald-300 font-bold">{estimateTransferTime(selectedFile.size)}</span>
            </div>
            <div className="bg-[#020704] p-2.5 rounded border border-emerald-500/20">
              <span className="text-emerald-500/70 block">STREAMING ENGINE</span>
              <span className="text-emerald-400 font-bold">Blob.slice() ACTIVE</span>
            </div>
          </div>

          {/* Encryption Option */}
          <div className="bg-[#020704] p-3 rounded border border-emerald-500/30 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span className="text-emerald-300 font-bold">[!] AES-256-GCM ENCRYPTION</span>
              </div>
              <input
                type="checkbox"
                checked={enableEncryption}
                onChange={(e) => setEnableEncryption(e.target.checked)}
                className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
              />
            </div>
            {enableEncryption && (
              <div className="flex items-center gap-3 pt-1 text-xs">
                <span className="text-amber-400 font-bold">NEW PAIR CODE:</span>
                <input
                  type="text"
                  maxLength={6}
                  value={pairCode}
                  onChange={(e) => setPairCode(e.target.value)}
                  className="px-2 py-0.5 bg-black border border-amber-500/50 text-amber-300 text-center font-bold tracking-widest rounded w-24"
                />
                <button
                  type="button"
                  onClick={handleRegeneratePairCode}
                  className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] rounded flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> REGEN
                </button>
              </div>
            )}
          </div>

          {/* Start Button */}
          <button
            onClick={handleStart}
            className="w-full py-3 bg-emerald-950 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-bold text-sm rounded shadow-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-emerald-300" />
            [ &gt; EXECUTE TRANSMISSION ]
          </button>
        </div>
      )}
    </div>
  );
}

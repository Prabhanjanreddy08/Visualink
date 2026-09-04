'use me';
'use client';

import React, { useEffect, useState } from 'react';
import { Camera, AlertCircle, Terminal } from 'lucide-react';

export interface CameraScannerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  guidanceText: string;
  isScanning: boolean;
  isLocked?: boolean;
  onCameraReady?: () => void;
}

export function CameraScanner({ videoRef, guidanceText, isScanning, isLocked, onCameraReady }: CameraScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function initCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 60, min: 30 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setHasPermission(true);
          if (onCameraReady) onCameraReady();
        }
      } catch (err: any) {
        setHasPermission(false);
        setErrorMsg('Camera permission denied or camera device unavailable.');
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [videoRef, onCameraReady]);

  return (
    <div className={`relative w-full max-w-md mx-auto aspect-square rounded-lg overflow-hidden bg-black border-2 transition-colors duration-300 ${isLocked ? 'border-emerald-500/80 shadow-emerald-500/20' : 'border-cyan-500/50'} shadow-2xl font-mono`}>
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Reticle Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4 z-10">
        {/* Top Status Badge */}
        <div className={`px-3 py-1 rounded text-xs flex items-center gap-2 transition-colors duration-300 border ${
          isLocked
            ? 'bg-emerald-950/95 border-emerald-500/80 text-emerald-300 shadow-lg shadow-emerald-500/20'
            : 'bg-black/90 border-cyan-500/50 text-cyan-300'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLocked ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400 animate-ping'}`} />
          <span className="font-bold">{guidanceText}</span>
        </div>

        {/* Reticle Box */}
        <div className={`relative w-60 h-60 border-2 rounded overflow-hidden transition-colors duration-300 ${
          isLocked ? 'border-emerald-400/90 shadow-inner' : 'border-cyan-400/80'
        }`}>
          {/* Animated Scanning Line */}
          {isScanning && (
            <div className={`w-full h-1 bg-gradient-to-r shadow-lg animate-scan-line ${
              isLocked
                ? 'from-transparent via-emerald-400 to-transparent shadow-emerald-400'
                : 'from-transparent via-cyan-400 to-transparent shadow-cyan-400'
            }`} />
          )}

          {/* Corner accents */}
          <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${isLocked ? 'border-emerald-400' : 'border-cyan-400'}`} />
          <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${isLocked ? 'border-emerald-400' : 'border-cyan-400'}`} />
          <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${isLocked ? 'border-emerald-400' : 'border-cyan-400'}`} />
          <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${isLocked ? 'border-emerald-400' : 'border-cyan-400'}`} />
        </div>

        <div className={`text-[10px] px-2.5 py-1 rounded border font-bold transition-colors ${
          isLocked
            ? 'text-emerald-300 bg-emerald-950/90 border-emerald-500/50'
            : 'text-cyan-400/80 bg-black/90 border-cyan-500/30'
        }`}>
          {isLocked ? '[✓] OPTICAL SCAN LOCKED — KEEP CAMERA STEADY' : 'ALIGN QR MATRIX INSIDE RETICLE'}
        </div>
      </div>

      {/* Permission / Error State */}
      {hasPermission === false && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center space-y-3 z-20 font-mono">
          <AlertCircle className="w-10 h-10 text-rose-500" />
          <div className="text-sm font-bold text-rose-400">[!] CAMERA PERMISSION REQUIRED</div>
          <p className="text-xs text-slate-400">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

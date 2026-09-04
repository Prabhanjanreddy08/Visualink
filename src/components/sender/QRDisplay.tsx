'use me';
'use client';

import React from 'react';
import { Sun } from 'lucide-react';

export interface QRDisplayProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  sessionIdHex: string;
  packetId?: number;
}

export const QRDisplay = React.memo(function QRDisplay({ canvasRef, sessionIdHex, packetId }: QRDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 font-mono">
      {/* Screen Brightness Prompt */}
      <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-950/60 border border-amber-500/40 px-3 py-1.5 rounded font-mono">
        <Sun className="w-4 h-4 text-amber-400" />
        <span>[!] SET SCREEN BRIGHTNESS TO MAXIMUM (100%)</span>
      </div>

      {/* Terminal Style Frame around Canvas with Fixed Outer Dimensions */}
      <div className="term-box p-3 rounded-lg border-2 border-emerald-500/50 bg-black text-center shadow-2xl shadow-emerald-500/10 w-[344px] flex-shrink-0">
        <div className="text-[10px] text-emerald-400/80 mb-2 border-b border-emerald-500/20 pb-1 flex justify-between items-center">
          <span>┌─ [OPTICAL MATRIX] FRAME #{packetId ?? 0}</span>
          <span>SESH: {sessionIdHex} ─┐</span>
        </div>

        <div className="w-[320px] h-[320px] mx-auto overflow-hidden bg-black flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className="w-[320px] h-[320px] rounded image-rendering-pixelated border border-emerald-500/30"
          />
        </div>

        <div className="text-[10px] text-emerald-400 mt-2 border-t border-emerald-500/20 pt-1 flex items-center justify-between">
          <span>└─ UNIQUE PACKET MATRIX </span>
          <span className="text-emerald-300 animate-pulse">● OPTICAL_LINK_ACTIVE</span>
        </div>
      </div>
    </div>
  );
});

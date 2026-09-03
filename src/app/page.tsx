'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Send, Camera, Cpu, ShieldCheck, Zap, Terminal } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020406] text-emerald-400 font-mono flex flex-col justify-between p-4 sm:p-8 relative selection:bg-emerald-500 selection:text-black">
      {/* Top Terminal Bar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-emerald-500/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-emerald-300">VISUALINK_CLI</span>
            <span className="text-[10px] text-emerald-500/80 block -mt-1 uppercase tracking-widest">Fountain Optical Transfer v1.0</span>
          </div>
        </div>

        <Link
          href="/simulator"
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-xs font-mono text-emerald-300 transition-colors"
        >
          <Cpu className="w-4 h-4" />
          <span>[ DEMO SIMULATOR ]</span>
        </Link>
      </header>

      {/* Main Terminal Window */}
      <main className="max-w-3xl w-full mx-auto my-auto py-8">
        <div className="term-box rounded-lg overflow-hidden space-y-6 p-6 sm:p-8">
          {/* Prompt Header */}
          <div className="text-xs text-emerald-500/80 space-y-1">
            <div>root@visualink:~$ ./initialize_optical_channel</div>
            <div className="text-emerald-400 font-bold text-sm">[ OK ] AIR-GAPPED OPTICAL CHANNEL READY</div>
          </div>

          {/* Title */}
          <div className="space-y-3 text-center sm:text-left">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-emerald-300">
              Transfer Files Through Light.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-mono">
              Send files directly from screen to camera. No Wi-Fi. No Bluetooth. No cables.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <Link
              href="/send"
              className="w-full sm:w-1/2 py-4 bg-emerald-950 hover:bg-emerald-900 border-2 border-emerald-500 text-emerald-300 font-bold text-base rounded text-center flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Send className="w-5 h-5 fill-emerald-300" />
              <span>[ SEND FILE ]</span>
            </Link>

            <Link
              href="/receive"
              className="w-full sm:w-1/2 py-4 bg-cyan-950 hover:bg-cyan-900 border-2 border-cyan-500 text-cyan-300 font-bold text-base rounded text-center flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="w-5 h-5 text-cyan-300" />
              <span>[ RECEIVE FILE ]</span>
            </Link>
          </div>

          {/* Privacy Reassurance */}
          <div className="flex items-center justify-center gap-2 text-xs text-emerald-400/90 pt-2 border-t border-emerald-500/20">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Your file never leaves your device.</span>
          </div>
        </div>
      </main>

      {/* Terminal Footer */}
      <footer className="max-w-4xl w-full mx-auto border-t border-emerald-500/20 pt-4 text-center text-xs text-emerald-500/60 font-mono">
        ┌────────────────────────────────────────────────────────┐<br />
        │ PROTOCOL: VLQR/1 | ERASURE: LUBY TRANSFORM | CRYPTO: AES-256 │<br />
        └────────────────────────────────────────────────────────┘
      </footer>
    </div>
  );
}

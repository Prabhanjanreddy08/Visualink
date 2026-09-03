'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Simulator } from '../../components/simulator/Simulator';
import { ArrowLeft, Cpu } from 'lucide-react';

export default function SimulatorPage() {
  return (
    <div className="min-h-screen bg-[#05070a] text-slate-100 p-4 sm:p-8 flex flex-col justify-between">
      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <Cpu className="w-4 h-4" /> PROTOCOL SIMULATOR
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto my-auto py-6">
        <Simulator />
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] font-mono text-slate-500 py-4">
        Simulates Packet Loss, Out-of-Order Frames & Luby Transform Fountain Reconstruction
      </footer>
    </div>
  );
}

'use me';
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileSelector } from '../../components/sender/FileSelector';
import { SenderDashboard } from '../../components/sender/SenderDashboard';
import { ArrowLeft, Zap } from 'lucide-react';

export default function SendPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pairCode, setPairCode] = useState<string | undefined>(undefined);

  const handleFileSelected = (file: File, code?: string) => {
    setSelectedFile(file);
    setPairCode(code);
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPairCode(undefined);
  };

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
          <Zap className="w-4 h-4" /> VISUALINK SENDER
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl w-full mx-auto my-auto py-6">
        {!selectedFile ? (
          <FileSelector onFileSelected={handleFileSelected} />
        ) : (
          <SenderDashboard
            file={selectedFile}
            pairCode={pairCode}
            onCancel={handleCancel}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] font-mono text-slate-500 py-4">
        Screen-to-Camera Optical File Transfer Protocol • No Server Required
      </footer>
    </div>
  );
}

/**
 * VISUALINK Off-Thread Web Worker for Parallel QR Code Decoding
 */

import jsQR from 'jsqr';

export interface WorkerDecodeRequest {
  id: number;
  imageData: ImageData;
  width: number;
  height: number;
}

export interface WorkerDecodeResponse {
  id: number;
  rawValue: string | null;
  location?: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
  };
}

self.onmessage = (event: MessageEvent<WorkerDecodeRequest>) => {
  const { id, imageData, width, height } = event.data;
  try {
    const code = jsQR(imageData.data, width, height, { inversionAttempts: "dontInvert" });
    if (code && code.data) {
      const response: WorkerDecodeResponse = {
        id,
        rawValue: code.data,
        location: code.location,
      };
      self.postMessage(response);
    } else {
      const response: WorkerDecodeResponse = { id, rawValue: null };
      self.postMessage(response);
    }
  } catch {
    self.postMessage({ id, rawValue: null });
  }
};

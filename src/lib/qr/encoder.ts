/**
 * VISUALINK Ultra-Fast Canvas QR Code Generator
 */

import QRCode from 'qrcode';
import { QRErrorCorrectionLevel } from '../performance/adaptiveRate';

export interface QROptions {
  ecLevel?: QRErrorCorrectionLevel;
  margin?: number;
  width?: number;
  darkColor?: string;
  lightColor?: string;
}

/**
 * Renders QR code string directly onto an HTMLCanvasElement with fixed dimensions to prevent layout blinking.
 */
export async function renderQRToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options?: QROptions
): Promise<void> {
  const ecLevel = options?.ecLevel || "L";
  const margin = options?.margin ?? 1;
  const targetWidth = options?.width ?? 450;
  const darkColor = options?.darkColor || "#000000";
  const lightColor = options?.lightColor || "#FFFFFF";

  await QRCode.toCanvas(canvas, text, {
    width: targetWidth,
    errorCorrectionLevel: ecLevel,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
}

/**
 * Renders QR code as Data URL string.
 */
export async function renderQRToDataURL(
  text: string,
  options?: QROptions
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: options?.width ?? 320,
    errorCorrectionLevel: options?.ecLevel || "M",
    margin: options?.margin ?? 2,
  });
}

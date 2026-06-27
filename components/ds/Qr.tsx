'use client';

import { QRCodeSVG } from 'qrcode.react';

/**
 * The Quarter — a real (scannable) QR code, ink-on-white with a quiet zone.
 * Used on the member redemption screen and the printable partner counter card.
 * Encodes a verification URL (thequarter.work/v/[token]). Black/ink + white only.
 */
export function Qr({ value, size = 196, className }: { value: string; size?: number; className?: string }) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="#FFFFFF"
      fgColor="#1E1A15"
      level="M"
      marginSize={2}
      className={className}
    />
  );
}

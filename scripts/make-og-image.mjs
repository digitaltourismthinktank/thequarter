/**
 * Regenerate public/og-image.png (1200x630) — the on-brand social share card.
 * Run from the repo root:  node scripts/make-og-image.mjs
 *
 * Pure Node + zlib (no image libraries): decodes public/brand/logo-wordmark-white.png,
 * composites it onto a designed ink/gold background, and re-encodes a fresh PNG. Re-run
 * after a brand/logo change; the file is wired site-wide via app/layout.tsx (openGraph.images),
 * so replacing it propagates everywhere with no code change.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const W = 1200, H = 630;

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** Decode an 8-bit RGBA, non-interlaced PNG. */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.toString('ascii', off + 4, off + 8); const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error(`unsupported png bd=${bitDepth} ct=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idat)); const px = new Uint8Array(w * h * 4); const bpp = 4; const stride = w * bpp; let p = 0;
  const pa = (a, b, c) => { const P = a + b - c, pa2 = Math.abs(P - a), pb = Math.abs(P - b), pc = Math.abs(P - c); return pa2 <= pb && pa2 <= pc ? a : pb <= pc ? b : c; };
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) {
      const v = raw[p++]; const i = y * stride + x;
      const a = x >= bpp ? px[i - bpp] : 0, b = y > 0 ? px[i - stride] : 0, c = (x >= bpp && y > 0) ? px[i - stride - bpp] : 0;
      let out = v;
      if (filter === 1) out = v + a; else if (filter === 2) out = v + b; else if (filter === 3) out = v + ((a + b) >> 1); else if (filter === 4) out = v + pa(a, b, c);
      px[i] = out & 0xff;
    }
  }
  return { w, h, px };
}

function encodePNG(w, h, px) {
  const stride = w * 4; const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; px.subarray(y * stride, y * stride + stride).forEach((v, i) => { raw[y * (stride + 1) + 1 + i] = v; }); }
  const comp = zlib.deflateSync(raw, { level: 9 });
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}

function resize(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * sh / dh - 0.5, y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1), fy = Math.max(0, Math.min(1, sy - y0));
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * sw / dw - 0.5, x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1), fx = Math.max(0, Math.min(1, sx - x0)); const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) { const p00 = src[(y0 * sw + x0) * 4 + c], p10 = src[(y0 * sw + x1) * 4 + c], p01 = src[(y1 * sw + x0) * 4 + c], p11 = src[(y1 * sw + x1) * 4 + c]; const top = p00 + (p10 - p00) * fx, bot = p01 + (p11 - p01) * fx; out[o + c] = Math.round(top + (bot - top) * fy); }
    }
  }
  return out;
}

const cv = new Uint8Array(W * H * 4);
const set = (x, y, r, g, b, a = 255) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4, ia = a / 255, na = 1 - ia; cv[i] = r * ia + cv[i] * na; cv[i + 1] = g * ia + cv[i + 1] * na; cv[i + 2] = b * ia + cv[i + 2] * na; cv[i + 3] = 255; };
const lerp = (a, b, t) => a + (b - a) * t;
const top = [0x2a, 0x25, 0x1e], mid = [0x1e, 0x1a, 0x15], bot = [0x14, 0x11, 0x0c];
const glowX = W * 0.80, glowY = H * 0.18, glowR = 620;
for (let y = 0; y < H; y++) {
  const t = y / H; const base = t < 0.5 ? top.map((v, i) => lerp(v, mid[i], t / 0.5)) : mid.map((v, i) => lerp(v, bot[i], (t - 0.5) / 0.5));
  for (let x = 0; x < W; x++) { const d = Math.hypot(x - glowX, y - glowY), g = Math.max(0, 1 - d / glowR) ** 2 * 0.30; const i = (y * W + x) * 4; cv[i] = Math.round(lerp(base[0], 0xd2, g)); cv[i + 1] = Math.round(lerp(base[1], 0xb5, g)); cv[i + 2] = Math.round(lerp(base[2], 0x76, g)); cv[i + 3] = 255; }
}
const gold = [0xbe, 0x9b, 0x53], m = 46, th = 2;
for (let x = m; x < W - m; x++) for (let t = 0; t < th; t++) { set(x, m + t, ...gold, 200); set(x, H - m - 1 - t, ...gold, 200); }
for (let y = m; y < H - m; y++) for (let t = 0; t < th; t++) { set(m + t, y, ...gold, 200); set(W - m - 1 - t, y, ...gold, 200); }
const logo = decodePNG(readFileSync(`${ROOT}/public/brand/logo-wordmark-white.png`));
const dw = 600, dh = Math.round(dw * logo.h / logo.w); const scaled = resize(logo.px, logo.w, logo.h, dw, dh);
const ox = Math.round((W - dw) / 2), oy = Math.round(H / 2 - dh / 2 - 26);
for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) { const s = (y * dw + x) * 4; set(ox + x, oy + y, scaled[s], scaled[s + 1], scaled[s + 2], scaled[s + 3]); }
const dvW = 132, dvY = oy + dh + 40, dvX = Math.round((W - dvW) / 2);
for (let x = 0; x < dvW; x++) for (let t = 0; t < 3; t++) set(dvX + x, dvY + t, ...gold, Math.round(255 * Math.sin((x / dvW) * Math.PI)));
writeFileSync(`${ROOT}/public/og-image.png`, encodePNG(W, H, cv));
console.log('wrote public/og-image.png', W, 'x', H);

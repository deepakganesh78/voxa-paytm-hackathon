// Draws the app icons (home-screen / install icons) as PNG files without any image library.
// Run: node scripts/make-icons.mjs   ->   public/icons/*.png
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const png = (size, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Colours of the app: deep blue to violet, a white V, and an amber dot like the X in the VOXA logo.
const BLUE = [47, 69, 217], VIOLET = [106, 92, 246], AMBER = [255, 190, 58];

function icon(size, { rounded, glyphScale }) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 3; // 3x3 samples per pixel for smooth edges
  const s = glyphScale;
  const strokeW = 0.12 * s;
  const left = [0.5 - 0.22 * s, 0.5 - 0.2 * s], tip = [0.5, 0.5 + 0.2 * s], right = [0.5 + 0.22 * s, 0.5 - 0.2 * s];
  const dot = [0.5, 0.5 + 0.31 * s], dotR = 0.05 * s;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size;
          if (rounded) {
            const rad = 0.22, cx = Math.min(Math.max(u, rad), 1 - rad), cy = Math.min(Math.max(v, rad), 1 - rad);
            if (Math.hypot(u - cx, v - cy) > rad) continue;
          }
          let c = mix(BLUE, VIOLET, (u + v) / 2);
          if (Math.min(distToSegment(u, v, ...left, ...tip), distToSegment(u, v, ...tip, ...right)) <= strokeW / 2) c = [255, 255, 255];
          else if (Math.hypot(u - dot[0], v - dot[1]) <= dotR) c = AMBER;
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (y * size + x) * 4;
      px[i] = a ? Math.round(r / a) : 0; px[i + 1] = a ? Math.round(g / a) : 0; px[i + 2] = a ? Math.round(b / a) : 0; px[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return png(size, px);
}

const files = {
  'icon-192.png': icon(192, { rounded: true, glyphScale: 1 }),
  'icon-512.png': icon(512, { rounded: true, glyphScale: 1 }),
  // full-bleed with the mark inside the safe zone, so Android can crop it to any shape
  'maskable-512.png': icon(512, { rounded: false, glyphScale: 0.8 }),
  'apple-touch-icon.png': icon(180, { rounded: false, glyphScale: 0.9 }),
  'favicon-32.png': icon(32, { rounded: true, glyphScale: 1.05 }),
};
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(out, name), data);
console.log('wrote', Object.keys(files).join(', '));

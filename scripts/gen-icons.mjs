// Draws a simple tower icon into PNGs with no dependencies.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function icon(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const s = maskable ? 0.62 : 0.8; // maskable keeps art inside the safe zone
  const set = (x, y, [r, g, b]) => { const i = (y * size + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size - 0.5) / s + 0.5, v = (y / size - 0.5) / s + 0.5; // art space 0..1
    let c = [0x1d, 0x2b, 0x22];
    if (!maskable) { // rounded square background
      const dx = Math.max(Math.abs(x / size - 0.5) - 0.32, 0), dy = Math.max(Math.abs(y / size - 0.5) - 0.32, 0);
      if (Math.hypot(dx, dy) > 0.18) { const i = (y * size + x) * 4; px[i + 3] = 0; continue; }
    }
    if (v > 0.78 && v < 0.88 && u > 0.12 && u < 0.88) c = [0x6f, 0xae, 0x4f];           // ground
    if (u > 0.3 && u < 0.7 && v > 0.4 && v <= 0.78) c = [0x8a, 0x8f, 0x99];             // body
    if (u > 0.24 && u < 0.76 && v > 0.3 && v <= 0.4) c = [0x8a, 0x8f, 0x99];            // top
    for (const bx of [0.24, 0.45, 0.66]) if (u > bx && u < bx + 0.1 && v > 0.2 && v <= 0.3) c = [0x8a, 0x8f, 0x99]; // battlements
    if (u > 0.43 && u < 0.57 && v > 0.58 && v <= 0.78) c = [0x3d, 0x6f, 0xb6];          // door
    if (Math.hypot(u - 0.5, v - 0.12) < 0.06) c = [0xf2, 0xc9, 0x4c];                   // gold
    set(x, y, c);
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = process.argv[2];
writeFileSync(`${out}/icon-192.png`, icon(192, false));
writeFileSync(`${out}/icon-512.png`, icon(512, false));
writeFileSync(`${out}/icon-512-maskable.png`, icon(512, true));

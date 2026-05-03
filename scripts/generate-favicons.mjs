import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("./_sharp.cjs");

const SRC = "public/avatar.png";
const ROOT = process.cwd();

const targets = [
  { out: "app/icon.png", size: 96 },
  { out: "app/apple-icon.png", size: 180 },
  { out: "public/web-app-manifest-192x192.png", size: 192 },
  { out: "public/web-app-manifest-512x512.png", size: 512 },
];

for (const { out, size } of targets) {
  await sharp(SRC).resize(size, size, { fit: "cover" }).png({ compressionLevel: 9 }).toFile(resolve(ROOT, out));
  console.log(`wrote ${out} (${size}x${size})`);
}

// Multi-size ICO with embedded PNGs (16/32/48)
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(
  icoSizes.map((s) => sharp(SRC).resize(s, s, { fit: "cover" }).png({ compressionLevel: 9 }).toBuffer())
);

function buildIco(buffers, sizes) {
  const count = buffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  buffers.forEach((png, i) => {
    const s = sizes[i];
    const e = i * 16;
    dir.writeUInt8(s >= 256 ? 0 : s, e + 0);
    dir.writeUInt8(s >= 256 ? 0 : s, e + 1);
    dir.writeUInt8(0, e + 2);
    dir.writeUInt8(0, e + 3);
    dir.writeUInt16LE(1, e + 4);
    dir.writeUInt16LE(32, e + 6);
    dir.writeUInt32LE(png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...buffers]);
}

const ico = buildIco(pngs, icoSizes);
await writeFile(resolve(ROOT, "public/favicon.ico"), ico);
console.log(`wrote public/favicon.ico (${icoSizes.join("/")})`);

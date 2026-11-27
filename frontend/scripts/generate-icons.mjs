import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/icons");
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function renderIcon(size, maskable = false) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [181, 101, 29, 255];
  const cream = [255, 253, 249, 255];
  const dark = [138, 75, 18, 255];
  const gold = [212, 154, 90, 255];
  const green = [46, 125, 50, 255];

  const pad = maskable ? size * 0.14 : 0;
  const scale = (size - pad * 2) / 512;

  const setPixel = (x, y, c) => {
    const idx = (y * size + x) * 4;
    buf[idx] = c[0];
    buf[idx + 1] = c[1];
    buf[idx + 2] = c[2];
    buf[idx + 3] = c[3];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const vx = (x - pad) / scale;
      const vy = (y - pad) / scale;

      let color = bg;
      if (vx >= 96 && vx <= 416 && vy >= 132 && vy <= 392) {
        color = cream;
        if (vx >= 148 && vx <= 364 && vy >= 216 && vy <= 244) color = bg;
        else if (vx >= 148 && vx <= 298 && vy >= 272 && vy <= 296) color = gold;
        else if (vx >= 148 && vx <= 328 && vy >= 322 && vy <= 346) color = green;
      }
      if (vx >= 96 && vx <= 416 && vy >= 108 && vy <= 168) {
        color = dark;
      }
      setPixel(x, y, color);
    }
  }
  return encodePng(size, size, buf);
}

fs.writeFileSync(path.join(outDir, "icon-192.png"), renderIcon(192, false));
fs.writeFileSync(path.join(outDir, "icon-512.png"), renderIcon(512, false));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), renderIcon(512, true));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), renderIcon(180, false));
console.log("Generated PWA icons in", outDir);

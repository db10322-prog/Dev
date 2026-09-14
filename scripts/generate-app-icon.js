// 앱/설치파일 아이콘 생성 (electron-builder는 최소 256x256 PNG 요구).
// scripts/generate-tray-icon.js와 동일한 순수 Node PNG 인코더, 해상도만 256x256로 확대.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 256;
const OUT_PATH = path.join(__dirname, "..", "app", "character", "app-icon.png");

const px = new Uint8Array(SIZE * SIZE * 4);
function setPixel(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}
function fillCircle(cx, cy, radius, r, g, b, a) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) setPixel(x, y, r, g, b, a);
    }
  }
}
function fillCircleRing(cx, cy, outerR, innerR, r, g, b, a) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= outerR * outerR && d2 >= innerR * innerR) setPixel(x, y, r, g, b, a);
    }
  }
}

const S = SIZE / 32; // tray-icon.js 좌표(32 기준)를 그대로 스케일업

fillCircle(16 * S, 16 * S, 15 * S, 255, 255, 255, 255);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const dx = x - 16 * S, dy = y - 16 * S;
    if (dx * dx + dy * dy <= (15 * S) * (15 * S) && y >= 9 * S && y <= 18 * S) setPixel(x, y, 20, 22, 27, 255);
  }
}
fillCircleRing(11 * S, 13 * S, 4 * S, 2 * S, 47, 208, 255, 255);
fillCircleRing(20 * S, 13 * S, 3 * S, 1.5 * S, 47, 208, 255, 255);

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(SIZE, 0);
ihdrData.writeUInt32BE(SIZE, 4);
ihdrData[8] = 8; ihdrData[9] = 6; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
const ihdr = chunk("IHDR", ihdrData);
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0;
  for (let x = 0; x < SIZE; x++) {
    const srcI = (y * SIZE + x) * 4;
    const dstI = rowStart + 1 + x * 4;
    raw[dstI] = px[srcI]; raw[dstI + 1] = px[srcI + 1]; raw[dstI + 2] = px[srcI + 2]; raw[dstI + 3] = px[srcI + 3];
  }
}
const idat = chunk("IDAT", zlib.deflateSync(raw));
const iend = chunk("IEND", Buffer.alloc(0));
const png = Buffer.concat([signature, ihdr, idat, iend]);
fs.writeFileSync(OUT_PATH, png);
console.log(`[generate-app-icon] 저장: ${OUT_PATH} (${png.length} bytes)`);

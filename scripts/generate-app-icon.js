// 앱/설치파일 아이콘 생성 (electron-builder는 최소 256x256 PNG 요구).
// 캐릭터 리디자인판 — app/character/index.html과 같은 디자인을 256px 해상도로 재현.
// 순수 Node PNG 인코더는 scripts/generate-tray-icon.js와 동일한 로직.
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
function fillEllipse(cx, cy, rx, ry, r, g, b, a) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(x, y, r, g, b, a);
    }
  }
}
function fillCircleRing(cx, cy, outerR, innerR, r, g, b, a) {
  const o2 = outerR * outerR, i2 = innerR * innerR;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= o2 && d2 >= i2) setPixel(x, y, r, g, b, a);
    }
  }
}
function fillThickLine(x0, y0, x1, y1, thickness, r, g, b, a) {
  const radius = thickness / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const lenSq = dx * dx + dy * dy || 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px_ = x0 + t * dx, py_ = y0 + t * dy;
      const ddx = x - px_, ddy = y - py_;
      if (ddx * ddx + ddy * ddy <= radius * radius) setPixel(x, y, r, g, b, a);
    }
  }
}

const S = SIZE / 200; // app/character/index.html의 200x210 좌표계를 그대로 스케일업(y축은 210 기준 비율 유지)
const INK = [32, 35, 43];
const CREAM = [246, 236, 217];
const ACCENT = [226, 87, 44];

// 발
fillEllipse(74 * S, 196 * S, 17 * S, 9 * S, ...INK, 255);
fillEllipse(124 * S, 198 * S, 14 * S, 8 * S, ...INK, 255);

// 몸통(잉크 테두리 + 크림 채움)
fillEllipse(100 * S, 112 * S, 76 * S, 74 * S, ...INK, 255);
fillEllipse(100 * S, 112 * S, 71.5 * S, 69.5 * S, ...CREAM, 255);

// 왼팔(대기), 오른팔(돋보기 든 활성 팔) + 손 + 돋보기
fillThickLine(34 * S, 120 * S, 21 * S, 143 * S, 10 * S, ...INK, 255);
fillThickLine(158 * S, 130 * S, 182 * S, 157 * S, 10 * S, ...INK, 255);
fillEllipse(183 * S, 161 * S, 8 * S, 8 * S, ...INK, 255);
fillThickLine(191 * S, 144 * S, 200 * S, 156 * S, 6 * S, ...ACCENT, 255);
fillCircleRing(180 * S, 130 * S, 15 * S, 10 * S, ...ACCENT, 255);
fillEllipse(180 * S, 130 * S, 10 * S, 10 * S, ...CREAM, 255);

// 눈(비대칭), 블러시, 입
fillEllipse(76 * S, 101 * S, 7 * S, 7 * S, ...INK, 255);
fillEllipse(130 * S, 103 * S, 4.5 * S, 4.5 * S, ...INK, 255);
fillEllipse(62 * S, 121 * S, 9 * S, 9 * S, ...ACCENT, 90);
fillEllipse(132 * S, 123 * S, 9 * S, 9 * S, ...ACCENT, 90);
fillThickLine(84 * S, 131 * S, 118 * S, 133 * S, 5 * S, ...INK, 255);

// 안테나(기울어짐) + 포인트 컬러 끝
fillThickLine(96 * S, 42 * S, 124 * S, 20 * S, 6 * S, ...INK, 255);
fillEllipse(126 * S, 19 * S, 8 * S, 8 * S, ...ACCENT, 255);

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

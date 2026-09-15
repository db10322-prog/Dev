// 트레이 아이콘을 외부 이미지 도구 없이 순수 Node로 생성 (zlib만 사용, PNG 스펙 직접 작성).
// 캐릭터 리디자인판(app/character/index.html 참고) — 종이 크림색 블롭 + 비대칭 눈(왼쪽 크게,
// 오른쪽 작게) + 블러시 + 한쪽으로 기운 안테나 하나. 32x32라 팔/돋보기는 생략(너무 작아 뭉개짐).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 32;
const OUT_PATH = path.join(__dirname, "..", "app", "character", "tray-icon.png");

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

// 팔레트: 종이 크림 / 잉크 / 도장 빨강 — 흰색+시안 로봇 팔레트에서 완전히 벗어남.
const INK = [32, 35, 43];
const CREAM = [246, 236, 217];
const ACCENT = [226, 87, 44];

// 몸통(잉크색 큰 타원 → 크림색 작은 타원으로 "테두리" 효과)
fillEllipse(16, 18, 13.5, 13, ...INK, 255);
fillEllipse(16, 18, 11, 10.5, ...CREAM, 255);

// 안테나(오른쪽으로 살짝 기움) + 포인트 컬러 끝
fillThickLine(15, 7, 19, 3, 2.6, ...INK, 255);
fillEllipse(19.5, 2.5, 1.6, 1.6, ...ACCENT, 255);

// 눈(비대칭 — 왼쪽이 더 큼)
fillEllipse(12, 16, 1.7, 1.7, ...INK, 255);
fillEllipse(20, 16.5, 1.1, 1.1, ...INK, 255);
// 블러시
fillEllipse(9.5, 19.5, 1.4, 1.4, ...ACCENT, 90);
fillEllipse(22, 20, 1.4, 1.4, ...ACCENT, 90);

// ---- PNG 인코딩 ----
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
ihdrData[8] = 8; // bit depth
ihdrData[9] = 6; // color type RGBA
ihdrData[10] = 0;
ihdrData[11] = 0;
ihdrData[12] = 0;
const ihdr = chunk("IHDR", ihdrData);

// 스캔라인: 각 줄 앞에 필터 바이트(0) + RGBA*width
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (1 + SIZE * 4);
  raw[rowStart] = 0;
  for (let x = 0; x < SIZE; x++) {
    const srcI = (y * SIZE + x) * 4;
    const dstI = rowStart + 1 + x * 4;
    raw[dstI] = px[srcI];
    raw[dstI + 1] = px[srcI + 1];
    raw[dstI + 2] = px[srcI + 2];
    raw[dstI + 3] = px[srcI + 3];
  }
}
const idat = chunk("IDAT", zlib.deflateSync(raw));
const iend = chunk("IEND", Buffer.alloc(0));

const png = Buffer.concat([signature, ihdr, idat, iend]);
fs.writeFileSync(OUT_PATH, png);
console.log(`[generate-tray-icon] 저장: ${OUT_PATH} (${png.length} bytes)`);

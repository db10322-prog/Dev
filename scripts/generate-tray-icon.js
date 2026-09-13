// 트레이 아이콘을 외부 이미지 도구 없이 순수 Node로 생성 (zlib만 사용, PNG 스펙 직접 작성).
// 캐릭터(app/character/index.html)의 검정 바이저 + 파란 링 눈을 32x32 축소판으로 재현.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 32;
const OUT_PATH = path.join(__dirname, "..", "app", "character", "tray-icon.png");

// RGBA 픽셀 버퍼 (투명 배경)
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

// 흰색 머리 바깥 원
fillCircle(16, 16, 15, 255, 255, 255, 255);
// 검정 바이저(눈 부분 가로 밴드)
for (let y = 9; y <= 18; y++) {
  for (let x = 4; x <= 27; x++) {
    const dx = x - 16, dy = y - 16;
    if (dx * dx + dy * dy <= 15 * 15) setPixel(x, y, 20, 22, 27, 255);
  }
}
// 파란 링 눈 2개 (참고 이미지의 시안 블루 링 눈)
fillCircleRing(11, 13, 4, 2, 47, 208, 255, 255);
fillCircleRing(20, 13, 3, 1.5, 47, 208, 255, 255);

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

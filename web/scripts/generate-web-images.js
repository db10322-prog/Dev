// 랜딩 페이지용 favicon / apple-touch-icon / OG(카카오톡·문자·SNS 링크 미리보기) 이미지를
// 외부 이미지 도구 없이 순수 Node로 생성. app/character/index.html과 같은 캐릭터 디자인을
// 재사용해 데스크톱 앱 아이콘·트레이 아이콘·웹 favicon이 전부 같은 브랜드 마스코트를 쓰도록 맞춤.
// (흰 로봇 머리 + 시안 링눈 조합은 AI 생성 이미지 클리셰라 리디자인함 — 종이 크림색 블롭 +
// 비대칭 눈 + 기울어진 안테나 + 돋보기를 든 팔 하나로 교체.)
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "public");
fs.mkdirSync(OUT_DIR, { recursive: true });

const INK = [32, 35, 43];
const CREAM = [246, 236, 217];
const ACCENT = [226, 87, 44];

// ---- 공용 픽셀 버퍼 유틸 ----
function makeCanvas(w, h) {
  return new Uint8Array(w * h * 4); // RGBA, 기본 투명
}
function setPixel(px, w, h, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
}
function fillRect(px, w, h, r, g, b, a) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) setPixel(px, w, h, x, y, r, g, b, a);
}
function fillEllipse(px, w, h, cx, cy, rx, ry, r, g, b, a) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPixel(px, w, h, x, y, r, g, b, a);
    }
  }
}
function fillCircleRing(px, w, h, cx, cy, outerR, innerR, r, g, b, a) {
  const o2 = outerR * outerR, i2 = innerR * innerR;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= o2 && d2 >= i2) setPixel(px, w, h, x, y, r, g, b, a);
    }
  }
}
function fillThickLine(px, w, h, x0, y0, x1, y1, thickness, r, g, b, a) {
  const radius = thickness / 2;
  const dx = x1 - x0, dy = y1 - y0;
  const lenSq = dx * dx + dy * dy || 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let t = ((x - x0) * dx + (y - y0) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px_ = x0 + t * dx, py_ = y0 + t * dy;
      const ddx = x - px_, ddy = y - py_;
      if (ddx * ddx + ddy * ddy <= radius * radius) setPixel(px, w, h, x, y, r, g, b, a);
    }
  }
}
// 이미 불투명한 배경 위에 반투명 색을 "올리려면" 실제 알파 합성이 필요하다(버퍼 값을 그대로
// 덮어쓰는 setPixel은 a<255를 줘도 불투명하게 나온다).
function blendCircleRing(px, w, h, cx, cy, outerR, innerR, r, g, b, a) {
  const o2 = outerR * outerR, i2 = innerR * innerR;
  const alpha = a / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= o2 && d2 >= i2) {
        const i = (y * w + x) * 4;
        px[i] = Math.round(r * alpha + px[i] * (1 - alpha));
        px[i + 1] = Math.round(g * alpha + px[i + 1] * (1 - alpha));
        px[i + 2] = Math.round(b * alpha + px[i + 2] * (1 - alpha));
        px[i + 3] = 255;
      }
    }
  }
}

// 캐릭터 마크(app/character/index.html의 200x210 좌표계, 블롭 중심은 로컬 좌표 대략 (100,105))를
// 캔버스 위 (centerX, centerY) 픽셀 위치에 중심을 맞춰 S배로 그린다. full=true면 팔/돋보기까지
// 포함(큰 캔버스용), false면 블롭+눈+블러시+안테나만(파비콘처럼 작은 캔버스용 — 디테일이 뭉개지는
// 걸 방지).
function drawCharacter(px, w, h, centerX, centerY, S, { full = true } = {}) {
  const X = (v) => centerX + (v - 100) * S;
  const Y = (v) => centerY + (v - 105) * S;

  if (full) {
    fillEllipse(px, w, h, X(74), Y(196), 17 * S, 9 * S, ...INK, 255);
    fillEllipse(px, w, h, X(124), Y(198), 14 * S, 8 * S, ...INK, 255);
  }

  fillEllipse(px, w, h, X(100), Y(112), 76 * S, 74 * S, ...INK, 255);
  fillEllipse(px, w, h, X(100), Y(112), 71.5 * S, 69.5 * S, ...CREAM, 255);

  if (full) {
    fillThickLine(px, w, h, X(34), Y(120), X(21), Y(143), 10 * S, ...INK, 255);
    fillThickLine(px, w, h, X(158), Y(130), X(182), Y(157), 10 * S, ...INK, 255);
    fillEllipse(px, w, h, X(183), Y(161), 8 * S, 8 * S, ...INK, 255);
    fillThickLine(px, w, h, X(191), Y(144), X(200), Y(156), 6 * S, ...ACCENT, 255);
    fillCircleRing(px, w, h, X(180), Y(130), 15 * S, 10 * S, ...ACCENT, 255);
    fillEllipse(px, w, h, X(180), Y(130), 10 * S, 10 * S, ...CREAM, 255);
  }

  fillEllipse(px, w, h, X(76), Y(101), 7 * S, 7 * S, ...INK, 255);
  fillEllipse(px, w, h, X(130), Y(103), 4.5 * S, 4.5 * S, ...INK, 255);
  fillEllipse(px, w, h, X(62), Y(121), 9 * S, 9 * S, ...ACCENT, 90);
  fillEllipse(px, w, h, X(132), Y(123), 9 * S, 9 * S, ...ACCENT, 90);
  if (full) fillThickLine(px, w, h, X(84), Y(131), X(118), Y(133), 5 * S, ...INK, 255);

  fillThickLine(px, w, h, X(96), Y(42), X(124), Y(20), 6 * S, ...INK, 255);
  fillEllipse(px, w, h, X(126), Y(19), 8 * S, 8 * S, ...ACCENT, 255);
}

// ---- PNG 인코더 (scripts/generate-app-icon.js와 동일 로직) ----
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
function encodePng(px, w, h) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; ihdrData[9] = 6; ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;
  const ihdr = chunk("IHDR", ihdrData);
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < w; x++) {
      const srcI = (y * w + x) * 4;
      const dstI = rowStart + 1 + x * 4;
      raw[dstI] = px[srcI]; raw[dstI + 1] = px[srcI + 1]; raw[dstI + 2] = px[srcI + 2]; raw[dstI + 3] = px[srcI + 3];
    }
  }
  const idat = chunk("IDAT", zlib.deflateSync(raw));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}
function writePng(filename, px, w, h) {
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, encodePng(px, w, h));
  console.log(`[generate-web-images] 저장: ${outPath}`);
}

// ---- 1) favicon.png — 투명 배경, 브라우저 탭용(작아서 팔/돋보기는 생략) ----
{
  const SIZE = 64;
  const px = makeCanvas(SIZE, SIZE);
  drawCharacter(px, SIZE, SIZE, 32, 34, 0.34, { full: false });
  writePng("favicon.png", px, SIZE, SIZE);
}

// ---- 2) apple-touch-icon.png — iOS 홈 화면 추가용, 불투명 배경 필요 ----
{
  const SIZE = 180;
  const px = makeCanvas(SIZE, SIZE);
  fillRect(px, SIZE, SIZE, ...CREAM, 255);
  drawCharacter(px, SIZE, SIZE, 90, 95, 0.82, { full: true });
  writePng("apple-touch-icon.png", px, SIZE, SIZE);
}

// ---- 3) og-image.png — 카카오톡/문자/SNS 링크 공유 미리보기 (1200x630 표준 비율) ----
{
  const W = 1200, H = 630;
  const px = makeCanvas(W, H);
  fillRect(px, W, H, ...CREAM, 255);
  // 은은한 장식 — 예전엔 브랜드 블루/시안 링이었는데 캐릭터 팔레트(크림/잉크/도장 빨강)에 맞춰
  // 아주 옅은 잉크색 원 테두리 몇 개로 교체(텍스트 없이도 단조롭지 않도록).
  blendCircleRing(px, W, H, W - 150, 130, 270, 250, ...INK, 18);
  blendCircleRing(px, W, H, W - 150, 130, 200, 184, ...INK, 28);
  blendCircleRing(px, W, H, 110, H - 70, 230, 212, ...ACCENT, 20);
  drawCharacter(px, W, H, 600, 315, 1.6, { full: true });
  writePng("og-image.png", px, W, H);
}

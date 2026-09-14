// 랜딩 페이지용 favicon / apple-touch-icon / OG(카카오톡·문자·SNS 링크 미리보기) 이미지를
// 외부 이미지 도구 없이 순수 Node로 생성. scripts/generate-app-icon.js·generate-tray-icon.js와
// 동일한 순수 PNG 인코더 + 캐릭터 마크(흰 원 + 검정 바이저 + 시안 블루 링눈)를 재사용해
// 데스크톱 앱 아이콘·트레이 아이콘·웹 favicon이 같은 브랜드 마크를 쓰도록 맞춤.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "public");
fs.mkdirSync(OUT_DIR, { recursive: true });

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
function fillCircle(px, w, h, cx, cy, radius, r, g, b, a) {
  const r2 = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(px, w, h, x, y, r, g, b, a);
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
// fillCircleRing은 setPixel로 그대로 덮어써서 a<255를 줘도 실제로는 불투명하게 나온다
// (레이어 합성이 아니라 버퍼 값 자체를 대체하기 때문) — og-image처럼 이미 불투명 배경 위에
// 반투명 장식을 "올리려면" 기존 픽셀과 직접 알파 합성해야 한다.
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

// 캐릭터 로고 마크(app-icon.png/tray-icon.png와 동일 비율의 32x32 좌표계)를
// 임의 캔버스 위 (originX, originY) 기준, scale 배로 그린다.
function drawLogoMark(px, w, h, originX, originY, scale) {
  const S = scale / 32;
  const cx = originX + 16 * scale, cy = originY + 16 * scale;
  fillCircle(px, w, h, cx, cy, 15 * scale, 255, 255, 255, 255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= (15 * scale) * (15 * scale) && y >= originY + 9 * scale && y <= originY + 18 * scale) {
        setPixel(px, w, h, x, y, 20, 22, 27, 255);
      }
    }
  }
  fillCircleRing(px, w, h, originX + 11 * scale, originY + 13 * scale, 4 * scale, 2 * scale, 47, 208, 255, 255);
  fillCircleRing(px, w, h, originX + 20 * scale, originY + 13 * scale, 3 * scale, 1.5 * scale, 47, 208, 255, 255);
}

// ---- PNG 인코더 (generate-app-icon.js와 동일 로직) ----
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

// ---- 1) favicon.png — 투명 배경, 브라우저 탭용 ----
{
  const SIZE = 64;
  const px = makeCanvas(SIZE, SIZE);
  drawLogoMark(px, SIZE, SIZE, 0, 0, SIZE / 32);
  writePng("favicon.png", px, SIZE, SIZE);
}

// ---- 2) apple-touch-icon.png — iOS 홈 화면 추가용, 불투명 배경 필요 ----
{
  const SIZE = 180;
  const px = makeCanvas(SIZE, SIZE);
  fillRect(px, SIZE, SIZE, 18, 22, 29, 255); // --ink 배경(투명 아이콘은 iOS에서 검게 채워지므로 직접 채움)
  drawLogoMark(px, SIZE, SIZE, SIZE * 0.09, SIZE * 0.09, (SIZE * 0.82) / 32);
  writePng("apple-touch-icon.png", px, SIZE, SIZE);
}

// ---- 3) og-image.png — 카카오톡/문자/SNS 링크 공유 미리보기 (1200x630 표준 비율) ----
{
  const W = 1200, H = 630;
  const px = makeCanvas(W, H);
  fillRect(px, W, H, 18, 22, 29, 255); // --ink
  // 은은한 액센트 링 장식(텍스트 없이도 단조롭지 않도록) — 1200x630 캔버스 기준이라
  // 두께를 넉넉히 줘야 눈에 보인다(캐릭터 눈동자 링처럼 얇으면 이 크기에선 안 보임).
  blendCircleRing(px, W, H, W - 150, 130, 270, 252, 49, 130, 246, 45);
  blendCircleRing(px, W, H, W - 150, 130, 200, 186, 49, 130, 246, 70);
  blendCircleRing(px, W, H, 110, H - 70, 230, 214, 47, 208, 255, 40);
  // 중앙보다 살짝 왼쪽에 큼직한 로고 마크
  const scale = 9;
  drawLogoMark(px, W, H, W / 2 - 16 * scale, H / 2 - 16 * scale, scale);
  writePng("og-image.png", px, W, H);
}

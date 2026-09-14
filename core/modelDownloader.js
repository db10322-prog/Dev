// scripts/download-model.js 의 다운로드 로직을 재사용 가능한 모듈로 뺀 것.
// 배포용 실행파일에는 2GB 모델을 안 담았으므로(용량 문제), 앱 첫 실행 시 이 모듈로
// 사용자가 터미널을 몰라도 되는 진행률 화면(app/renderer/setup.html)을 통해 받는다.
const fs = require("fs");
const path = require("path");
const https = require("https");

const MODEL_FILE = "qwen2.5-1.5b-instruct-q8_0.gguf";
const MIRRORS = [
  `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/${MODEL_FILE}`,
  `https://modelscope.cn/models/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/master/${MODEL_FILE}`,
];
const MODELS_DIR = path.join(__dirname, "..", "models");
const MODEL_PATH = path.join(MODELS_DIR, MODEL_FILE);
const STALL_TIMEOUT_MS = 20000;

function isModelReady() {
  return fs.existsSync(MODEL_PATH);
}

function downloadOnce(url, outPath, onProgress, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("리다이렉트가 너무 많음"));
    const req = https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(downloadOnce(res.headers.location, outPath, onProgress, redirectCount + 1));
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));

        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = fs.createWriteStream(outPath);

        let stallTimer;
        const resetStallTimer = () => {
          clearTimeout(stallTimer);
          stallTimer = setTimeout(() => req.destroy(new Error(`${STALL_TIMEOUT_MS / 1000}초간 응답 없음`)), STALL_TIMEOUT_MS);
        };
        resetStallTimer();

        res.on("data", (chunk) => {
          resetStallTimer();
          downloaded += chunk.length;
          onProgress?.({ downloaded, total });
        });
        res.pipe(file);
        file.on("finish", () => {
          clearTimeout(stallTimer);
          file.close(() => resolve());
        });
        file.on("error", (err) => {
          clearTimeout(stallTimer);
          reject(err);
        });
      })
      .on("error", (err) => {
        fs.rm(outPath, { force: true }, () => {});
        reject(err);
      });
  });
}

/** @param {(p: {downloaded:number, total:number, mirrorIndex:number}) => void} onProgress */
async function ensureModelDownloaded(onProgress) {
  if (isModelReady()) return;
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

  let lastErr;
  for (let i = 0; i < MIRRORS.length; i++) {
    try {
      await downloadOnce(MIRRORS[i], MODEL_PATH, (p) => onProgress?.({ ...p, mirrorIndex: i }));
      return;
    } catch (err) {
      lastErr = err;
      fs.rm(MODEL_PATH, { force: true }, () => {});
    }
  }
  throw lastErr || new Error("모든 다운로드 경로 실패");
}

module.exports = { ensureModelDownloaded, isModelReady, MODEL_PATH };

// 로컬 본체 AI용 모델 다운로드. 계정 생성/ToS 동의가 필요 없는 경로만 사용:
// Hugging Face 공개(비게이팅) 저장소에서 익명 HTTPS GET으로 받는다 — 로그인/서명 불필요.
// 모델 자체도 Apache-2.0(Qwen2.5) — 별도 사용자 연령 제한이 없는 라이선스.
const fs = require("fs");
const path = require("path");
const https = require("https");

// q8_0(비-K-quant, 단순 8비트 포맷)을 씀 — q4_k_m 등 K-quant는 일부 CPU에서 llama.cpp의
// "CPU_REPACK" 가중치 재배치 최적화가 버퍼 할당에 실패하는 알려진 문제가 있어(이 프로젝트
// 테스트 중 실제로 재현됨), 그 최적화 경로를 안 타는 q8_0으로 고정.
// 1.5B(3B보다 작음)를 기본값으로 씀 — CPU 전용 추론에서 20초 예산에 맞추기 훨씬 유리하고,
// 다운로드도 더 빠름. 필요하면 아래 MODEL_FILE을 3B로 바꿔도 됨(속도/품질 트레이드오프).
const MODEL_FILE = "qwen2.5-1.5b-instruct-q8_0.gguf";
const MIRRORS = [
  `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/${MODEL_FILE}`,
  // Hugging Face 익명 다운로드가 대역폭 제한에 걸릴 때를 대비한 대체 경로.
  // ModelScope는 Qwen(알리바바)의 자체 호스팅이라 별도 계정/로그인 없이 접근 가능.
  `https://modelscope.cn/models/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/master/${MODEL_FILE}`,
];
const MODELS_DIR = path.join(__dirname, "..", "models");
const OUT_PATH = path.join(MODELS_DIR, MODEL_FILE);

const STALL_TIMEOUT_MS = 20000; // 20초간 데이터가 안 오면 이 미러는 포기하고 다음 미러 시도

function download(url, outPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("리다이렉트가 너무 많음"));
    const req = https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(res.headers.location, outPath, redirectCount + 1));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        let lastPct = -1;
        const file = fs.createWriteStream(outPath);

        let stallTimer;
        const resetStallTimer = () => {
          clearTimeout(stallTimer);
          stallTimer = setTimeout(() => {
            req.destroy(new Error(`${STALL_TIMEOUT_MS / 1000}초간 응답 없음 — 다른 미러로 전환`));
          }, STALL_TIMEOUT_MS);
        };
        resetStallTimer();

        res.on("data", (chunk) => {
          resetStallTimer();
          downloaded += chunk.length;
          if (total) {
            const pct = Math.floor((downloaded / total) * 100);
            if (pct !== lastPct && pct % 5 === 0) {
              process.stdout.write(`\r[download-model] ${pct}% (${(downloaded / 1e6).toFixed(0)}MB / ${(total / 1e6).toFixed(0)}MB)`);
              lastPct = pct;
            }
          }
        });
        res.pipe(file);
        file.on("finish", () => {
          clearTimeout(stallTimer);
          file.close(() => {
            console.log("\n[download-model] 완료");
            resolve();
          });
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

(async () => {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
  if (fs.existsSync(OUT_PATH)) {
    console.log(`[download-model] 이미 존재함: ${OUT_PATH} — 다시 받으려면 파일을 지우고 재실행하세요.`);
    return;
  }
  let lastErr;
  for (const url of MIRRORS) {
    console.log(`[download-model] 다운로드 시도 (계정/로그인 불필요, 공개 파일 익명 다운로드): ${url}`);
    try {
      await download(url, OUT_PATH);
      console.log(`[download-model] 저장 위치: ${OUT_PATH}`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`\n[download-model] 이 미러 실패(${err.message}) — 다음 미러 시도`);
    }
  }
  throw lastErr || new Error("모든 미러 실패");
})().catch((err) => {
  console.error("[download-model] 실패:", err.message);
  process.exitCode = 1;
});

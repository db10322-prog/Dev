// 로컬 본체 AI용 모델 다운로드 CLI. 계정/로그인 불필요, 공개 파일 익명 다운로드.
// (Electron 앱의 첫 실행 자동 다운로드는 core/modelDownloader.js + app/renderer/setup.html 사용 — 이 스크립트는 CLI 개발용.)
const { ensureModelDownloaded, isModelReady, MODEL_PATH } = require("../core/modelDownloader");

(async () => {
  if (isModelReady()) {
    console.log(`[download-model] 이미 존재함: ${MODEL_PATH} — 다시 받으려면 파일을 지우고 재실행하세요.`);
    return;
  }
  console.log("[download-model] 다운로드 시작 (계정/로그인 불필요, 약 1.9GB)...");
  let lastPct = -1;
  await ensureModelDownloaded(({ downloaded, total, mirrorIndex }) => {
    if (!total) return;
    const pct = Math.floor((downloaded / total) * 100);
    if (pct !== lastPct && pct % 5 === 0) {
      process.stdout.write(`\r[download-model] 미러#${mirrorIndex + 1} ${pct}% (${(downloaded / 1e6).toFixed(0)}MB / ${(total / 1e6).toFixed(0)}MB)`);
      lastPct = pct;
    }
  });
  console.log(`\n[download-model] 완료: ${MODEL_PATH}`);
})().catch((err) => {
  console.error("\n[download-model] 실패:", err.message);
  process.exitCode = 1;
});

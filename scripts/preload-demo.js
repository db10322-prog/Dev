// T-8 — 데모용 기사 5건을 미리 분석해 로컬 캐시에 심어둠. 랜선 뽑고 리허설할 때 이 캐시로 폴백됨.
// 사용법: npm run preload:demo   (반드시 네트워크가 되는 상태 + API 키가 유효한 상태에서 먼저 실행)
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { analyzeArticle } = require("../core/pipeline");

const DEMO_FILE = path.join(__dirname, "demo-articles.json");

(async () => {
  const articles = JSON.parse(fs.readFileSync(DEMO_FILE, "utf-8"));
  console.log(`[preload-demo] ${articles.length}건 프리로드 시작...`);
  for (const article of articles) {
    if (article.text.includes("placeholder")) {
      console.warn(`[preload-demo] "${article.title}" — placeholder 텍스트 감지. 실제 기사 본문으로 교체 후 재실행 권장.`);
    }
    try {
      const started = Date.now();
      await analyzeArticle(article, { useCache: true });
      console.log(`[preload-demo] 완료: ${article.url} (${Date.now() - started}ms)`);
    } catch (err) {
      console.error(`[preload-demo] 실패: ${article.url}`, err.message);
    }
  }
  console.log("[preload-demo] 전체 완료. core/cache.js 의 로컬 캐시(cache/ 디렉토리)에 저장됨.");
})();

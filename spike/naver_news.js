// T-0 — 네이버 뉴스 검색 API 실호출 스파이크
// 사용: node spike/naver_news.js "검색어"
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const OUT_DIR = path.join(__dirname, "out");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function searchNews(query, { display = 20, start = 1, sort = "sim" } = {}) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 .env 에 없음. 네이버 개발자센터에서 앱 등록 후 채울 것.");
  }
  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.min(display, 100)));
  url.searchParams.set("start", String(Math.min(start, 1000)));
  url.searchParams.set("sort", sort);

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Naver API ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

(async () => {
  const query = process.argv[2] || "조국";
  console.log(`[naver_news] query="${query}" 호출 중...`);
  const result = await searchNews(query, { display: 20 });
  const outFile = path.join(OUT_DIR, `naver_news_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
  console.log(`[naver_news] total=${result.total} items=${result.items?.length ?? 0}`);
  console.log(`[naver_news] 저장: ${outFile}`);
  if ((result.items?.length ?? 0) === 0) {
    console.warn("[naver_news] 결과 0건 — 검색어 또는 앱 등록 상태 확인 필요");
  }
})().catch((err) => {
  console.error("[naver_news] 실패:", err.message);
  process.exitCode = 1;
});

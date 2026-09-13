// T-0 — Google Fact Check Tools API 한국어(languageCode=ko) 실호출 스파이크
// 사용: node spike/factcheck_ko.js "조국" "백신" "이재명"
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const OUT_DIR = path.join(__dirname, "out");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function searchClaims(query) {
  const apiKey = process.env.GOOGLE_FACTCHECK_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_FACTCHECK_API_KEY 없음");
  const url = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
  url.searchParams.set("query", query);
  url.searchParams.set("languageCode", "ko");
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(`FactCheck API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

(async () => {
  const queries = process.argv.slice(2);
  const targets = queries.length ? queries : ["조국", "백신", "이재명", "탈원전", "코로나"];
  const summary = {};
  for (const q of targets) {
    try {
      const result = await searchClaims(q);
      const count = result.claims?.length ?? 0;
      summary[q] = count;
      console.log(`[factcheck_ko] "${q}" -> ${count}건`);
      fs.writeFileSync(
        path.join(OUT_DIR, `factcheck_${q}_${Date.now()}.json`),
        JSON.stringify(result, null, 2),
        "utf-8"
      );
    } catch (err) {
      console.error(`[factcheck_ko] "${q}" 실패:`, err.message);
      summary[q] = "error";
    }
  }
  console.log("\n=== 건수 요약 (design 문서에 옮겨 적을 것) ===");
  console.log(JSON.stringify(summary, null, 2));
  const total = Object.values(summary).filter((v) => typeof v === "number").reduce((a, b) => a + b, 0);
  if (total === 0) {
    console.warn(
      "\n[경고] 모든 검색어에서 0건. 서브 에이전트 B(팩트체크 조회) 설계를 바꿔야 함 " +
      "→ 네이버 뉴스 검색으로 '\"팩트체크\" OR \"사실확인\" + 키워드' 보조 쿼리 대체안 검토."
    );
  }
})();

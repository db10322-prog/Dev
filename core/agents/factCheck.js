// 서브 에이전트 B — Google Fact Check Tools API (claims.search, languageCode=ko)
// 위험 대응: 한국어 결과가 0건에 가까우면 네이버 "팩트체크/사실확인" 보조 쿼리로 대체.
const fetch = require("node-fetch");
const { searchNaverNews } = require("./naverNews");

async function searchFactChecks(query, { pageSize = 20 } = {}) {
  const apiKey = process.env.GOOGLE_FACTCHECK_API_KEY;
  if (!apiKey) {
    console.warn("[factCheck] GOOGLE_FACTCHECK_API_KEY 없음 — 빈 결과 반환");
    return [];
  }
  const url = new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
  url.searchParams.set("query", query);
  url.searchParams.set("languageCode", "ko");
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[factCheck] API ${res.status} — 빈 결과로 대체`);
    return [];
  }
  const body = await res.json();
  return (body.claims || []).map((claim) => ({
    claimText: claim.text,
    claimant: claim.claimant,
    rating: claim.claimReview?.[0]?.textualRating,
    publisher: claim.claimReview?.[0]?.publisher?.name,
    url: claim.claimReview?.[0]?.url,
  }));
}

/** T-0 위험 대응: ko 결과가 비면 네이버 뉴스에서 "팩트체크/사실확인" 보조 쿼리로 폴백 */
async function searchFactChecksWithFallback(query) {
  const direct = await searchFactChecks(query);
  if (direct.length > 0) return { source: "google-factcheck", results: direct };

  const fallbackQuery = `${query} 팩트체크 OR 사실확인`;
  const naverResults = await searchNaverNews(fallbackQuery, { display: 10 });
  return {
    source: "naver-factcheck-fallback",
    results: naverResults.map((r) => ({
      claimText: r.title,
      claimant: r.outlet,
      rating: "미확인(보조쿼리)",
      publisher: r.outlet,
      url: r.originallink,
    })),
  };
}

module.exports = { searchFactChecks, searchFactChecksWithFallback };

// 서브 에이전트 A — 네이버 뉴스 검색 (/v1/search/news.json)
const fetch = require("node-fetch");

function stripHtml(s = "") {
  return s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/**
 * @param {string} query
 * @param {{display?: number, start?: number}} opts
 * @returns {Promise<Array<{title, outlet, url, originallink, description, pubDate}>>}
 */
async function searchNaverNews(query, { display = 20, start = 1 } = {}) {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("[naverNews] 자격증명 없음 — 빈 결과 반환 (see .env.example)");
    return [];
  }
  const url = new URL("https://openapi.naver.com/v1/search/news.json");
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(Math.min(display, 100)));
  url.searchParams.set("start", String(Math.min(start, 1000)));
  url.searchParams.set("sort", "sim");

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) {
    console.warn(`[naverNews] API ${res.status} — 빈 결과로 대체`);
    return [];
  }
  const body = await res.json();
  return (body.items || []).map((item) => ({
    title: stripHtml(item.title),
    outlet: hostToOutletGuess(item.originallink || item.link),
    url: item.link,
    originallink: item.originallink || item.link,
    description: stripHtml(item.description),
    pubDate: item.pubDate,
  }));
}

function hostToOutletGuess(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

module.exports = { searchNaverNews };

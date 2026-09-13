// 후보 기사 원문 fetch + Readability 본문 추출 (서버/Electron 메인 프로세스에서 실행).
// 원문 기사 자체는 이미 확장이 DOM에서 뽑아 전달하므로, 여기서는 "교차검증용 후보 기사"만 fetch.
const fetch = require("node-fetch");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");

const FETCH_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FakeNewsAgentDemo/0.1)" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 후보 기사 1건의 원문 본문을 fetch+Readability로 추출. 실패 시 null 반환(파이프라인은 계속 진행). */
async function fetchArticleFullText(url) {
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return null;
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.textContent || article.textContent.trim().length < 200) return null;
    return { url, title: article.title, text: article.textContent.trim() };
  } catch (err) {
    console.warn(`[articleFetch] 실패(${url}): ${err.message}`);
    return null;
  }
}

/** 후보 기사 목록 중 상위 N건을 병렬 fetch. 실패한 항목은 결과 배열에서 제외(스켈레톤 유지 X). */
async function fetchTopCandidatesFullText(candidates, { topN = 5 } = {}) {
  const targets = candidates.slice(0, topN);
  const settled = await Promise.allSettled(targets.map((c) => fetchArticleFullText(c.originallink || c.url)));
  return settled
    .map((r, i) => (r.status === "fulfilled" && r.value ? { ...r.value, outlet: targets[i].outlet } : null))
    .filter(Boolean);
}

module.exports = { fetchArticleFullText, fetchTopCandidatesFullText };

// T-1 — 판정 파이프라인 코어. 입력: 기사 본문 텍스트 + URL (+ 선택: 댓글[]).
// 출력: core/schema.json 을 따르는 판정 JSON.
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const { buildSearchQuery } = require("./keywordExtract");
const { searchNaverNews } = require("./agents/naverNews");
const { searchFactChecksWithFallback } = require("./agents/factCheck");
const { fetchTopCandidatesFullText } = require("./agents/articleFetch");
const { lookupOutletBias, isOppositeDirection } = require("./agents/outletBias");
const { scoreTextFraming } = require("./agents/textBias");
const { summarizeOpinion } = require("./agents/comments");
const { callLLMJson } = require("./agents/llm");
const { getCached, setCached } = require("./cache");

const VERDICT_PROMPT_TEMPLATE = fs.readFileSync(path.join(__dirname, "prompts", "verdict.md"), "utf-8");
const VERDICT_SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, "schema.json"), "utf-8"));

/**
 * @param {{url: string, title?: string, text: string, comments?: string[]}} input
 * @param {{useCache?: boolean}} opts
 * @returns {Promise<object>} VerdictReport
 */
async function analyzeArticle(input, opts = {}) {
  const { url, title = "", text, comments = [] } = input;
  const useCache = opts.useCache !== false;
  const startedAt = Date.now();

  if (useCache) {
    const cached = await getCached(url);
    if (cached) {
      return { ...cached.report, meta: { ...cached.report.meta, cached: true } };
    }
  }

  const searchQuery = buildSearchQuery(title, text);
  const outletBias = lookupOutletBias(url);

  // 4개 서브 에이전트를 병렬로 (+ 댓글 요약도 함께) — 20초 목표의 핵심.
  const [naverResults, factCheckResult, textSignalsRaw, opinion] = await Promise.all([
    searchNaverNews(searchQuery, { display: 20 }).catch((e) => {
      console.warn("[pipeline] naverNews 실패:", e.message);
      return [];
    }),
    searchFactChecksWithFallback(searchQuery).catch((e) => {
      console.warn("[pipeline] factCheck 실패:", e.message);
      return { source: "none", results: [] };
    }),
    scoreTextFraming(text).catch((e) => {
      console.warn("[pipeline] textBias 실패:", e.message);
      return [];
    }),
    summarizeOpinion(comments).catch((e) => {
      console.warn("[pipeline] opinion 실패:", e.message);
      return null;
    }),
  ]);

  // 후보 기사 원문 fetch는 naver 검색 결과가 있어야 시작되므로 위 병렬 배치 다음 단계지만,
  // 여전히 본체 AI 호출 전에 병렬로 처리해 전체 지연을 최소화.
  const candidateFullText = await fetchTopCandidatesFullText(naverResults, { topN: 5 });

  const textSignals = textSignalsRaw.map((s) => ({
    layer: "텍스트",
    label: s.indicator,
    detail: `score=${s.score} — ${s.detail}`,
  }));

  const oppositeCandidates = naverResults.filter((c) => {
    const cBias = lookupOutletBias(c.originallink || c.url);
    return isOppositeDirection(outletBias.direction, cBias.direction);
  });

  const prompt = buildVerdictPrompt({
    articleText: text,
    articleUrl: url,
    candidates: naverResults,
    candidateFullText,
    factChecks: factCheckResult.results,
    outletBias,
    textSignals,
  });

  const { json, modelUsed, usedFallback } = await callLLMJson({
    prompt,
    responseSchema: stripAdditional(VERDICT_SCHEMA),
  });

  const report = postProcess(json, {
    validUrls: new Set([...naverResults.map((c) => c.originallink || c.url)]),
    outletBias,
    textSignals,
    oppositeCandidates,
    opinion,
    factCheckSource: factCheckResult.source,
  });

  report.meta = {
    modelUsed,
    usedFallback,
    elapsedMs: Date.now() - startedAt,
    cached: false,
  };

  if (useCache) await setCached(url, report);
  return report;
}

function buildVerdictPrompt({ articleText, articleUrl, candidates, candidateFullText, factChecks, outletBias, textSignals }) {
  return [
    VERDICT_PROMPT_TEMPLATE,
    "",
    "## 실제 입력 데이터",
    `articleUrl: ${articleUrl}`,
    `articleText:\n${articleText.slice(0, 6000)}`,
    `candidates:\n${JSON.stringify(candidates.slice(0, 15), null, 2)}`,
    `candidateFullText:\n${JSON.stringify(candidateFullText.map((c) => ({ url: c.url, outlet: c.outlet, textExcerpt: c.text.slice(0, 1500) })), null, 2)}`,
    `factChecks:\n${JSON.stringify(factChecks, null, 2)}`,
    `outletBias:\n${JSON.stringify(outletBias, null, 2)}`,
    `textSignals:\n${JSON.stringify(textSignals, null, 2)}`,
  ].join("\n\n");
}

/** evidence[].url이 후보 목록에 없으면 해당 항목 제거 (환각 방지 후처리) */
function postProcess(json, { validUrls, outletBias, textSignals, oppositeCandidates, opinion, factCheckSource }) {
  const evidence = (json.evidence || []).filter((e) => validUrls.has(e.url));

  const bias = json.bias || { direction: outletBias.direction, score: 0, signals: [] };
  const mediaSignal = {
    layer: "매체",
    label: outletBias.direction,
    detail: outletBias.source ? `근거: ${outletBias.source}` : "근거 없음(미분류 매체)",
  };
  bias.signals = [mediaSignal, ...textSignals, ...(bias.signals || []).filter((s) => s.layer !== "매체" && s.layer !== "텍스트")];

  const counterArticles = (json.counterArticles || []).length
    ? json.counterArticles
    : oppositeCandidates.slice(0, 2).map((c) => ({
        title: c.title,
        outlet: c.outlet,
        url: c.originallink || c.url,
        direction: lookupOutletBias(c.originallink || c.url).direction,
      }));

  const limitations = [...(json.limitations || [])];
  if (factCheckSource === "naver-factcheck-fallback") {
    limitations.push("Google Fact Check API 한국어 결과가 없어 네이버 뉴스 보조 쿼리로 대체됨 — 신뢰도가 공식 팩트체크보다 낮음.");
  }
  if (outletBias.direction === "미분류") {
    limitations.push("원문 매체의 성향이 매핑 테이블에 없어 '미분류' 처리됨 — 추정하지 않음.");
  }
  if (counterArticles.length < 2) {
    limitations.push("반대 성향 매체의 교차 기사를 2건 확보하지 못함.");
  }

  return {
    ...json,
    evidence,
    bias,
    counterArticles,
    limitations,
    ...(opinion ? { opinion } : {}),
  };
}

/** Gemini responseSchema는 JSON Schema의 일부 키워드(예: $schema, title)를 허용 안 함 → 정리 */
function stripAdditional(schema) {
  const clone = JSON.parse(JSON.stringify(schema));
  delete clone.$schema;
  delete clone.title;
  const strip = (node) => {
    if (!node || typeof node !== "object") return;
    delete node.$schema;
    delete node.title;
    if (node.properties) Object.values(node.properties).forEach(strip);
    if (node.items) strip(node.items);
  };
  strip(clone);
  return clone;
}

module.exports = { analyzeArticle };

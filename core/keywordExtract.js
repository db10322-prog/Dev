// 기사 제목/본문에서 네이버 뉴스 검색용 키워드를 뽑는 저비용 규칙 기반 추출.
// LLM 호출 없이 동작해야 파이프라인 병렬 단계 시작을 지연시키지 않음.

const STOPWORDS = new Set([
  "있다", "했다", "한다", "이다", "위해", "대한", "통해", "따르면", "관련",
  "이번", "지난", "오늘", "기자", "뉴스", "오전", "오후", "이라고", "밝혔다",
  "것으로", "전했다", "라며", "이며", "그는", "그러나", "하지만",
]);

/** 한글/영문/숫자 토큰 분리 후 불용어·1글자 제거, 빈도순 상위 N개 반환 */
function extractKeywords(title, bodyText, { topN = 5 } = {}) {
  const text = `${title || ""} ${title || ""} ${bodyText || ""}`; // 제목 가중치 2배
  const tokens = text
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

/** 네이버 뉴스 검색 쿼리 문자열(공백 결합 상위 3개 키워드) */
function buildSearchQuery(title, bodyText) {
  const keywords = extractKeywords(title, bodyText, { topN: 3 });
  return keywords.join(" ") || title || "";
}

module.exports = { extractKeywords, buildSearchQuery };

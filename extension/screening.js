// T-7 — 사전 스크리닝 배지. 버튼 누르기 전 단계, API 호출 없이 저비용 규칙만 사용.
// content.js보다 먼저 로드되어 window.FakeNewsScreening 으로 노출됨.
(function () {
  let rulesCache = null;

  async function loadRules() {
    if (rulesCache) return rulesCache;
    const url = chrome.runtime.getURL("screening-rules.json");
    const res = await fetch(url);
    rulesCache = await res.json();
    return rulesCache;
  }

  function countMatchedConditions(title, bodyText, outletKnown, factcheckHit) {
    const matched = new Set();
    return { matched, factcheckHit };
  }

  async function evaluateScreening({ title, bodyText, outletKnown }) {
    const rules = await loadRules();
    const conditions = [];

    const sensational = rules.sensationalTitlePatterns.some((p) => new RegExp(p).test(title || ""));
    if (sensational) conditions.push("제목 선정성 패턴");

    if (!outletKnown) conditions.push("매체 미분류");

    const quotePattern = new RegExp(rules.sourceMissingPatterns.quoteWithoutAttribution);
    if (quotePattern.test(bodyText || "")) conditions.push("출처 미표기");

    // 팩트체크 DB 즉시 히트는 네트워크 호출이 필요해 사전 스크리닝 범위 밖.
    // 캐시된 로컬 팩트체크 이력(core/cache.js 결과)이 있을 때만 background가 알려줌 — 없으면 스킵.
    const cautionBadge = rules.badges["주의"];
    const crossCheckBadge = rules.badges["교차검증권장"];

    if (conditions.length >= (crossCheckBadge.minConditionsMatched || 2)) {
      return { level: "교차검증권장", label: crossCheckBadge.label, message: crossCheckBadge.message, conditions };
    }
    const defaultBadge = rules.badges["정보없음"];
    return { level: "정보없음", label: defaultBadge.label, message: defaultBadge.message, conditions };
  }

  window.FakeNewsScreening = { evaluateScreening };
})();

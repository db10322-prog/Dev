// T-3 — content script: Readability로 본문 추출 + 댓글 DOM 파싱 + 사전 스크리닝 배지.
// Electron 네이티브 호스트로는 background.js가 대신 전달(native messaging은 background에서만 가능).
(function () {
  let selectorsCache = null;

  async function loadSelectors() {
    if (selectorsCache) return selectorsCache;
    const url = chrome.runtime.getURL("selectors.json");
    const res = await fetch(url);
    selectorsCache = (await res.json()).sites;
    return selectorsCache;
  }

  function matchSiteConfig(sites) {
    const host = location.hostname;
    return sites.find((s) => s.hostPattern !== "*" && host.includes(s.hostPattern)) || sites.find((s) => s.hostPattern === "*");
  }

  function extractWithReadability() {
    try {
      const docClone = document.cloneNode(true);
      const reader = new Readability(docClone);
      const article = reader.parse();
      if (article && article.textContent && article.textContent.trim().length > 200) {
        return { title: article.title, text: article.textContent.trim() };
      }
    } catch (e) {
      console.warn("[content] Readability 실패, 셀렉터 폴백:", e);
    }
    return null;
  }

  function extractWithSelectors(site) {
    let title = "";
    for (const sel of site.titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        title = el.textContent.trim();
        break;
      }
    }
    let text = "";
    for (const sel of site.articleBodySelectors) {
      const el = document.querySelector(sel);
      if (el) {
        text = el.textContent.trim();
        break;
      }
    }
    return { title, text };
  }

  function extractCommentsFromDom(site) {
    const comments = [];
    for (const sel of site.commentItemSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const t = el.textContent.trim();
        if (t) comments.push(t);
      });
      if (comments.length) break;
    }
    return comments.slice(0, 200);
  }

  /** 네이버 뉴스는 댓글이 iframe(cbox)에 있어 top document에서 직접 못 읽음.
   *  iframe이 same-origin(news.naver.com 하위 도메인)이면 contentDocument 접근 시도,
   *  실패하면 댓글 섹션만 생략(전체 분석은 계속 진행 — risk 대응). */
  function extractCommentsFromIframe(site) {
    if (!site.commentIframeSelector) return [];
    try {
      const iframe = document.querySelector(site.commentIframeSelector);
      if (!iframe || !iframe.contentDocument) return [];
      const comments = [];
      site.commentItemSelectors.forEach((sel) => {
        iframe.contentDocument.querySelectorAll(sel).forEach((el) => {
          const t = el.textContent.trim();
          if (t) comments.push(t);
        });
      });
      return comments.slice(0, 200);
    } catch (e) {
      console.warn("[content] 댓글 iframe 접근 실패(교차출처 가능성) — 섹션 생략:", e.message);
      return [];
    }
  }

  async function collectArticleData() {
    const sites = await loadSelectors();
    const site = matchSiteConfig(sites);

    const readabilityResult = extractWithReadability();
    const { title, text } = readabilityResult || extractWithSelectors(site);

    let comments = extractCommentsFromDom(site);
    if (comments.length === 0) comments = extractCommentsFromIframe(site);

    return { url: location.href, title, text, comments, extractedAt: Date.now() };
  }

  async function runScreening(title, text) {
    // 매체 미분류 여부는 background가 outlet-bias 조회 후 알려주지만,
    // content script 단독으로도 도메인 기준 대략치를 즉시 낼 수 있게 outletKnown은 background 응답 이후 갱신.
    const badge = await window.FakeNewsScreening.evaluateScreening({ title, bodyText: text, outletKnown: true });
    return badge;
  }

  async function showScreeningBadge() {
    try {
      const { title, text } = extractWithReadability() || {};
      if (!text) return;
      const badge = await runScreening(title, text);
      renderBadge(badge);
    } catch (e) {
      console.warn("[content] 사전 스크리닝 실패(무시하고 계속):", e);
    }
  }

  function renderBadge(badge) {
    let el = document.getElementById("__fakenewsagent_badge__");
    if (!el) {
      el = document.createElement("div");
      el.id = "__fakenewsagent_badge__";
      el.style.cssText =
        "position:fixed;top:12px;right:12px;z-index:2147483647;padding:8px 12px;" +
        "border-radius:8px;font-size:13px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);" +
        "background:#fff;color:#222;border:1px solid #ddd;max-width:280px;";
      document.body.appendChild(el);
    }
    const color = badge.level === "주의" ? "#c0392b" : badge.level === "교차검증권장" ? "#e67e22" : "#7f8c8d";
    el.innerHTML = `<strong style="color:${color}">${badge.label}</strong><br/>${badge.message}`;
  }

  // background.js(service worker)가 요청하면 현재 탭 데이터를 수집해 응답.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "COLLECT_ARTICLE") {
      collectArticleData().then(sendResponse);
      return true; // async 응답
    }
  });

  // 페이지 로드시 사전 스크리닝 배지는 자동 표시(원 구상의 "의심 문구"를 대체하는 저위험 버전).
  showScreeningBadge();
})();

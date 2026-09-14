// 모바일 웹(크롬 확장 없이 URL만 붙여넣는 /analyze 페이지)용 엔드포인트.
// api/analyze.js는 호출자가 이미 본문(text)을 추출해서 보내야 하지만(확장이 하던 일),
// 여기서는 그 추출 자체를 서버가 대신 한다 — docs/mobile-plan.md가 "안드로이드: 공유 시트 +
// 서버 fetch"로 설계해둔 경로를, 네이티브 공유 시트 대신 이 웹 페이지로 구현한 것.
// 단, 언론사가 봇을 차단하거나 JS로만 렌더링하는 페이지면 실패할 수 있음 — 크롬 확장이
// 브라우저가 이미 렌더링한 DOM을 읽는 것보다 성공률이 낮다는 한계가 그대로 있다(문서에 명시된 그대로).
const { fetchArticleFullText } = require("../../../core/agents/articleFetch");
const { analyzeArticle } = require("../../../core/pipeline");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST만 지원" });
    return;
  }
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "올바른 기사 URL을 입력해주세요 (http:// 또는 https://로 시작해야 합니다)." });
    return;
  }

  let article;
  try {
    article = await fetchArticleFullText(url);
  } catch (err) {
    console.error("[api/analyze-url] 원문 fetch 실패:", err);
    article = null;
  }
  if (!article) {
    res.status(422).json({
      error:
        "이 링크에서 기사 본문을 자동으로 추출하지 못했습니다. 해당 언론사가 자동 접근을 차단했거나, " +
        "자바스크립트로만 내용을 그리는 페이지일 수 있습니다. PC + 크롬 확장을 쓰면 이 문제 없이 분석됩니다.",
    });
    return;
  }

  try {
    const report = await analyzeArticle({ url, title: article.title, text: article.text });
    res.status(200).json({ ...report, extractedTitle: article.title });
  } catch (err) {
    console.error("[api/analyze-url] 분석 실패:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
}

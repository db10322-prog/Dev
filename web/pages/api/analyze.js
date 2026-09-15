// Vercel 서버리스 모드 — "실배포 시 프록시 필요"(미해결 질문 #2)를 실제로 구현한 엔드포인트.
// 브라우저/확장이 API 키를 직접 들고 있지 않고, 이 서버가 대신 Gemini/Naver/FactCheck를 호출한다.
// 데모(Electron) 경로는 기본적으로 이 엔드포인트를 쓰지 않고 core/pipeline을 로컬에서 직접 호출한다 —
// 오프라인 리허설(T-8) 요구사항 때문에 클라우드 의존을 기본값으로 두지 않음.
const { analyzeArticle } = require("../../../core/pipeline");

// analyze-url.js와 같은 이유 — 폴백 체인 뒤쪽 provider가 느릴 때 플랜 기본 제한에 일찍 잘리지
// 않도록 명시적으로 최대치를 요청.
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST만 지원" });
    return;
  }
  const { url, title, text, comments } = req.body || {};
  if (!url || !text || text.length < 200) {
    res.status(400).json({ error: "url과 200자 이상의 text가 필요합니다." });
    return;
  }
  try {
    const report = await analyzeArticle({ url, title: title || "", text, comments: comments || [] });
    res.status(200).json(report);
  } catch (err) {
    console.error("[api/analyze] 실패:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
}

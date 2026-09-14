// core/schema.json(VerdictReport)을 렌더링. app/renderer/report.html/report.css의 데스크톱 결과창과
// 같은 정보 구조·색상 규칙을 웹(모바일 포함)용으로 재구현한 것 — 두 표현이 서로 어긋나지 않게
// core/schema.json을 기준으로 유지할 것.
const VERDICT_CLASS = {
  "검증됨": "verified",
  "대체로 사실": "mostly",
  "근거 불충분": "insufficient",
  "사실과 다름": "false",
};

export default function ReportView({ report }) {
  const {
    verdict, confidence, reasons = [], evidence = [], bias, counterArticles = [],
    opinion, limitations = [], meta, extractedTitle,
  } = report;

  return (
    <div>
      {extractedTitle && <p className="analyze-hint" style={{ marginBottom: 14 }}>추출된 기사 제목: {extractedTitle}</p>}

      <div className="report-card">
        <div className="report-verdict-row">
          <span className={`report-verdict-badge ${VERDICT_CLASS[verdict] || "insufficient"}`}>{verdict}</span>
          <span className="report-confidence">신뢰도 {Math.round((confidence || 0) * 100)}%</span>
          {meta?.cached && <span className="report-cached-tag">캐시된 결과</span>}
        </div>
      </div>

      <div className="report-card">
        <h3>판단 근거</h3>
        <ul className="report-reasons">
          {reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>

      {evidence.length > 0 && (
        <div className="report-card">
          <h3>교차 비교 기사</h3>
          <div className="report-evidence-list">
            {evidence.map((e, i) => (
              <div className="report-evidence-item" key={i}>
                <span className={`stance ${e.stance}`}>{e.stance}</span>
                <a href={e.url} target="_blank" rel="noreferrer noopener">{e.title}</a>
                <span className="outlet">{e.outlet}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bias && (
        <div className="report-card">
          <h3>편향 방향 (매체 근거 + 텍스트 근거 분리 표시)</h3>
          <div className="report-bias-spectrum">
            <div className="report-bias-marker" style={{ left: `${((bias.score ?? 0) + 1) * 50}%` }} />
          </div>
          <ul className="report-bias-signals">
            {(bias.signals || []).map((s, i) => <li key={i}>[{s.layer}] {s.label} — {s.detail}</li>)}
          </ul>
        </div>
      )}

      {counterArticles.length > 0 && (
        <div className="report-card">
          <h3>반대 성향 기사</h3>
          <div className="report-counter-grid">
            {counterArticles.map((c, i) => (
              <div className="item" key={i}>
                <a href={c.url} target="_blank" rel="noreferrer noopener">{c.title}</a>
                <span className="outlet">{c.outlet} · {c.direction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {opinion && (
        <div className="report-card">
          <h3>댓글 여론 요약</h3>
          <div className="report-opinion-bar">
            <div className="for" style={{ width: `${(opinion.forRatio ?? 0) * 100}%` }} />
            <div className="against" style={{ width: `${(opinion.againstRatio ?? 0) * 100}%` }} />
          </div>
          {opinion.alignmentWithArticle && (
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 6px" }}>
              기사 논조와의 일치도: {opinion.alignmentWithArticle}
            </p>
          )}
          <ul className="report-opinion-points">
            {(opinion.topPoints || []).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {limitations.length > 0 && (
        <div className="report-card report-limitations">
          <h3>한계</h3>
          <ul>
            {limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}

      <p className="report-footer-notice">
        이 결과는 자동화된 AI 분석이며, 최종 판단은 사용자 본인의 몫입니다. 매체 성향은 외부 연구 인용, 텍스트 분석은 AI 추정입니다.
        {meta?.modelUsed && ` (사용 모델: ${meta.modelUsed}${meta.usedFallback ? ", 폴백 경로 사용됨" : ""})`}
      </p>
    </div>
  );
}

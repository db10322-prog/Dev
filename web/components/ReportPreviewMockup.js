// 실제 스크린샷이 아니라 결과 화면 구조를 보여주는 예시(mock) — app/renderer/report.html의 레이아웃을 그대로 반영.
export default function ReportPreviewMockup() {
  return (
    <div className="mock-card">
      <div className="mock-titlebar"><span /><span /><span /></div>
      <div className="mock-verdict">
        <span className="pill">대체로 사실</span>
        <span className="conf">신뢰도 82%</span>
      </div>
      <div className="mock-row">
        <span className="dot" />
        기사 내용이 정부 발표 원문과 일치함
      </div>
      <div className="mock-row">
        <span className="dot" />
        타 매체 3곳에서 동일 사실관계 보도 확인
      </div>
      <div className="mock-row">
        <span className="stance">지지</span>
        연합뉴스 — &ldquo;동일 발표 내용 보도&rdquo;
      </div>
      <div className="mock-row">
        <span className="stance">반박</span>
        A일보 — &ldquo;세부 수치 이견 제기&rdquo;
      </div>
      <div className="mock-spectrum"><i /></div>
      <div className="mock-caption">예시 화면 — 실제 문구는 분석 기사에 따라 달라집니다</div>
    </div>
  );
}

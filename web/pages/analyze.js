import { useState } from "react";
import Link from "next/link";
import ReportView from "../components/ReportView";

// 크롬 확장/데스크톱 앱 없이, 휴대폰 브라우저에서 기사 링크만 붙여넣어 바로 분석해보는 페이지.
// api/analyze-url.js가 서버에서 직접 원문을 fetch+Readability로 추출한 뒤 core/pipeline을 태운다 —
// docs/mobile-plan.md가 "안드로이드: 공유 시트 + 서버 fetch"로 설계해둔 경로를 네이티브 앱 없이
// 웹 페이지로 구현한 것. 크롬 확장이 브라우저가 이미 렌더링한 DOM을 읽는 것보다는 성공률이
// 낮다는 한계가 그대로 있음(언론사 봇 차단, JS 렌더링 페이지 등) — 아래 안내 문구에도 명시.
export default function Analyze() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error | done
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!url.trim() || status === "loading") return;
    setStatus("loading");
    setError("");
    setReport(null);
    try {
      const res = await fetch("/api/analyze-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "알 수 없는 오류가 발생했습니다.");
        setStatus("error");
        return;
      }
      setReport(data);
      setStatus("done");
    } catch (err) {
      setError("네트워크 오류로 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setStatus("error");
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <header className="analyze-header">
        <Link href="/" className="back-link">← 뉴스 판별 에이전트</Link>
        <h1>휴대폰에서 바로 분석해보기</h1>
        <p>
          뉴스 기사 링크를 붙여넣으면 서버가 본문을 직접 가져와 교차검증·편향·진위를 분석합니다.
          크롬 확장이 브라우저 화면을 직접 읽는 PC 버전보다는 본문 추출 성공률이 낮을 수 있어요 —
          언론사가 자동 접근을 막아두었거나 자바스크립트로만 내용을 그리는 페이지면 실패할 수 있습니다.
        </p>
      </header>

      <form className="analyze-form" onSubmit={handleSubmit}>
        <input
          type="url"
          inputMode="url"
          placeholder="https://example.com/기사-링크"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "분석 중…" : "분석하기"}
        </button>
      </form>
      <p className="analyze-hint">기사 원문 링크를 그대로 붙여넣어주세요. 보통 10~30초 정도 걸립니다.</p>

      {status === "loading" && (
        <div className="analyze-status">
          <span className="analyze-spinner" />
          본문 추출 → 교차검증(뉴스 검색·팩트체크) → 편향·진위 판정 순서로 진행 중입니다…
        </div>
      )}

      {status === "error" && <div className="analyze-error">{error}</div>}

      {status === "done" && report && <ReportView report={report} />}
    </div>
  );
}

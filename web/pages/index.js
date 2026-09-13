import CharacterIllustration from "../components/CharacterIllustration";

const FEATURES = [
  {
    emoji: "🔍",
    title: "4단계 진위 판정 + 근거",
    desc: "가짜/진짜 이분법 대신 검증됨·대체로 사실·근거 불충분·사실과 다름 4단계로 판정하고, 판단 근거를 3줄 이상 함께 보여줍니다.",
  },
  {
    emoji: "📰",
    title: "타 언론사 교차검증 3건 이상",
    desc: "네이버 뉴스 검색 + Google Fact Check API로 같은 사안을 다룬 다른 매체 기사를 찾아 제목·매체·링크와 함께 제시합니다.",
  },
  {
    emoji: "⚖️",
    title: "편향 방향 + 반대 성향 기사",
    desc: "매체 성향 매핑(출처 공개)과 텍스트 프레이밍 분석을 분리 표시하고, 반대 성향 매체의 기사 2건을 나란히 보여줍니다.",
  },
  {
    emoji: "💬",
    title: "댓글 여론 요약",
    desc: "찬반 비율과 주요 논점을 요약해서 보여주되, 댓글 원문이나 작성자 정보는 노출하지 않습니다.",
  },
];

const FLOW = [
  { title: "캐릭터 클릭", desc: "바탕화면 우측 하단 캐릭터를 클릭하면 현재 크롬 탭 분석을 제안합니다." },
  { title: "본문 확보", desc: "크롬 확장이 현재 탭 DOM에서 Readability로 본문/댓글을 추출합니다." },
  { title: "병렬 교차검증", desc: "뉴스 검색·팩트체크·원문 fetch·매체 성향 조회를 동시에 실행합니다." },
  { title: "20초 내 리포트", desc: "본체 AI를 1회만 호출해 판정 리포트를 렌더링합니다." },
];

export default function Home() {
  return (
    <>
      <div className="container">
        <nav className="nav">
          <div className="logo">
            <span style={{ width: 22, height: 22, display: "inline-block" }}>
              <CharacterIllustration />
            </span>
            뉴스 판별 에이전트
          </div>
          <a className="cta" href="#download">다운로드</a>
        </nav>

        <section className="hero" style={{ paddingBottom: 0 }}>
          <div>
            <div className="badge-line">
              <span className="badge">데스크톱 전용 데모</span>
              <span className="badge">Windows</span>
              <span className="badge">무료 API 기반</span>
            </div>
            <h1>
              뉴스를 읽다가 궁금하면,<br />
              <span className="accent">캐릭터 클릭</span> 한 번으로 끝.
            </h1>
            <p className="lead">
              지금 크롬에서 보고 있는 뉴스 기사를 캐릭터가 읽고, 진위 신뢰도·편향 방향·반대편 기사·댓글 여론을
              근거와 함께 20초 안에 보여줍니다. 회원가입도, 설치 후 설정도 최소화했습니다.
            </p>
            <div className="hero-actions">
              <a className="btn-primary" href="#download">앱 다운로드</a>
              <a className="btn-secondary" href="#how-it-works">작동 방식 보기</a>
            </div>
          </div>
          <div className="hero-visual">
            <CharacterIllustration />
          </div>
        </section>
      </div>

      <div className="container" id="how-it-works">
        <section>
          <h2 className="section-title">이런 걸 보여줘요</h2>
          <p className="section-sub">클릭 한 번, 4가지 정보를 한 화면에서 확인합니다.</p>
          <div className="card-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="emoji">{f.emoji}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title">작동 흐름</h2>
          <p className="section-sub">크롬 확장 + Electron 캐릭터가 네이티브 메시징으로 이어져 있어요.</p>
          <div className="flow">
            {FLOW.map((step, i) => (
              <div className="flow-step" key={step.title}>
                <div className="step-num">{i + 1}</div>
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title">숨기지 않습니다</h2>
          <p className="section-sub">한국엔 표준화된 언론사 편향 데이터가 없습니다. 그래서 근거와 한계를 그대로 보여줍니다.</p>
          <div className="disclosure">
            <h3>투명성 고지</h3>
            <ul>
              <li>매체 성향 라벨은 학술 연구·언론재단 공개 자료를 참고해 직접 정리한 것이며, 근거가 없는 매체는 추정하지 않고 &lsquo;미분류&rsquo;로 둡니다.</li>
              <li>텍스트 프레이밍 분석은 AI의 1회성 추정이며 제3자 검증을 거치지 않았습니다.</li>
              <li>모든 판정은 자동화된 분석 결과이며, 최종 판단은 사용자 본인의 몫입니다.</li>
            </ul>
          </div>
        </section>

        <section id="download">
          <div className="download-box">
            <h2>지금 바로 사용해보기</h2>
            <p>Windows 데스크톱 + 크롬 확장이 필요합니다. 설치 후 바탕화면 바로가기가 자동 생성됩니다.</p>
            <div className="hero-actions">
              <a className="btn-primary" href="https://github.com/">앱 다운로드 (GitHub Release)</a>
              <a className="btn-secondary" href="https://github.com/">크롬 확장 소스 보기</a>
            </div>
          </div>
        </section>
      </div>

      <footer>
        <div className="container">
          이 프로젝트는 대회/발표용 데모이며, 실배포에 필요한 API 키 프록시 서버 구성은{" "}
          <a href="/docs">배포 문서</a>를 참고하세요. Gemini/Naver/Google Fact Check/GDELT API를 사용합니다.
        </div>
      </footer>
    </>
  );
}

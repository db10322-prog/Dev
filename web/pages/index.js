import Link from "next/link";
import CharacterIllustration from "../components/CharacterIllustration";
import ReportPreviewMockup from "../components/ReportPreviewMockup";
import CopyLinkButton from "../components/CopyLinkButton";
import { VerdictIcon, CrossCheckIcon, BiasIcon, OpinionIcon, DesktopOnlyIcon } from "../components/FeatureIcons";

const DOWNLOAD_URL = "https://github.com/db10322-prog/Dev/releases/latest/download/NewsVerdictAgent-Setup.exe";
const REPO_URL = "https://github.com/db10322-prog/Dev";

const FEATURES = [
  {
    Icon: VerdictIcon,
    title: "4단계 진위 판정 + 근거",
    desc: "가짜/진짜 이분법 대신 검증됨·대체로 사실·근거 불충분·사실과 다름 4단계로 판정하고, 판단 근거를 3줄 이상 함께 보여줍니다.",
  },
  {
    Icon: CrossCheckIcon,
    title: "타 언론사 교차검증",
    desc: "네이버 뉴스 검색 + Google Fact Check API로 같은 사안을 다룬 다른 매체 기사를 찾아 제목·매체·링크와 함께 제시합니다.",
  },
  {
    Icon: BiasIcon,
    title: "편향 방향 + 반대 성향 기사",
    desc: "매체 성향 매핑(출처 공개)과 텍스트 프레이밍 분석을 분리 표시하고, 반대 성향 매체의 기사를 나란히 보여줍니다.",
  },
  {
    Icon: OpinionIcon,
    title: "댓글 여론 요약",
    desc: "찬반 비율과 주요 논점을 요약해서 보여주되, 댓글 원문이나 작성자 정보는 노출하지 않습니다.",
  },
];

const FLOW = [
  { title: "설치 & 실행", desc: "설치 파일을 내려받아 더블클릭하면 바로 실행됩니다. 첫 실행 시 AI 모델을 한 번만 자동으로 받습니다." },
  { title: "캐릭터 클릭", desc: "바탕화면 우측 하단 캐릭터를 클릭하면 현재 크롬 탭 분석을 제안합니다." },
  { title: "병렬 교차검증", desc: "본문 추출과 동시에 뉴스 검색·팩트체크·매체 성향 조회를 실행합니다." },
  { title: "판정 리포트", desc: "근거와 함께 4단계 판정, 편향 방향, 댓글 여론을 한 화면에 보여줍니다." },
];

export default function Home() {
  return (
    <>
      <div className="container">
        <nav className="nav">
          <div className="logo">
            <span className="logo-icon"><CharacterIllustration /></span>
            뉴스 판별 에이전트
          </div>
          <a className="cta" href="#download">다운로드</a>
        </nav>

        <section className="hero" style={{ paddingBottom: 0 }}>
          <div>
            <div className="badge-line">
              <span className="badge">Windows 데스크톱</span>
              <span className="badge">설치 후 바로 실행</span>
              <span className="badge">무료 · 계정 불필요</span>
            </div>
            <h1>
              뉴스를 읽다가 궁금하면,<br />
              <span className="accent">캐릭터 클릭</span> 한 번으로 끝.
            </h1>
            <p className="lead">
              지금 크롬에서 보고 있는 뉴스 기사를 캐릭터가 읽고, 진위 신뢰도·편향 방향·반대편 기사·댓글 여론을
              근거와 함께 보여줍니다. 회원가입도, 설치 후 설정도 필요 없습니다.
            </p>
            <div className="hero-actions">
              <a className="btn-primary" href={DOWNLOAD_URL}>Windows용 다운로드</a>
              <a className="btn-ghost" href="#how-it-works">작동 방식 보기 ↓</a>
            </div>
            <p className="btn-hint">클릭하면 설치 파일이 바로 다운로드됩니다 · 약 110MB</p>

            <div className="pc-only-notice">
              <span className="glyph"><DesktopOnlyIcon width={18} height={18} /></span>
              <div>
                <strong>캐릭터 앱은 PC 전용입니다</strong>
                <p>바탕화면 캐릭터 + 크롬 확장 조합은 휴대폰에 설치·실행할 수 없어요(OS 정책상 불가능). 대신 아래 버튼으로 지금 바로 휴대폰에서 기사 링크를 분석해볼 수 있습니다.</p>
                <Link href="/analyze" className="copy-link-btn" style={{ display: "inline-flex" }}>
                  휴대폰에서 링크로 바로 분석해보기 →
                </Link>
                <br />
                <CopyLinkButton />
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <CharacterIllustration />
          </div>
        </section>
      </div>

      <div className="container" id="how-it-works">
        <section>
          <div className="section-head">
            <h2 className="section-title">이런 걸 보여줘요</h2>
            <p className="section-sub">클릭 한 번, 네 가지 정보를 한 화면에서 확인합니다.</p>
          </div>
          <div className="card-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <span className="emoji"><f.Icon width={20} height={20} /></span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2 className="section-title">작동 흐름</h2>
            <p className="section-sub">크롬 확장 + 데스크톱 캐릭터가 네이티브 메시징으로 이어져 있어요.</p>
          </div>
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
          <div className="preview-wrap">
            <div className="preview-copy">
              <span className="tag">결과 화면</span>
              <h2 className="section-title" style={{ marginTop: 8 }}>근거까지 한눈에</h2>
              <p>판정 등급과 신뢰도, 교차 비교한 기사의 지지/반박 여부, 편향 스펙트럼을 하나의 리포트로 모아 보여줍니다.</p>
              <p>모든 판정 하단에는 &ldquo;자동 분석 결과이며 최종 판단은 사용자 몫&rdquo;이라는 고지가 항상 함께 표시됩니다.</p>
            </div>
            <ReportPreviewMockup />
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2 className="section-title">숨기지 않습니다</h2>
            <p className="section-sub">한국엔 표준화된 언론사 편향 데이터가 없습니다. 그래서 근거와 한계를 그대로 보여줍니다.</p>
          </div>
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
            <p className="sub">Windows + 크롬이 필요합니다. 설치 후 바탕화면 바로가기가 자동 생성돼요.</p>
            <div className="hero-actions">
              <a className="btn-primary" href={DOWNLOAD_URL}>Windows용 다운로드</a>
              <a className="btn-secondary" href={REPO_URL}>소스코드 보기</a>
            </div>
            <p className="file-meta">NewsVerdictAgent-Setup.exe · 약 110MB · 첫 실행 시 AI 모델 자동 다운로드</p>
          </div>
        </section>
      </div>

      <footer>
        <div className="container">
          이 프로젝트는 대회/발표용 데모입니다. 본체 AI는 계정·로그인이 필요 없는 로컬 실행 모델을 기본으로 사용하며,
          Naver 뉴스 검색 · Google Fact Check API를 함께 사용합니다.
        </div>
      </footer>
    </>
  );
}

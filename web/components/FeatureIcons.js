// 이모지(🔍📰⚖️💬💻) 대신 쓰는 커스텀 라인 아이콘 — Feather Icons 스타일 규칙을 그대로 따름:
// 24x24 그리드 고정, stroke-width 2 고정, 끝처리는 항상 round. 세트 안에서 이 규칙을 섞지 않는 게
// 포인트(규칙이 섞이면 그 자체로 "급조된" 인상을 줌). 색은 currentColor로 둬서 부모의 color로 제어.
const COMMON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export function VerdictIcon(props) {
  // 돋보기(검증 행위) + 안에 체크마크 — "진위판정 + 근거"
  return (
    <svg {...COMMON} {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M14.8 14.8L20 20" />
      <path d="M7.2 10.3l1.8 1.8 3.4-3.8" />
    </svg>
  );
}

export function CrossCheckIcon(props) {
  // 살짝 어긋나게 겹친 문서 두 장 — "타 언론사 교차검증"
  return (
    <svg {...COMMON} {...props}>
      <rect x="8.5" y="2.7" width="11" height="14.5" rx="1.4" />
      <rect x="4.5" y="6.8" width="11" height="14.5" rx="1.4" />
      <path d="M7.3 11.3h5" />
      <path d="M7.3 14.3h5" />
      <path d="M7.3 17.3h3.2" />
    </svg>
  );
}

export function BiasIcon(props) {
  // 가운데서 양쪽으로 뻗는 화살표 — "편향 방향 + 반대 성향 기사"
  return (
    <svg {...COMMON} {...props}>
      <path d="M12 12H4" />
      <path d="M7.4 8.6L4 12l3.4 3.4" />
      <path d="M12 12h8" />
      <path d="M16.6 8.6L20 12l-3.4 3.4" />
    </svg>
  );
}

export function OpinionIcon(props) {
  // 크기 다른 말풍선 두 개가 겹친 형태(꼬리 포함) — "댓글 여론 요약"
  return (
    <svg {...COMMON} {...props}>
      <rect x="9.2" y="3" width="11.3" height="8" rx="3" />
      <rect x="3.5" y="8.4" width="13" height="9.4" rx="3" />
      <path d="M7 17.8l-.6 3 3.4-3" />
    </svg>
  );
}

export function DesktopOnlyIcon(props) {
  // 모니터 한 대 — "PC 전용"
  return (
    <svg {...COMMON} {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" />
      <path d="M9 20.3h6" />
      <path d="M12 16.5v3.8" />
    </svg>
  );
}

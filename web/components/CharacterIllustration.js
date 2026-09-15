// app/character/index.html의 캐릭터를 랜딩 페이지용으로 재사용. 흰 로봇 머리+시안 링눈 조합은
// AI 생성 이미지에서 흔한 클리셰라 리디자인함 — 종이 크림색 블롭 실루엣 + 비대칭 눈(한쪽 윙크) +
// 기울어진 안테나 하나 + 돋보기를 든 팔 하나로, 사람이 그린 마스코트에 가깝게 만듦.
export default function CharacterIllustration() {
  return (
    <svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="74" cy="196" rx="17" ry="9" fill="#20232b" />
      <ellipse cx="124" cy="198" rx="14" ry="8" fill="#20232b" />

      <ellipse cx="100" cy="112" rx="74" ry="72" fill="#f6ecd9" stroke="#20232b" strokeWidth="4" />

      <path d="M34 120 q-13 7 -13 23" fill="none" stroke="#20232b" strokeWidth="10" strokeLinecap="round" />
      <path d="M158 130 q20 6 24 27" fill="none" stroke="#20232b" strokeWidth="10" strokeLinecap="round" />
      <circle cx="183" cy="161" r="8" fill="#20232b" />
      <line x1="191" y1="144" x2="200" y2="156" stroke="#e2572c" strokeWidth="6" strokeLinecap="round" />
      <circle cx="180" cy="130" r="15" fill="#f6ecd9" stroke="#e2572c" strokeWidth="5" />

      <circle cx="76" cy="101" r="7" fill="#20232b" />
      <path d="M112 105 q10 -12 22 -2" fill="none" stroke="#20232b" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="62" cy="121" r="9" fill="#e2572c" opacity="0.32" />
      <circle cx="132" cy="123" r="9" fill="#e2572c" opacity="0.32" />
      <path d="M84 131 q16 14 34 2" fill="none" stroke="#20232b" strokeWidth="5" strokeLinecap="round" />

      <path d="M96 42 q10 -26 28 -22" fill="none" stroke="#20232b" strokeWidth="6" strokeLinecap="round" />
      <circle cx="126" cy="19" r="8" fill="#e2572c" />
    </svg>
  );
}

// app/character/index.html 의 SVG 캐릭터를 랜딩 페이지 히어로용으로 재사용(참고 이미지의 흰색/검정 로봇 + 파란 링 눈 재현).
export default function CharacterIllustration() {
  return (
    <svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">
      <rect x="62" y="128" width="76" height="62" rx="20" fill="#fff" stroke="#1c1f26" strokeWidth="2" />
      <circle cx="70" cy="140" r="6" fill="#14161b" />
      <circle cx="100" cy="160" r="7" fill="#3182f6" />
      <rect x="34" y="140" width="20" height="46" rx="10" fill="#fff" stroke="#1c1f26" strokeWidth="2" />
      <rect x="146" y="140" width="20" height="46" rx="10" fill="#fff" stroke="#1c1f26" strokeWidth="2" />
      <circle cx="44" cy="188" r="9" fill="#14161b" />
      <circle cx="156" cy="188" r="9" fill="#14161b" />
      <rect x="72" y="186" width="18" height="26" rx="8" fill="#fff" stroke="#1c1f26" strokeWidth="2" />
      <rect x="110" y="186" width="18" height="26" rx="8" fill="#fff" stroke="#1c1f26" strokeWidth="2" />
      <ellipse cx="81" cy="214" rx="14" ry="7" fill="#14161b" />
      <ellipse cx="119" cy="214" rx="14" ry="7" fill="#14161b" />
      <circle cx="100" cy="70" r="62" fill="#fff" stroke="#1c1f26" strokeWidth="2" />
      <path d="M45 55 a55 55 0 0 1 110 0 a55 65 0 0 1 -110 0 z" fill="#14161b" />
      <circle cx="76" cy="58" r="16" fill="none" stroke="#2fd0ff" strokeWidth="5" />
      <circle cx="122" cy="58" r="12" fill="none" stroke="#2fd0ff" strokeWidth="4" />
      <circle cx="100" cy="18" r="5" fill="#14161b" />
    </svg>
  );
}

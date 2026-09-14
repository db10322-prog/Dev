// core/의 여러 모듈이 모듈 로드 시점에 __dirname 기준으로 프롬프트(.md)/데이터(.json) 파일을
// 읽는데, 이건 순수 Node(Electron 메인 프로세스, cli.js)에서는 잘 동작하지만 web/의 Next.js API
// route(core/pipeline 등을 require)를 거쳐 webpack으로 번들링되면 깨진다 — Next가 여러 모듈을
// 하나의 청크 파일로 합치면서 __dirname이 원래 소스 위치가 아니라 번들 출력 위치(.next/server/...)를
// 가리키게 되기 때문. 실제로 `next start`로 재현됨: core/agents/textBias.js 기준 경로가
// ".next/server/prompts/bias.md"로 잘못 풀려서 ENOENT가 났음 — 즉 web/api/analyze(-url) 양쪽 다
// 이 버그 때문에 배포 후 매 요청이 500으로 실패했을 가능성이 높다.
// 해결: __dirname 기준 경로를 우선 시도하고(Electron/CLI 환경에서 그대로 동작), 없으면 저장소
// 루트 기준 후보 경로들을 순서대로 시도한다(Next.js가 web/ 또는 repo 루트 어느 쪽을 cwd로 잡든
// 대응 가능하도록).
const fs = require("fs");
const path = require("path");

/**
 * @param {string} dirnameCandidate __dirname을 기준으로 계산한 경로(순수 Node 환경에서 정답)
 * @param {string[]} repoRootRelativeParts 저장소 루트 기준 상대 경로 조각들(예: ["core", "prompts", "verdict.md"])
 * @returns {string} 실제로 존재하는 파일 경로. 어느 후보도 없으면 dirnameCandidate를 그대로 반환(원래 에러가 나서 원인 추적이 쉽도록).
 */
function resolveCoreAsset(dirnameCandidate, ...repoRootRelativeParts) {
  if (fs.existsSync(dirnameCandidate)) return dirnameCandidate;

  const candidates = [
    path.join(process.cwd(), ...repoRootRelativeParts), // cwd == 저장소 루트인 경우
    path.join(process.cwd(), "..", ...repoRootRelativeParts), // cwd == web/ 인 경우(Vercel 배포 루트가 web/일 때)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return dirnameCandidate;
}

module.exports = { resolveCoreAsset };

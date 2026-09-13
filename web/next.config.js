const path = require("path");

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // web/ 은 모노레포의 하위 폴더이고 api/analyze.js 가 상위의 core/ 를 require 하므로,
  // Vercel의 파일 트레이싱이 리포 루트까지 올라가 core/ 전체를 포함하도록 지정.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, ".."),
  },
  // node-llama-cpp(로컬 AI 모델용, 네이티브 바이너리 포함)는 Vercel의 Linux 서버리스 환경에
  // 애초에 맞지 않는 패키지라 웹팩이 번들링을 시도하면 빌드 자체가 실패한다(실제로 겪음).
  // external로 빼서 웹팩이 파싱/번들링을 아예 시도하지 않게 한다 — 런타임에도 이 경로는
  // core/agents/llm.js가 VERCEL 환경변수를 보고 아예 호출하지 않도록 막아둠.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("node-llama-cpp");
    }
    // Vercel은 Root Directory(web/)의 package.json만 보고 web/node_modules 에만 설치한다 —
    // 리포 루트에는 아무것도 설치하지 않는다. core/agents/*.js 는 web/ 바깥(형제 디렉터리)에
    // 있어서 Node의 기본 module 해석(요청 파일 위치에서 위로만 훑는 방식)으로는
    // web/node_modules 를 절대 못 찾는다(실제로 "Module not found: node-fetch/jsdom/
    // @mozilla/readability" 빌드 실패로 재현됨). 절대경로로 web/node_modules 를 추가
    // 검색 경로에 넣어서, core/ 에서 하는 require든 어디서 하는 require든 항상 찾아지게 한다.
    config.resolve.modules = [...(config.resolve.modules || []), path.join(__dirname, "node_modules")];
    return config;
  },
};

// T-0 대체 — 로컬 본체 AI(Qwen2.5-1.5B, node-llama-cpp) 실호출 스파이크.
// 계정/키가 전혀 필요 없음. 첫 실행 전 반드시: npm run download-model
//
// 모델 로딩(디스크→메모리, 1회성)과 실제 추론(요청마다 반복)을 분리해서 측정한다.
// Electron 앱은 모델을 한 번 로드해두고 계속 재사용하므로, 20초 예산과 비교해야 할 숫자는
// "로딩 시간"이 아니라 "두 번째 이후 추론 시간"이다.
require("dotenv").config();
const { callLocalLlmJson } = require("../core/agents/localLlm");

// core/schema.json 의 reasons(minItems:3)와 동일한 제약을 걸어야 실제 파이프라인과
// 비교 가능한 결과가 나온다 — 이전 실행에서 이 제약이 빠져 있어 reasons가 빈 배열로 나왔었음.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["검증됨", "대체로 사실", "근거 불충분", "사실과 다름"] },
    confidence: { type: "number" },
    reasons: { type: "array", items: { type: "string" }, minItems: 3 },
  },
  required: ["verdict", "confidence", "reasons"],
};

function buildPrompt(sentence) {
  return (
    "모든 답변은 반드시 한국어로만 작성해. 다른 언어를 섞지 마.\n" +
    "다음 한국어 뉴스 문장의 사실 여부를 4단계(검증됨/대체로 사실/근거 불충분/사실과 다름)로 " +
    `판정하고 근거를 3줄 이상 한국어로 제시해. confidence는 0과 1 사이 소수로. 문장: "${sentence}"`
  );
}

(async () => {
  const prompts = [
    buildPrompt("정부가 내년도 최저임금을 시급 1만 700원으로 결정했다."),
    buildPrompt("정기국회가 개막해 예산안 심사가 11월에 본격화된다."),
  ];

  for (let i = 0; i < prompts.length; i++) {
    const label = i === 0 ? "1회차(모델 로딩 포함, 콜드스타트)" : "2회차(모델 이미 로드됨, 웜스타트 — 이게 실제 20초 예산과 비교할 숫자)";
    console.log(`\n=== ${label} ===`);
    const started = Date.now();
    const { json, modelUsed } = await callLocalLlmJson({ prompt: prompts[i], responseSchema: RESPONSE_SCHEMA });
    const elapsedMs = Date.now() - started;
    console.log(`[local_llm] modelUsed=${modelUsed} elapsedMs=${elapsedMs}`);
    console.log(JSON.stringify(json, null, 2));
  }
  process.exit(0);
})().catch((err) => {
  console.error("[local_llm] 실패:", err);
  process.exitCode = 1;
});

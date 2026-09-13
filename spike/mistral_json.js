// T-0 — Mistral AI 무료 "Experiment" 티어 실호출 스파이크.
// 이용약관상 만 13세 이상 + 미성년자는 보호자 동의로 본인 명의 가입 가능(카드 불필요, SMS 인증만).
// https://console.mistral.ai/ 에서 가입 후 API 키 발급.
require("dotenv").config();
const { callMistral, extractJson } = require("../core/agents/llm");

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["검증됨", "대체로 사실", "근거 불충분", "사실과 다름"] },
    confidence: { type: "number" },
    reasons: { type: "array", items: { type: "string" }, minItems: 3 },
  },
  required: ["verdict", "confidence", "reasons"],
};

(async () => {
  const prompt =
    "다음 한국어 뉴스 문장의 사실 여부를 4단계(검증됨/대체로 사실/근거 불충분/사실과 다름)로 " +
    "판정하고 근거를 3줄 이상 제시해. confidence는 0~1 사이 소수로. " +
    '문장: "정부가 내년도 최저임금을 시급 1만 700원으로 결정했다."';

  console.log("[mistral] 호출 중...");
  const started = Date.now();
  const { text, modelUsed } = await callMistral({ prompt, responseSchema: RESPONSE_SCHEMA });
  const elapsedMs = Date.now() - started;

  console.log(`[mistral] modelUsed=${modelUsed} elapsedMs=${elapsedMs}`);
  console.log(JSON.stringify(extractJson(text), null, 2));
})().catch((err) => {
  console.error("[mistral] 실패:", err.message);
  process.exitCode = 1;
});

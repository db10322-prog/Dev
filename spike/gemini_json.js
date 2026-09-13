// T-0 — Gemini 무료 티어 실호출 + JSON 스키마 강제 출력 + 연속 호출로 RPM/RPD 실측
// 사용: node spike/gemini_json.js [연속호출횟수]
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const OUT_DIR = path.join(__dirname, "out");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["검증됨", "대체로 사실", "근거 불충분", "사실과 다름"] },
    confidence: { type: "number" },
    reasons: { type: "array", items: { type: "string" }, minItems: 3 },
  },
  required: ["verdict", "confidence", "reasons"],
};

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  if (!apiKey) throw new Error("GEMINI_API_KEY 없음");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });
  const elapsedMs = Date.now() - started;
  const body = await res.json();
  return { status: res.status, elapsedMs, body };
}

(async () => {
  const rounds = parseInt(process.argv[2] || "5", 10);
  const prompt =
    "다음 한국어 뉴스 문장의 사실 여부를 4단계(검증됨/대체로 사실/근거 불충분/사실과 다름)로 " +
    "판정하고 근거를 3줄 이상 제시해. 문장: \"정부가 내년도 최저임금을 동결하기로 했다.\"";

  const log = [];
  for (let i = 1; i <= rounds; i++) {
    try {
      const { status, elapsedMs, body } = await callGemini(prompt);
      console.log(`[gemini ${i}/${rounds}] status=${status} ${elapsedMs}ms`);
      log.push({ round: i, status, elapsedMs, body });
      if (status === 429) {
        console.warn(`[gemini] 429 rate-limit 도달. round=${i}에서 막힘 — 이 숫자를 RPM 실측치로 기록할 것`);
        break;
      }
    } catch (err) {
      console.error(`[gemini ${i}/${rounds}] 실패:`, err.message);
      log.push({ round: i, error: err.message });
      break;
    }
  }
  const outFile = path.join(OUT_DIR, `gemini_json_${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(log, null, 2), "utf-8");
  console.log(`[gemini_json] 저장: ${outFile}`);
})();

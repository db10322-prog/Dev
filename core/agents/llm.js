// 본체 AI 호출 래퍼.
//
// 우선순위: Mistral(있으면) → Gemini(있으면) → Groq(있으면) → 로컬 모델(항상 가능).
//
// 왜 이 순서인가 — 전부 "무료 한도 안에서 최고 품질"을 미성년자도 실제로 쓸 수 있는 범위에서
// 고른 것이다.
//   - Mistral AI: 이용약관상 만 13세 이상 + 미성년자는 보호자 동의만 있으면 본인 명의로 직접
//     가입 가능(계정을 보호자가 대신 만들어줄 필요 없음). 무료 "Experiment" 티어가 SMS 인증만
//     으로(카드 불필요) Mistral Large 같은 상위 모델까지 월 10억 토큰 한도로 열어준다 —
//     로컬 1.5B보다 품질이 훨씬 좋음.
//   - Gemini / Groq: 둘 다 "계정 보유자가 만 18세 이상이어야 함"이 이용약관에 명시돼 있어
//     미성년자가 본인 명의로는 발급 불가. 성인(부모님/선생님 등)이 대신 만들어준 키가 있을
//     때만 선택적으로 사용.
//   - 로컬 모델(core/agents/localLlm.js): 위 셋 다 없어도 항상 동작하는 기본 바닥값. 계정도
//     로그인도 이용약관 동의도 전혀 필요 없음(node-llama-cpp는 MIT, 모델은 Apache-2.0).
//
// core/pipeline.js 및 core/agents/comments.js 에서 공용으로 사용.
const fetch = require("node-fetch");

// 로컬 모델은 Electron 데스크톱 환경 전용 — Vercel 서버리스(Linux, 모델 파일도 없음)에서는
// 절대 로드하면 안 된다(실제로 빌드가 깨지는 걸 겪었음). require를 지연시켜서 이 모듈이
// Vercel 번들에 아예 딸려 들어가지 않게 하고, callLocalLlmJson()도 VERCEL 환경변수가 있으면
// 호출 자체를 막는다.
function callLocalLlmJson(args) {
  if (process.env.VERCEL) {
    return Promise.reject(
      new Error("로컬 모델은 Vercel 환경에서 비활성화됨 — MISTRAL_API_KEY/GEMINI_API_KEY/GROQ_API_KEY 중 하나를 환경변수에 설정하세요.")
    );
  }
  return require("./localLlm").callLocalLlmJson(args);
}

async function callMistral({ prompt, responseSchema, apiKey, model }) {
  const key = apiKey || process.env.MISTRAL_API_KEY;
  const modelName = model || process.env.MISTRAL_MODEL || "mistral-large-latest";
  if (!key) throw new Error("MISTRAL_API_KEY 없음");

  const responseFormat = responseSchema
    ? { type: "json_schema", json_schema: { name: "verdict_report", schema: responseSchema, strict: true } }
    : { type: "json_object" };

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      response_format: responseFormat,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Mistral ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Mistral 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `mistral:${modelName}` };
}

async function callGemini({ prompt, responseSchema, apiKey, model }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  const modelName = model || process.env.GEMINI_MODEL || "gemini-flash-latest";
  if (!key) throw new Error("GEMINI_API_KEY 없음");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(responseSchema ? { responseSchema } : {}),
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Gemini ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `gemini:${modelName}` };
}

async function callGroq({ prompt, apiKey, model }) {
  const key = apiKey || process.env.GROQ_API_KEY;
  const modelName = model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  if (!key) throw new Error("GROQ_API_KEY 없음");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: "You must respond with valid JSON only, no prose, no markdown fences." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `groq:${modelName}` };
}

function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  return JSON.parse(cleaned);
}

/**
 * 구조화 JSON 출력을 강제하는 본체 AI 1회 호출.
 * 우선순위: Mistral → Gemini → Groq → 로컬 모델. 앞쪽이 실패하거나 키가 없으면 다음으로 넘어가고,
 * 아무 클라우드 키도 없으면 로컬 모델로 완전히 동작한다(미성년자 기본 경로).
 * @returns {{ json: object, modelUsed: string, usedFallback: boolean }}
 */
async function callLLMJson({ prompt, responseSchema }) {
  const chain = [
    { name: "mistral", key: process.env.MISTRAL_API_KEY, call: () => callMistral({ prompt, responseSchema }) },
    { name: "gemini", key: process.env.GEMINI_API_KEY, call: () => callGemini({ prompt, responseSchema }) },
    { name: "groq", key: process.env.GROQ_API_KEY, call: () => callGroq({ prompt }) },
  ];

  // 클라우드 경로 중 "키가 있는데 호출 자체가 실패한" 마지막 에러를 따로 기록해둔다 — 전부 실패해서
  // 로컬 모델로 넘어갔는데 그마저 실패하면(Vercel엔 로컬 모델이 아예 없음), 밑에서 항상
  // "키를 설정하세요"라는 로컬 모델의 일반 메시지만 던져서 실제 원인(레이트리밋/모델 접근 권한 등)이
  // 안 보이는 문제가 있었다 — 실제로 이 프로젝트 배포본에서 겪은 문제.
  let lastCloudError = null;
  for (let i = 0; i < chain.length; i++) {
    const { name, key, call } = chain[i];
    if (!key) continue;
    try {
      const { text, modelUsed } = await call();
      return { json: extractJson(text), modelUsed, usedFallback: i > 0 };
    } catch (err) {
      console.warn(`[llm] ${name} 사용 불가(${err.message}) — 다음 경로 시도`);
      lastCloudError = { name, err };
    }
  }

  try {
    const { json, modelUsed } = await callLocalLlmJson({ prompt, responseSchema });
    return { json, modelUsed, usedFallback: chain.some((c) => c.key) };
  } catch (localErr) {
    if (lastCloudError) {
      throw new Error(
        `${lastCloudError.name} 호출 실패: ${lastCloudError.err.message} (로컬 모델도 사용 불가: ${localErr.message})`
      );
    }
    throw localErr;
  }
}

module.exports = { callLLMJson, callMistral, callGemini, callGroq, callLocalLlmJson, extractJson };

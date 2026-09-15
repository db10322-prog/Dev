// 본체 AI 호출 래퍼.
//
// 우선순위: Mistral(있으면) → DeepSeek(있으면) → Z.ai/GLM(있으면) → HuggingFace(있으면) →
// SambaNova(있으면) → Gemini(있으면) → Groq(있으면) → 로컬 모델(항상 가능).
//
// 왜 이 순서인가 — 전부 "무료 한도 안에서 최고 품질"을 미성년자도 실제로 쓸 수 있는 범위에서
// 고른 것이다.
//   - Mistral AI: 이용약관상 만 13세 이상 + 미성년자는 보호자 동의만 있으면 본인 명의로 직접
//     가입 가능(계정을 보호자가 대신 만들어줄 필요 없음). 무료 "Experiment" 티어가 SMS 인증만
//     으로(카드 불필요) Mistral Large 같은 상위 모델까지 월 10억 토큰 한도로 열어준다 —
//     로컬 1.5B보다 품질이 훨씬 좋음. 단, 이 SMS 인증 자체가 불가능한 상황(휴대폰이 없거나
//     제출된 상태 등)이면 미인증 기본 한도가 매우 낮아 사실상 못 쓴다.
//   - DeepSeek(공식 platform.deepseek.com): 약관상 "만 18세 미만은 보호자 동의하에 이용"으로,
//     Mistral과 같은 "미성년자 전면 금지가 아니라 보호자 동의" 구조 — Gemini/Groq처럼 딱 잘라
//     18세 이상만 되는 것과 다름. 단 가입 시 SMS 인증이 필수라 휴대폰 인증이 가능한 상황에서만
//     쓸 수 있음. 신규 계정에 소량의 무료 크레딧을 줘서 카드 등록 없이도 당장 몇 번은 호출
//     가능(정확한 금액/기간은 자주 바뀌므로 가입 후 대시보드에서 직접 확인할 것) — 다 쓰면
//     카드 등록 없이는 더 이상 호출이 안 되니 그 시점부터는 사실상 못 쓰는 걸로 취급.
//   - Z.ai(GLM, 국제 z.ai 포털): 약관 전체에 나이 하한선 자체가 없음(COPPA 관련 "13세 미만
//     개인정보 처리 금지" 한 줄뿐, 이용 자격과는 무관 — 직접 확인함). 이메일 가입만으로 끝,
//     전화번호도 카드도 불필요. GLM-4.5-flash 계열이 상시 무료(하루 1000건 수준으로 SambaNova/
//     HuggingFace보다 넉넉함) — 그래서 HuggingFace보다 먼저 시도하도록 배치.
//   - HuggingFace Inference Providers: 이용약관상 만 13세 이상, 전화번호 인증도 카드 등록도
//     전혀 필요 없음(이메일 계정 가입 + 토큰 발급만으로 끝). 대신 무료 크레딧이 월 $0.10로
//     매우 적어서(모델/제공자에 따라 다르지만 대략 수십~수백 회 호출 분량) 상시 운영보다는
//     "지금 당장 키가 하나도 안 통할 때"의 임시 대안에 가깝다.
//   - SambaNova Cloud: 이용약관·EULA 어디에도 최소 연령 조항이 없고(직접 확인함), 카드도
//     전화번호도 요구하지 않음 — 이메일 가입만으로 끝. 대신 무료 티어가 분당 20건 + **일일 20건**
//     으로 꽤 낮아서(판정 1건당 이 파이프라인이 보통 2번 호출하므로 하루 10건 안팎), HuggingFace와
//     비슷하게 상시 운영보다는 여분의 대안에 가깝다.
//   - Gemini / Groq: 둘 다 "계정 보유자가 만 18세 이상이어야 함"이 이용약관에 명시돼 있어
//     미성년자가 본인 명의로는 발급 불가. 성인(부모님/선생님 등)이 대신 만들어준 키가 있을
//     때만 선택적으로 사용.
//   - 로컬 모델(core/agents/localLlm.js): 위 일곱 다 없어도 항상 동작하는 기본 바닥값. 계정도
//     로그인도 이용약관 동의도 전혀 필요 없음(node-llama-cpp는 MIT, 모델은 Apache-2.0). 단
//     Vercel 서버리스에서는 아예 비활성화돼 있음(아래 callLocalLlmJson 참고) — 그래서 모바일
//     웹(/analyze) 경로는 이 일곱 중 최소 하나가 실제로 동작해야만 결과가 나온다.
//
// core/pipeline.js 및 core/agents/comments.js 에서 공용으로 사용.
const fetch = require("node-fetch");

// 무료/저사양 티어에서 흔한 429(rate limit)는 "실패"가 아니라 "잠깐 기다렸다 다시 보내라"는 신호다.
// Retry-After 헤더가 있으면 그 시간만큼, 없으면 짧게 기본값만큼 기다렸다가 딱 한 번 더 시도한다
// (그래도 20초 목표 예산이 있어서 무한 재시도는 안 함 — 그래도 안 되면 다음 provider/로컬로 넘어감).
async function fetchWithRateLimitRetry(url, options, { maxRetries = 1, defaultDelayMs = 2000, maxDelayMs = 5000 } = {}) {
  let res;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    res = await fetch(url, options);
    if (res.status !== 429 || attempt === maxRetries) return res;
    const retryAfter = res.headers.get("retry-after");
    const waitMs = retryAfter ? Math.min(Number(retryAfter) * 1000, maxDelayMs) : defaultDelayMs;
    console.warn(`[llm] 429 rate limited — ${waitMs}ms 대기 후 재시도 (${attempt + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return res;
}

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

  const res = await fetchWithRateLimitRetry("https://api.mistral.ai/v1/chat/completions", {
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

async function callDeepSeek({ prompt, apiKey, model }) {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;
  const modelName = model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
  if (!key) throw new Error("DEEPSEEK_API_KEY 없음");

  const res = await fetchWithRateLimitRetry("https://api.deepseek.com/chat/completions", {
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
    const err = new Error(`DeepSeek ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `deepseek:${modelName}` };
}

async function callZai({ prompt, apiKey, model }) {
  const key = apiKey || process.env.ZAI_API_KEY;
  const modelName = model || process.env.ZAI_MODEL || "glm-4.5-flash";
  if (!key) throw new Error("ZAI_API_KEY 없음");

  const res = await fetchWithRateLimitRetry("https://api.z.ai/api/paas/v4/chat/completions", {
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
      // GLM-4.5/4.6 계열은 기본이 "thinking"(추론) 모드라 실제로 붙여보니 판정 1건에 137초가
      // 걸렸음(20초 목표를 크게 초과) — 체인 오브 쏘트를 끄면 훨씬 빨라진다. (GLM-5.3/5.3-flash는
      // thinking을 강제라 이 옵션이 안 먹지만, 기본값 glm-4.5-flash에는 적용됨.)
      thinking: { type: "disabled" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Z.ai ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Z.ai 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `zai:${modelName}` };
}

async function callHuggingFace({ prompt, apiKey, model }) {
  const key = apiKey || process.env.HF_API_KEY;
  // ":cheapest"는 토큰당 가격이 가장 싼 provider로 라우팅 — 월 $0.10 무료 크레딧을 최대한 늘려 쓰기 위함.
  const modelName = model || process.env.HF_MODEL || "meta-llama/Llama-3.3-70B-Instruct:cheapest";
  if (!key) throw new Error("HF_API_KEY 없음");

  const res = await fetchWithRateLimitRetry("https://router.huggingface.co/v1/chat/completions", {
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
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`HuggingFace ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("HuggingFace 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `huggingface:${modelName}` };
}

async function callSambaNova({ prompt, apiKey, model }) {
  const key = apiKey || process.env.SAMBANOVA_API_KEY;
  const modelName = model || process.env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct";
  if (!key) throw new Error("SAMBANOVA_API_KEY 없음");

  const res = await fetchWithRateLimitRetry("https://api.sambanova.ai/v1/chat/completions", {
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
    const err = new Error(`SambaNova ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("SambaNova 응답에 텍스트 없음: " + JSON.stringify(data));
  return { text, raw: data, modelUsed: `sambanova:${modelName}` };
}

async function callGemini({ prompt, responseSchema, apiKey, model }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  const modelName = model || process.env.GEMINI_MODEL || "gemini-flash-latest";
  if (!key) throw new Error("GEMINI_API_KEY 없음");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
  const res = await fetchWithRateLimitRetry(url, {
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

  const res = await fetchWithRateLimitRetry("https://api.groq.com/openai/v1/chat/completions", {
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
 * 우선순위: Mistral → DeepSeek → Z.ai → HuggingFace → SambaNova → Gemini → Groq → 로컬 모델.
 * 앞쪽이 실패하거나 키가 없으면 다음으로 넘어가고, 아무 클라우드 키도 없으면 로컬 모델로
 * 완전히 동작한다(미성년자 기본 경로).
 * @returns {{ json: object, modelUsed: string, usedFallback: boolean }}
 */
async function callLLMJson({ prompt, responseSchema }) {
  const chain = [
    { name: "mistral", key: process.env.MISTRAL_API_KEY, call: () => callMistral({ prompt, responseSchema }) },
    { name: "deepseek", key: process.env.DEEPSEEK_API_KEY, call: () => callDeepSeek({ prompt }) },
    { name: "zai", key: process.env.ZAI_API_KEY, call: () => callZai({ prompt }) },
    { name: "huggingface", key: process.env.HF_API_KEY, call: () => callHuggingFace({ prompt }) },
    { name: "sambanova", key: process.env.SAMBANOVA_API_KEY, call: () => callSambaNova({ prompt }) },
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

module.exports = {
  callLLMJson,
  callMistral,
  callDeepSeek,
  callZai,
  callHuggingFace,
  callSambaNova,
  callGemini,
  callGroq,
  callLocalLlmJson,
  extractJson,
};

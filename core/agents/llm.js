// 본체 AI 호출 래퍼.
// 기본 경로 = 로컬 모델(core/agents/localLlm.js, node-llama-cpp + Qwen2.5-3B, 계정/키 불필요).
// Gemini/Groq는 "있으면 쓰는" 선택적 경로일 뿐 — 두 서비스 모두 이용약관상 만 18세 이상만
// 가입 가능해서, 미성년 개발자가 기본값으로 의존하면 안 되는 경로다. .env에 키가 있으면
// (성인이 대신 발급해준 경우 등) 더 빠르고 품질 좋은 이 경로를 대신 쓸 수 있게 남겨둔다.
// core/pipeline.js 및 core/agents/comments.js 에서 공용으로 사용.
const fetch = require("node-fetch");
const { callLocalLlmJson } = require("./localLlm");

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
 * 우선순위: 로컬 모델(항상 사용 가능, 키 불필요) → GEMINI_API_KEY가 있으면 Gemini →
 * GROQ_API_KEY가 있으면 Groq. 클라우드 키가 아예 없어도(미성년자 기본 경로) 완전히 동작한다.
 * @returns {{ json: object, modelUsed: string, usedFallback: boolean }}
 */
async function callLLMJson({ prompt, responseSchema }) {
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;

  if (!hasGemini && !hasGroq) {
    const { json, modelUsed } = await callLocalLlmJson({ prompt, responseSchema });
    return { json, modelUsed, usedFallback: false };
  }

  try {
    if (!hasGemini) throw new Error("GEMINI_API_KEY 없음 — Groq로 바로 시도");
    const { text, modelUsed } = await callGemini({ prompt, responseSchema });
    return { json: extractJson(text), modelUsed, usedFallback: false };
  } catch (geminiErr) {
    console.warn(`[llm] Gemini 사용 불가(${geminiErr.message}), Groq 시도`);
    try {
      if (!hasGroq) throw new Error("GROQ_API_KEY 없음");
      const { text, modelUsed } = await callGroq({ prompt });
      return { json: extractJson(text), modelUsed, usedFallback: true };
    } catch (groqErr) {
      console.warn(`[llm] Groq도 사용 불가(${groqErr.message}), 로컬 모델로 최종 폴백`);
      const { json, modelUsed } = await callLocalLlmJson({ prompt, responseSchema });
      return { json, modelUsed, usedFallback: true };
    }
  }
}

module.exports = { callLLMJson, callGemini, callGroq, callLocalLlmJson, extractJson };

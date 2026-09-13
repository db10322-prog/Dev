// 본체 AI 호출 래퍼: Gemini 우선, 실패/쿼터초과 시 Groq 폴백.
// core/pipeline.js 및 core/agents/comments.js 에서 공용으로 사용.
const fetch = require("node-fetch");

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
 * Gemini 우선 시도 → 실패(429/5xx/네트워크오류)시 Groq 폴백.
 * @returns {{ json: object, modelUsed: string, usedFallback: boolean }}
 */
async function callLLMJson({ prompt, responseSchema }) {
  try {
    const { text, modelUsed } = await callGemini({ prompt, responseSchema });
    return { json: extractJson(text), modelUsed, usedFallback: false };
  } catch (geminiErr) {
    console.warn(`[llm] Gemini 실패, Groq 폴백 시도: ${geminiErr.message}`);
    const { text, modelUsed } = await callGroq({ prompt });
    return { json: extractJson(text), modelUsed, usedFallback: true };
  }
}

module.exports = { callLLMJson, callGemini, callGroq, extractJson };

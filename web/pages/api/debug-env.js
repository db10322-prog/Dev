// 임시 진단용 — 실제 키 값은 절대 노출하지 않고 "주입 여부/길이 + 실제 호출 성공 여부"만 확인.
// 원인 파악 후 바로 삭제할 것.
const fetch = require("node-fetch");

async function probeMistral() {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return { hasKey: false };
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      messages: [{ role: "user", content: 'Reply with exactly this JSON object: {"ok": true}' }],
      response_format: { type: "json_object" },
    }),
  });
  const bodyText = await r.text();
  return { hasKey: true, keyLen: key.length, status: r.status, retryAfter: r.headers.get("retry-after"), body: bodyText.slice(0, 400) };
}

async function probeHuggingFace() {
  const key = process.env.HF_API_KEY;
  if (!key) return { hasKey: false };
  const r = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.HF_MODEL || "meta-llama/Llama-3.3-70B-Instruct:cheapest",
      messages: [
        { role: "system", content: "You must respond with valid JSON only, no prose, no markdown fences." },
        { role: "user", content: 'Reply with exactly this JSON object: {"ok": true}' },
      ],
    }),
  });
  const bodyText = await r.text();
  return { hasKey: true, keyLen: key.length, status: r.status, retryAfter: r.headers.get("retry-after"), body: bodyText.slice(0, 400) };
}

async function probeSambaNova() {
  const key = process.env.SAMBANOVA_API_KEY;
  if (!key) return { hasKey: false };
  const r = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct",
      messages: [
        { role: "system", content: "You must respond with valid JSON only, no prose, no markdown fences." },
        { role: "user", content: 'Reply with exactly this JSON object: {"ok": true}' },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const bodyText = await r.text();
  return { hasKey: true, keyLen: key.length, status: r.status, retryAfter: r.headers.get("retry-after"), body: bodyText.slice(0, 400) };
}

export default async function handler(req, res) {
  const [mistral, huggingface, sambanova] = await Promise.all([
    probeMistral().catch((e) => ({ fetchError: String(e.message || e) })),
    probeHuggingFace().catch((e) => ({ fetchError: String(e.message || e) })),
    probeSambaNova().catch((e) => ({ fetchError: String(e.message || e) })),
  ]);
  res.status(200).json({
    vercelEnv: process.env.VERCEL_ENV || null,
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
    hasGroq: Boolean(process.env.GROQ_API_KEY),
    mistral,
    huggingface,
    sambanova,
  });
}

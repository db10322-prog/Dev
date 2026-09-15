// 임시 진단용 — 실제 키 값은 절대 노출하지 않고 "주입 여부/길이 + 실제 호출 성공 여부"만 확인.
// 원인 파악 후 바로 삭제할 것.
const fetch = require("node-fetch");

export default async function handler(req, res) {
  const key = process.env.MISTRAL_API_KEY;
  const out = {
    hasMistral: Boolean(key),
    mistralLen: (key || "").length,
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
    hasGroq: Boolean(process.env.GROQ_API_KEY),
    vercelEnv: process.env.VERCEL_ENV || null,
    mistralModel: process.env.MISTRAL_MODEL || "mistral-large-latest (기본값)",
  };

  if (key) {
    try {
      // core/agents/llm.js의 재시도 래퍼를 거치지 않고 직접 1회 호출 — 429의 Retry-After 헤더 등
      // 실제 응답 헤더를 그대로 보기 위함.
      const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.MISTRAL_MODEL || "mistral-large-latest",
          messages: [{ role: "user", content: 'Reply with exactly this JSON object: {"ok": true}' }],
          response_format: { type: "json_object" },
        }),
      });
      out.status = r.status;
      out.retryAfterHeader = r.headers.get("retry-after");
      out.rateLimitHeaders = {
        limit: r.headers.get("x-ratelimit-limit") || r.headers.get("ratelimit-limit"),
        remaining: r.headers.get("x-ratelimit-remaining") || r.headers.get("ratelimit-remaining"),
        reset: r.headers.get("x-ratelimit-reset") || r.headers.get("ratelimit-reset"),
      };
      const bodyText = await r.text();
      out.body = bodyText.slice(0, 500);
    } catch (err) {
      out.fetchError = String(err.message || err);
    }
  }

  res.status(200).json(out);
}

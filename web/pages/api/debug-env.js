// 임시 진단용 — 실제 키 값은 절대 노출하지 않고 "주입 여부/길이 + 실제 호출 성공 여부"만 확인.
// 원인 파악 후 바로 삭제할 것.
const { callMistral } = require("../../../core/agents/llm");

export default async function handler(req, res) {
  const out = {
    hasMistral: Boolean(process.env.MISTRAL_API_KEY),
    mistralLen: (process.env.MISTRAL_API_KEY || "").length,
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
    hasGroq: Boolean(process.env.GROQ_API_KEY),
    vercelEnv: process.env.VERCEL_ENV || null,
  };

  if (out.hasMistral) {
    try {
      const { modelUsed } = await callMistral({ prompt: 'Reply with exactly this JSON object: {"ok": true}' });
      out.mistralCallResult = "success";
      out.mistralModelUsed = modelUsed;
    } catch (err) {
      out.mistralCallResult = "failed";
      out.mistralCallError = String(err.message || err);
    }
  }

  res.status(200).json(out);
}

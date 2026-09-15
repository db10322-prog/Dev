// 임시 진단용 — 실제 키 값은 절대 노출하지 않고 "주입 여부/길이"만 확인. 원인 파악 후 바로 삭제할 것.
export default function handler(req, res) {
  res.status(200).json({
    hasMistral: Boolean(process.env.MISTRAL_API_KEY),
    mistralLen: (process.env.MISTRAL_API_KEY || "").length,
    hasGemini: Boolean(process.env.GEMINI_API_KEY),
    hasGroq: Boolean(process.env.GROQ_API_KEY),
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
}

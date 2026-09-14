// T-2 텍스트 층 — 프레이밍 지표 구조화 채점 (core/prompts/bias.md 사용)
const fs = require("fs");
const path = require("path");
const { callLLMJson } = require("./llm");
const { resolveCoreAsset } = require("../resolveAsset");

const PROMPT_TEMPLATE = fs.readFileSync(
  resolveCoreAsset(path.join(__dirname, "..", "prompts", "bias.md"), "core", "prompts", "bias.md"),
  "utf-8"
);

const TEXT_BIAS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      indicator: { type: "string" },
      score: { type: "number" },
      detail: { type: "string" },
    },
    required: ["indicator", "score", "detail"],
  },
};

/** @returns {Promise<Array<{indicator, score, detail}>>} */
async function scoreTextFraming(articleText) {
  const prompt = `${PROMPT_TEMPLATE}\n\n## 기사 본문\n${articleText}`;
  const { json } = await callLLMJson({ prompt, responseSchema: TEXT_BIAS_SCHEMA });
  return json;
}

module.exports = { scoreTextFraming };

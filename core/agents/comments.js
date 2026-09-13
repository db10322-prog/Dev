// T-6 — 댓글 여론 분석. 댓글 원문은 절대 출력에 노출하지 않고 요약만 반환.
const fs = require("fs");
const path = require("path");
const { callLLMJson } = require("./llm");

const PROMPT_TEMPLATE = fs.readFileSync(path.join(__dirname, "..", "prompts", "opinion.md"), "utf-8");

const OPINION_SCHEMA = {
  type: "object",
  properties: {
    forRatio: { type: "number" },
    againstRatio: { type: "number" },
    topPoints: { type: "array", items: { type: "string" } },
    alignmentWithArticle: { type: "string", enum: ["일치", "괴리", "혼재"] },
  },
  required: ["forRatio", "againstRatio", "topPoints", "alignmentWithArticle"],
};

/**
 * @param {string[]} comments 댓글 원문 배열 (요약 후 즉시 폐기, 결과에 원문 포함 금지)
 * @returns {Promise<object|null>} 댓글이 없으면 null (상위에서 opinion 섹션 생략)
 */
async function summarizeOpinion(comments) {
  if (!comments || comments.length === 0) return null;

  const trimmed = comments.slice(0, 200).map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (trimmed.length === 0) return null;

  const prompt = `${PROMPT_TEMPLATE}\n\n## 댓글 목록 (${trimmed.length}개)\n${trimmed
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n")}`;

  const { json } = await callLLMJson({ prompt, responseSchema: OPINION_SCHEMA });
  return json;
}

module.exports = { summarizeOpinion };

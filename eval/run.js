// T-9 — 정확도 검증 세트 실행. eval/dataset.json 을 돌려 혼동행렬 + 정확도를 산출.
// 사용법: npm run eval   (실행 전 eval/dataset.json 의 PLACEHOLDER를 실제 라벨링된 기사로 교체할 것)
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { analyzeArticle } = require("../core/pipeline");

const DATASET_PATH = path.join(__dirname, "dataset.json");
const OUT_MD = path.join(__dirname, "..", "docs", "evaluation.md");

function buildConfusionMatrix(rows) {
  const labels = ["검증됨", "대체로 사실", "근거 불충분", "사실과 다름"];
  const matrix = {};
  labels.forEach((l1) => {
    matrix[l1] = {};
    labels.forEach((l2) => (matrix[l1][l2] = 0));
  });
  rows.forEach(({ expected, actual }) => {
    if (expected && labels.includes(expected) && labels.includes(actual)) {
      matrix[expected][actual] += 1;
    }
  });
  return { labels, matrix };
}

(async () => {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, "utf-8"));
  const items = dataset.items.filter((i) => i.url !== "PLACEHOLDER");
  if (items.length === 0) {
    console.error(
      "[eval] eval/dataset.json 이 아직 전부 PLACEHOLDER 입니다. " +
      "실제 30건(허위 판정 10 + 정상 10 + 성향뚜렷 10)으로 채운 뒤 다시 실행하세요."
    );
    process.exit(1);
  }

  const results = [];
  for (const item of items) {
    try {
      const report = await analyzeArticle({ url: item.url, title: item.title, text: item.text }, { useCache: false });
      results.push({
        id: item.id,
        group: item.group,
        expected: item.groundTruthVerdict,
        actual: report.verdict,
        expectedDirection: item.groundTruthDirection,
        actualDirection: report.bias?.direction,
        correct: item.groundTruthVerdict ? item.groundTruthVerdict === report.verdict : null,
      });
      console.log(`[eval] ${item.id}: expected=${item.groundTruthVerdict} actual=${report.verdict}`);
    } catch (err) {
      console.error(`[eval] ${item.id} 실패:`, err.message);
      results.push({ id: item.id, group: item.group, error: err.message });
    }
  }

  const verdictRows = results.filter((r) => r.expected);
  const { labels, matrix } = buildConfusionMatrix(verdictRows);
  const correctCount = verdictRows.filter((r) => r.correct).length;
  const accuracy = verdictRows.length ? (correctCount / verdictRows.length) * 100 : 0;

  const wrongCases = verdictRows.filter((r) => r.correct === false).slice(0, 5);

  const md = [
    "# 정확도 검증 결과 (T-9)",
    "",
    `실행 일시: ${new Date().toISOString()}`,
    `검증 건수: ${verdictRows.length}건 / 정확도: ${accuracy.toFixed(1)}%`,
    "",
    "## 혼동행렬 (실제 라벨 → 판정 결과)",
    "",
    "| 실제\\판정 | " + labels.join(" | ") + " |",
    "| --- | " + labels.map(() => "---").join(" | ") + " |",
    ...labels.map((l1) => `| ${l1} | ` + labels.map((l2) => matrix[l1][l2]).join(" | ") + " |"),
    "",
    "## 결과표",
    "",
    "| id | group | expected | actual | correct |",
    "| --- | --- | --- | --- | --- |",
    ...results.map((r) => `| ${r.id} | ${r.group} | ${r.expected || "-"} | ${r.actual || r.error || "-"} | ${r.correct === null ? "-" : r.correct} |`),
    "",
    "## 오답 사례 원인 분석 (발표 Q&A 방어용, 최소 3건)",
    "",
    ...(wrongCases.length
      ? wrongCases.map(
          (r, i) =>
            `${i + 1}. **${r.id}** — expected=${r.expected}, actual=${r.actual}. 원인: (직접 기사 내용을 확인해 채울 것 — 예: 후보 기사 원문 fetch 실패로 evidence 부족 / factCheck 결과 없음 / 텍스트 프레이밍 오판 등)`
        )
      : ["오답 사례 없음 또는 아직 실행되지 않음."]),
  ].join("\n");

  fs.writeFileSync(OUT_MD, md, "utf-8");
  console.log(`\n[eval] 정확도: ${accuracy.toFixed(1)}% (${correctCount}/${verdictRows.length})`);
  console.log(`[eval] 결과 저장: ${OUT_MD}`);
})();
